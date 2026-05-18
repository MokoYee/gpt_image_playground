import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../auth.js'
import { readSystemSettings, writeSetting } from '../services/settings.js'

export async function registerSettingsRoutes(app: FastifyInstance) {
  app.get('/api/settings/public', async () => {
    const settings = await readSystemSettings(app.context.db)
    return {
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
    return { settings: await readSystemSettings(app.context.db) }
  })

  app.put('/api/admin/settings/auth', { preHandler: requireAdmin }, async (request) => {
    const body = z.object({
      registrationOpen: z.boolean(),
      defaultCredits: z.coerce.number().min(0),
      defaultMultiplier: z.coerce.number().min(0),
    }).parse(request.body)
    await writeSetting(app.context.db, 'auth', body, request.user.id)
    return { settings: await readSystemSettings(app.context.db) }
  })

  app.put('/api/admin/settings/image-api', { preHandler: requireAdmin }, async (request) => {
    const body = z.object({
      provider: z.literal('openai-compatible').default('openai-compatible'),
      baseUrl: z.string().trim().refine((value) => value === '' || z.string().url().safeParse(value).success, 'API URL 格式不正确').optional().default(''),
      apiKey: z.string().trim().optional(),
      model: z.string().trim().optional().default(''),
      apiMode: z.enum(['images', 'responses']).default('images'),
      timeoutSeconds: z.coerce.number().int().min(10).max(900).default(120),
    }).parse(request.body)
    const current = await readSystemSettings(app.context.db)
    await writeSetting(app.context.db, 'imageApi', {
      ...body,
      apiKey: body.apiKey?.trim() ? body.apiKey.trim() : current.imageApi.apiKey,
    }, request.user.id)
    return { settings: await readSystemSettings(app.context.db) }
  })
}
