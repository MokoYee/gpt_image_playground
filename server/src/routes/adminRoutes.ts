import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { hashPassword, requireAdmin } from '../auth.js'
import { badRequest, conflict, forbidden, notFound } from '../errors.js'
import { EmailSchema, PaginationSchema, PasswordSchema, toOffset, UsernameSchema } from '../validators.js'
import { withTransaction } from '../db.js'
import { readSystemSettings } from '../services/settings.js'
import { writeAuditLog } from '../services/audit.js'

function mapUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    note: row.note ?? '',
    role: row.role,
    credits: Number(row.credits ?? 0),
    multiplier: Number(row.multiplier ?? 1),
    concurrencyLimit: row.concurrency_limit == null ? null : Number(row.concurrency_limit),
    disabled: row.status !== 'enabled',
    createdAt: new Date(row.created_at).getTime(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).getTime() : null,
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at).getTime() : null,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at).getTime() : null,
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
        select u.id::text, u.username, u.email, u.note, u.role, u.status, u.created_at, u.last_login_at, u.last_active_at,
               last_usage.last_used_at, w.credits, w.multiplier, w.concurrency_limit,
               count(*) over() as total
        from users u
        join user_wallets w on w.user_id = u.id
        left join lateral (
          select max(ur.created_at) as last_used_at
          from usage_records ur
          where ur.user_id = u.id
        ) last_usage on true
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
      credits: z.coerce.number().min(0).optional(),
      multiplier: z.coerce.number().min(0).optional(),
      concurrencyLimit: z.coerce.number().int().min(1).optional().nullable(),
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
        [body.username, body.email, passwordHash, 'user'],
      )
      await client.query(
        'insert into user_wallets (user_id, credits, multiplier, concurrency_limit) values ($1, $2, $3, $4)',
        [created.rows[0].id, initialCredits, initialMultiplier, body.concurrencyLimit ?? null],
      )
      return { ...created.rows[0], credits: initialCredits, multiplier: initialMultiplier, concurrency_limit: body.concurrencyLimit ?? null }
    })
    await writeAuditLog(app.context.db, request.user, 'admin.user.create', 'user', user.id, { role: user.role })
    return { user: mapUser(user) }
  })

  app.patch('/api/admin/users/:userId', { preHandler: requireAdmin }, async (request) => {
    const params = z.object({ userId: z.string().uuid() }).parse(request.params)
    const body = z.object({
      disabled: z.boolean().optional(),
      note: z.string().trim().max(500).optional(),
      multiplier: z.coerce.number().min(0).optional(),
      concurrencyLimit: z.coerce.number().int().min(1).optional().nullable(),
      password: PasswordSchema.optional(),
    }).parse(request.body)
    const passwordHash = body.password ? await hashPassword(body.password) : null
    const user = await withTransaction(app.context.db, async (client) => {
      if (body.disabled !== undefined) {
        await client.query(
          `
            update users
            set status = $1,
                updated_at = now()
            where id = $2 and status <> 'deleted'
          `,
          [body.disabled ? 'disabled' : 'enabled', params.userId],
        )
      }
      if (body.note !== undefined) {
        await client.query('update users set note = $1, updated_at = now() where id = $2 and status <> $3', [body.note, params.userId, 'deleted'])
      }
      if (passwordHash) {
        await client.query('update users set password_hash = $1, updated_at = now() where id = $2 and status <> $3', [passwordHash, params.userId, 'deleted'])
      }
      if (body.multiplier !== undefined) {
        await client.query('update user_wallets set multiplier = $1, updated_at = now(), version = version + 1 where user_id = $2', [body.multiplier, params.userId])
      }
      if (body.concurrencyLimit !== undefined) {
        await client.query('update user_wallets set concurrency_limit = $1, updated_at = now(), version = version + 1 where user_id = $2', [body.concurrencyLimit, params.userId])
      }
      const result = await client.query(
        `
          select u.id::text, u.username, u.email, u.note, u.role, u.status, u.created_at, u.last_login_at, u.last_active_at,
                 last_usage.last_used_at, w.credits, w.multiplier, w.concurrency_limit
          from users u join user_wallets w on w.user_id = u.id
          left join lateral (
            select max(ur.created_at) as last_used_at
            from usage_records ur
            where ur.user_id = u.id
          ) last_usage on true
          where u.id = $1 and u.status <> 'deleted'
        `,
        [params.userId],
      )
      if (!result.rows[0]) throw notFound('用户不存在')
      return result.rows[0]
    })
    await writeAuditLog(app.context.db, request.user, 'admin.user.update', 'user', params.userId, {
      disabled: body.disabled,
      noteUpdated: body.note !== undefined,
      multiplier: body.multiplier,
      concurrencyLimit: body.concurrencyLimit,
      passwordReset: Boolean(passwordHash),
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
    await writeAuditLog(app.context.db, request.user, 'admin.user.delete', 'user', params.userId)
    return { ok: true }
  })

  app.post('/api/admin/users/:userId/credits', { preHandler: requireAdmin }, async (request) => {
    const params = z.object({ userId: z.string().uuid() }).parse(request.params)
    const body = z.object({
      type: z.enum(['recharge', 'refund']),
      amount: z.coerce.number().positive(),
      note: z.string().trim().max(500).optional(),
    }).parse(request.body)
    const user = await withTransaction(app.context.db, async (client) => {
      const wallet = await client.query('select credits from user_wallets where user_id = $1 for update', [params.userId])
      if (!wallet.rows[0]) throw notFound('用户不存在')
      const current = Number(wallet.rows[0].credits)
      const nextCredits = body.type === 'refund' ? current - body.amount : current + body.amount
      if (nextCredits < 0) throw badRequest('退款金额不能超过当前余额')
      await client.query('update user_wallets set credits = $1, updated_at = now(), version = version + 1 where user_id = $2', [nextCredits, params.userId])
      await client.query(
        'insert into credit_records (user_id, type, amount, operator_id, note) values ($1, $2, $3, $4, $5)',
        [params.userId, body.type, body.amount, request.user.id, body.note ?? ''],
      )
      const result = await client.query(
        `
          select u.id::text, u.username, u.email, u.note, u.role, u.status, u.created_at, u.last_login_at, u.last_active_at,
                 last_usage.last_used_at, w.credits, w.multiplier, w.concurrency_limit
          from users u join user_wallets w on w.user_id = u.id
          left join lateral (
            select max(ur.created_at) as last_used_at
            from usage_records ur
            where ur.user_id = u.id
          ) last_usage on true
          where u.id = $1
        `,
        [params.userId],
      )
      return result.rows[0]
    })
    await writeAuditLog(app.context.db, request.user, `admin.user.${body.type}`, 'user', params.userId, { amount: body.amount, note: body.note ?? '' })
    return { user: mapUser(user) }
  })

  app.get('/api/admin/credit-records', { preHandler: requireAdmin }, async (request) => {
    const query = PaginationSchema.parse(request.query)
    const result = await app.context.db.query(
      `
        select cr.id::text, cr.user_id::text, u.username, cr.type, cr.amount, cr.note, op.username as operator_username, cr.created_at,
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
        note: row.note ?? '',
        operatorUsername: row.operator_username,
        createdAt: new Date(row.created_at).getTime(),
      })),
      total: Number(result.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    }
  })
}
