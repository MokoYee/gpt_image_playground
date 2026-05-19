import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../auth.js'
import { badRequest } from '../errors.js'
import type { SystemSettings } from '../services/settings.js'
import { readSystemSettings, writeSetting } from '../services/settings.js'
import { writeAuditLog } from '../services/audit.js'
import { withTransaction } from '../db.js'

function sanitizeSystemSettings(settings: SystemSettings): SystemSettings {
  return {
    ...settings,
    models: settings.models.map((model) => ({
      ...model,
      apiKey: undefined,
    })),
    defaultModel: settings.defaultModel ? {
      ...settings.defaultModel,
      apiKey: undefined,
    } : undefined,
  }
}

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/api/settings/public', async () => {
    const settings = await readSystemSettings(app.context.db)
    return {
      site: settings.site,
      auth: {
        registrationOpen: settings.auth.registrationOpen,
      },
      storage: {
        provider: settings.storage.provider,
        s3Enabled: settings.storage.s3Enabled,
      },
    }
  })

  app.get('/api/admin/settings', { preHandler: requireAdmin }, async () => {
    return { settings: sanitizeSystemSettings(await readSystemSettings(app.context.db)) }
  })

  app.put('/api/admin/settings/site', { preHandler: requireAdmin }, async (request) => {
    const body = z.object({
      appName: z.string().trim().min(1).max(60),
    }).parse(request.body)
    await writeSetting(app.context.db, 'site', body, request.user.id)
    await writeAuditLog(app.context.db, request.user, 'settings.site.update', 'system_settings', 'site')
    return { settings: sanitizeSystemSettings(await readSystemSettings(app.context.db)) }
  })

  app.put('/api/admin/settings/auth', { preHandler: requireAdmin }, async (request) => {
    const body = z.object({
      registrationOpen: z.boolean(),
      defaultCredits: z.coerce.number().min(0),
      defaultMultiplier: z.coerce.number().min(0),
    }).parse(request.body)
    await writeSetting(app.context.db, 'auth', body, request.user.id)
    await writeAuditLog(app.context.db, request.user, 'settings.auth.update', 'system_settings', 'auth')
    return { settings: sanitizeSystemSettings(await readSystemSettings(app.context.db)) }
  })

  app.put('/api/admin/settings/queue', { preHandler: requireAdmin }, async (request) => {
    const body = z.object({
      globalConcurrency: z.coerce.number().int().min(1).max(100),
      defaultUserConcurrency: z.coerce.number().int().min(1).max(100),
      maxQueueSize: z.coerce.number().int().min(1).max(10000),
    }).parse(request.body)
    await writeSetting(app.context.db, 'queue', body, request.user.id)
    await writeAuditLog(app.context.db, request.user, 'settings.queue.update', 'system_settings', 'queue')
    return { settings: sanitizeSystemSettings(await readSystemSettings(app.context.db)) }
  })

  app.get('/api/admin/model-profiles', { preHandler: requireAdmin }, async () => {
    const settings = await readSystemSettings(app.context.db)
    return { items: sanitizeSystemSettings(settings).models }
  })

  app.put('/api/admin/model-profiles', { preHandler: requireAdmin }, async (request) => {
    const body = z.object({
      items: z.array(z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(60),
        provider: z.literal('openai-compatible').default('openai-compatible'),
        baseUrl: z.string().trim().url('API URL 格式不正确'),
        apiKey: z.string().trim().optional(),
        model: z.string().trim().min(1).max(120),
        apiMode: z.enum(['images', 'responses']).default('images'),
        timeoutSeconds: z.coerce.number().int().min(10).max(900).default(120),
        enabled: z.boolean().default(true),
        isDefault: z.boolean().default(false),
      })).min(1).max(20),
    }).parse(request.body)
    const defaultCount = body.items.filter((item) => item.enabled && item.isDefault).length
    if (defaultCount !== 1) {
      throw badRequest('必须设置一个启用的默认模型')
    }
    const existing = await app.context.db.query('select id::text, api_key from model_profiles')
    const existingKeys = new Map(existing.rows.map((row) => [row.id, row.api_key]))
    await withTransaction(app.context.db, async (client) => {
      await client.query('update model_profiles set is_default = false')
      const keptIds: string[] = []
      for (const item of body.items) {
        const apiKey = item.apiKey?.trim() || (item.id ? existingKeys.get(item.id) : undefined) || null
        if (item.id) {
          keptIds.push(item.id)
          await client.query(
            `
              update model_profiles
              set name = $2, provider = $3, base_url = $4, api_key = $5, model = $6,
                  api_mode = $7, timeout_seconds = $8, enabled = $9, is_default = $10,
                  updated_at = now(), updated_by = $11
              where id = $1
            `,
            [item.id, item.name, item.provider, item.baseUrl, apiKey, item.model, item.apiMode, item.timeoutSeconds, item.enabled, item.isDefault, request.user.id],
          )
        } else {
          const created = await client.query<{ id: string }>(
            `
              insert into model_profiles (name, provider, base_url, api_key, model, api_mode, timeout_seconds, enabled, is_default, updated_by)
              values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
              returning id::text
            `,
            [item.name, item.provider, item.baseUrl, apiKey, item.model, item.apiMode, item.timeoutSeconds, item.enabled, item.isDefault, request.user.id],
          )
          keptIds.push(created.rows[0].id)
        }
      }
      await client.query('delete from model_profiles where not (id = any($1::uuid[]))', [keptIds])
    })
    await writeAuditLog(app.context.db, request.user, 'model_profiles.update', 'model_profiles')
    return { settings: sanitizeSystemSettings(await readSystemSettings(app.context.db)) }
  })

  app.get('/api/admin/audit-logs', { preHandler: requireAdmin }, async (request) => {
    const query = z.object({
      page: z.coerce.number().int().positive().default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(50),
      action: z.string().trim().optional(),
    }).parse(request.query)
    const values: unknown[] = []
    const where: string[] = []
    if (query.action) {
      values.push(`%${query.action}%`)
      where.push(`action ilike $${values.length}`)
    }
    values.push(query.pageSize, (query.page - 1) * query.pageSize)
    const result = await app.context.db.query(
      `
        select id::text, actor_id::text, actor_username, action, target_type, target_id, detail, created_at,
               count(*) over() as total
        from audit_logs
        ${where.length ? `where ${where.join(' and ')}` : ''}
        order by created_at desc
        limit $${values.length - 1} offset $${values.length}
      `,
      values,
    )
    return {
      items: result.rows.map((row) => ({
        id: row.id,
        actorId: row.actor_id,
        actorUsername: row.actor_username,
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        detail: row.detail,
        createdAt: new Date(row.created_at).getTime(),
      })),
      total: Number(result.rows[0]?.total ?? 0),
    }
  })
}
