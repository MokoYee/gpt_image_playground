import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth.js'
import { badRequest } from '../errors.js'
import { withTransaction } from '../db.js'
import { callImageProvider, type TaskParams } from '../services/imageProxy.js'
import { readSystemSettings } from '../services/settings.js'
import { storeImageFile } from '../services/imageStorage.js'

const TaskParamsSchema = z.object({
  size: z.string().min(1),
  quality: z.enum(['auto', 'low', 'medium', 'high']),
  output_format: z.enum(['png', 'jpeg', 'webp']),
  output_compression: z.number().int().min(0).max(100).nullable(),
  moderation: z.enum(['auto', 'low']),
  n: z.number().int().min(1).max(10),
})

const GenerateSchema = z.object({
  prompt: z.string().trim().min(1),
  params: TaskParamsSchema,
  inputImageDataUrls: z.array(z.string().startsWith('data:')).default([]),
  maskDataUrl: z.string().startsWith('data:').optional(),
})

function baseCredits(quality: TaskParams['quality']): number {
  if (quality === 'low') return 1
  if (quality === 'high') return 4
  return 2
}

function calculateCredits(params: TaskParams, multiplier: number, imageCount = params.n): number {
  return Number((baseCredits(params.quality) * Math.max(1, imageCount) * multiplier).toFixed(4))
}

export async function registerImageRoutes(app: FastifyInstance) {
  app.post('/api/images/generate', { preHandler: requireAuth }, async (request) => {
    const body = GenerateSchema.parse(request.body)
    const settings = await readSystemSettings(app.context.db)

    const wallet = await app.context.db.query('select credits, multiplier from user_wallets where user_id = $1', [request.user.id])
    const currentCredits = Number(wallet.rows[0]?.credits ?? 0)
    const multiplier = Number(wallet.rows[0]?.multiplier ?? 1)
    const estimatedCredits = calculateCredits(body.params, multiplier)
    if (currentCredits < estimatedCredits) throw badRequest(`Credits 不足，本次预计消耗 ${estimatedCredits} Credits`)

    const startedAt = Date.now()
    const providerResult = await callImageProvider(settings.imageApi, {
      prompt: body.prompt,
      params: body.params,
      inputImageDataUrls: body.inputImageDataUrls,
      maskDataUrl: body.maskDataUrl,
    })
    const elapsed = Date.now() - startedAt
    const actualImageCount = providerResult.images.length
    const totalCredits = calculateCredits(body.params, multiplier, actualImageCount)

    const result = await withTransaction(app.context.db, async (client) => {
      const lockedWallet = await client.query('select credits, multiplier from user_wallets where user_id = $1 for update', [request.user.id])
      const lockedCredits = Number(lockedWallet.rows[0]?.credits ?? 0)
      const lockedMultiplier = Number(lockedWallet.rows[0]?.multiplier ?? multiplier)
      const lockedTotalCredits = calculateCredits(body.params, lockedMultiplier, actualImageCount)
      if (lockedCredits < lockedTotalCredits) throw badRequest('Credits 不足，生成完成前余额已变化')

      const task = await client.query<{ id: string }>(
        `
          insert into image_tasks (user_id, prompt, params, api_provider, api_model, status, elapsed_ms, finished_at)
          values ($1, $2, $3::jsonb, $4, $5, 'done', $6, now())
          returning id::text
        `,
        [request.user.id, body.prompt, JSON.stringify(body.params), settings.imageApi.provider, settings.imageApi.model, elapsed],
      )
      const taskId = task.rows[0].id
      const storedImages = []
      for (const image of providerResult.images) {
        storedImages.push(await storeImageFile(client, {
          userId: request.user.id,
          taskId,
          dataUrl: image,
          source: 'generated',
          storageRoot: app.context.config.IMAGE_STORAGE_PATH,
        }))
      }
      await client.query(
        'update user_wallets set credits = credits - $1, updated_at = now(), version = version + 1 where user_id = $2',
        [lockedTotalCredits, request.user.id],
      )
      await client.query(
        `
          insert into usage_records (user_id, task_id, prompt, quality, image_count, base_credits, multiplier, total_credits)
          values ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [request.user.id, taskId, body.prompt, body.params.quality, actualImageCount, baseCredits(body.params.quality), lockedMultiplier, lockedTotalCredits],
      )
      return { taskId, storedImages, totalCredits: lockedTotalCredits }
    })

    return {
      taskId: result.taskId,
      images: result.storedImages.map((image) => image.dataUrl),
      imageFileIds: result.storedImages.map((image) => image.id),
      actualParams: providerResult.actualParams,
      actualParamsList: providerResult.actualParamsList,
      revisedPrompts: providerResult.revisedPrompts,
      rawImageUrls: providerResult.rawImageUrls,
      totalCredits: result.totalCredits,
      elapsed,
    }
  })
}
