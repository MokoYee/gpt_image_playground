import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { hashPassword, requireAuth, signToken, verifyPassword } from '../auth.js'
import { badRequest, conflict, forbidden, unauthorized } from '../errors.js'
import { EmailSchema, PasswordSchema, UsernameSchema } from '../validators.js'
import { readSystemSettings } from '../services/settings.js'
import { withTransaction } from '../db.js'

function publicUser(row: any) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    role: row.role,
    credits: Number(row.credits ?? 0),
    multiplier: Number(row.multiplier ?? 1),
    concurrencyLimit: row.concurrency_limit == null ? null : Number(row.concurrency_limit),
    disabled: row.status !== 'enabled',
    createdAt: new Date(row.created_at).getTime(),
  }
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request) => {
    const body = z.object({
      identifier: z.string().trim().min(1),
      password: z.string().min(1),
    }).parse(request.body)
    const result = await app.context.db.query(
      `
        select u.id::text, u.username, u.email, u.password_hash, u.role, u.status, w.credits, w.multiplier, w.concurrency_limit, u.created_at
        from users u
        join user_wallets w on w.user_id = u.id
        where (lower(u.username) = lower($1) or lower(u.email) = lower($1))
          and u.status <> 'deleted'
      `,
      [body.identifier],
    )
    const user = result.rows[0]
    if (!user || !await verifyPassword(body.password, user.password_hash)) throw unauthorized('账号或密码不正确')
    if (user.status !== 'enabled') throw forbidden('该账号已被禁用')
    const token = await signToken(app.context.config.JWT_SECRET, app.context.config.JWT_EXPIRES_IN_SECONDS, user)
    return { token, user: publicUser(user) }
  })

  app.post('/api/auth/register', async (request) => {
    const body = z.object({
      username: UsernameSchema,
      email: EmailSchema,
      password: PasswordSchema,
    }).parse(request.body)
    const settings = await readSystemSettings(app.context.db)
    if (!settings.auth.registrationOpen) throw forbidden('当前未开放注册')

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
          values ($1, $2, $3, 'user')
          returning id::text, username, email, role, status, created_at
        `,
        [body.username, body.email, passwordHash],
      )
      await client.query(
        'insert into user_wallets (user_id, credits, multiplier) values ($1, $2, $3)',
        [created.rows[0].id, settings.auth.defaultCredits, settings.auth.defaultMultiplier],
      )
      return { ...created.rows[0], credits: settings.auth.defaultCredits, multiplier: settings.auth.defaultMultiplier }
    })
    const token = await signToken(app.context.config.JWT_SECRET, app.context.config.JWT_EXPIRES_IN_SECONDS, user)
    return { token, user: publicUser(user) }
  })

  app.get('/api/auth/me', { preHandler: requireAuth }, async (request) => {
    const result = await app.context.db.query(
      `
        select u.id::text, u.username, u.email, u.role, u.status, w.credits, w.multiplier, w.concurrency_limit, u.created_at
        from users u join user_wallets w on w.user_id = u.id
        where u.id = $1
      `,
      [request.user.id],
    )
    return { user: publicUser(result.rows[0]) }
  })

  app.post('/api/auth/change-password', { preHandler: requireAuth }, async (request) => {
    const body = z.object({
      oldPassword: z.string().min(1),
      newPassword: PasswordSchema,
    }).parse(request.body)
    const result = await app.context.db.query('select password_hash from users where id = $1', [request.user.id])
    if (!result.rows[0] || !await verifyPassword(body.oldPassword, result.rows[0].password_hash)) {
      throw badRequest('原密码不正确')
    }
    const nextHash = await hashPassword(body.newPassword)
    await app.context.db.query('update users set password_hash = $1, updated_at = now() where id = $2', [nextHash, request.user.id])
    return { ok: true }
  })
}
