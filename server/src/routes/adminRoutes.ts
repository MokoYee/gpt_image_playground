import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { hashPassword, requireAdmin } from '../auth.js'
import { badRequest, conflict, forbidden, notFound } from '../errors.js'
import { EmailSchema, PaginationSchema, PasswordSchema, toOffset, UsernameSchema } from '../validators.js'
import { withTransaction } from '../db.js'
import { readSystemSettings } from '../services/settings.js'

const RoleSchema = z.enum(['user', 'admin'])

function mapUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    credits: Number(row.credits ?? 0),
    multiplier: Number(row.multiplier ?? 1),
    disabled: row.status !== 'enabled',
    createdAt: new Date(row.created_at).getTime(),
  }
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.get('/api/admin/users', { preHandler: requireAdmin }, async (request) => {
    const query = PaginationSchema.extend({
      keyword: z.string().trim().optional(),
    }).parse(request.query)
    const params: unknown[] = []
    const where = ['u.status <> $1']
    params.push('deleted')
    if (query.keyword) {
      params.push(`%${query.keyword}%`)
      where.push(`(u.username ilike $${params.length} or u.email ilike $${params.length})`)
    }
    params.push(query.pageSize, toOffset(query.page, query.pageSize))
    const result = await app.context.db.query(
      `
        select u.id::text, u.username, u.email, u.role, u.status, u.created_at, w.credits, w.multiplier,
               count(*) over() as total
        from users u
        join user_wallets w on w.user_id = u.id
        where ${where.join(' and ')}
        order by u.created_at desc
        limit $${params.length - 1} offset $${params.length}
      `,
      params,
    )
    return {
      items: result.rows.map(mapUser),
      total: Number(result.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    }
  })

  app.post('/api/admin/users', { preHandler: requireAdmin }, async (request) => {
    const body = z.object({
      username: UsernameSchema,
      email: EmailSchema,
      password: PasswordSchema,
      role: RoleSchema.default('user'),
      credits: z.coerce.number().min(0).optional(),
      multiplier: z.coerce.number().min(0).optional(),
    }).parse(request.body)
    const settings = await readSystemSettings(app.context.db)
    const initialCredits = body.credits ?? settings.auth.defaultCredits
    const initialMultiplier = body.multiplier ?? settings.auth.defaultMultiplier
    const passwordHash = await hashPassword(body.password)
    const user = await withTransaction(app.context.db, async (client) => {
      const exists = await client.query(
        'select 1 from users where (lower(username) = lower($1) or lower(email) = lower($2)) and status <> $3 limit 1',
        [body.username, body.email, 'deleted'],
      )
      if (exists.rowCount) throw conflict('用户名或邮箱已存在')
      const created = await client.query(
        `
          insert into users (username, email, password_hash, role)
          values ($1, $2, $3, $4)
          returning id::text, username, email, role, status, created_at
        `,
        [body.username, body.email, passwordHash, body.role],
      )
      await client.query('insert into user_wallets (user_id, credits, multiplier) values ($1, $2, $3)', [created.rows[0].id, initialCredits, initialMultiplier])
      return { ...created.rows[0], credits: initialCredits, multiplier: initialMultiplier }
    })
    return { user: mapUser(user) }
  })

  app.patch('/api/admin/users/:userId', { preHandler: requireAdmin }, async (request) => {
    const params = z.object({ userId: z.string().uuid() }).parse(request.params)
    const body = z.object({
      role: RoleSchema.optional(),
      disabled: z.boolean().optional(),
      multiplier: z.coerce.number().min(0).optional(),
    }).parse(request.body)
    const user = await withTransaction(app.context.db, async (client) => {
      if (body.role || body.disabled !== undefined) {
        await client.query(
          `
            update users
            set role = coalesce($1, role),
                status = coalesce($2, status),
                updated_at = now()
            where id = $3 and status <> 'deleted'
          `,
          [body.role ?? null, body.disabled === undefined ? null : body.disabled ? 'disabled' : 'enabled', params.userId],
        )
      }
      if (body.multiplier !== undefined) {
        await client.query('update user_wallets set multiplier = $1, updated_at = now(), version = version + 1 where user_id = $2', [body.multiplier, params.userId])
      }
      const result = await client.query(
        `
          select u.id::text, u.username, u.email, u.role, u.status, u.created_at, w.credits, w.multiplier
          from users u join user_wallets w on w.user_id = u.id
          where u.id = $1 and u.status <> 'deleted'
        `,
        [params.userId],
      )
      if (!result.rows[0]) throw notFound('用户不存在')
      return result.rows[0]
    })
    return { user: mapUser(user) }
  })

  app.delete('/api/admin/users/:userId', { preHandler: requireAdmin }, async (request) => {
    const params = z.object({ userId: z.string().uuid() }).parse(request.params)
    if (params.userId === request.user.id) throw forbidden('不能删除当前登录账号')
    const result = await app.context.db.query(
      "update users set status = 'deleted', deleted_at = now(), updated_at = now() where id = $1 and status <> 'deleted'",
      [params.userId],
    )
    if (!result.rowCount) throw notFound('用户不存在')
    return { ok: true }
  })

  app.post('/api/admin/users/:userId/credits', { preHandler: requireAdmin }, async (request) => {
    const params = z.object({ userId: z.string().uuid() }).parse(request.params)
    const body = z.object({
      type: z.enum(['recharge', 'refund']),
      amount: z.coerce.number().positive(),
    }).parse(request.body)
    const user = await withTransaction(app.context.db, async (client) => {
      const wallet = await client.query('select credits from user_wallets where user_id = $1 for update', [params.userId])
      if (!wallet.rows[0]) throw notFound('用户不存在')
      const current = Number(wallet.rows[0].credits)
      const nextCredits = body.type === 'refund' ? current - body.amount : current + body.amount
      if (nextCredits < 0) throw badRequest('退款金额不能超过当前余额')
      await client.query('update user_wallets set credits = $1, updated_at = now(), version = version + 1 where user_id = $2', [nextCredits, params.userId])
      await client.query(
        'insert into credit_records (user_id, type, amount, operator_id) values ($1, $2, $3, $4)',
        [params.userId, body.type, body.amount, request.user.id],
      )
      const result = await client.query(
        `
          select u.id::text, u.username, u.email, u.role, u.status, u.created_at, w.credits, w.multiplier
          from users u join user_wallets w on w.user_id = u.id
          where u.id = $1
        `,
        [params.userId],
      )
      return result.rows[0]
    })
    return { user: mapUser(user) }
  })

  app.get('/api/admin/credit-records', { preHandler: requireAdmin }, async (request) => {
    const query = PaginationSchema.parse(request.query)
    const result = await app.context.db.query(
      `
        select cr.id::text, cr.user_id::text, u.username, cr.type, cr.amount, op.username as operator_username, cr.created_at,
               count(*) over() as total
        from credit_records cr
        join users u on u.id = cr.user_id
        join users op on op.id = cr.operator_id
        order by cr.created_at desc
        limit $1 offset $2
      `,
      [query.pageSize, toOffset(query.page, query.pageSize)],
    )
    return {
      items: result.rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        username: row.username,
        type: row.type,
        amount: Number(row.amount),
        operatorUsername: row.operator_username,
        createdAt: new Date(row.created_at).getTime(),
      })),
      total: Number(result.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    }
  })
}
