import type { FastifyInstance } from 'fastify'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { z } from 'zod'
import { requireAdmin, requireAuth } from '../auth.js'
import { badRequest, forbidden, notFound } from '../errors.js'
import { withTransaction } from '../db.js'
import { calculateCredits, refreshQueuePositions } from '../services/imageQueue.js'
import { mapStoredFileRow, resolveStoredImagePath, storeImageFile } from '../services/imageStorage.js'
import { readSystemSettings } from '../services/settings.js'
import { PaginationSchema, toOffset } from '../validators.js'
import { writeAuditLog } from '../services/audit.js'

const TaskParamsSchema = z.object({
  size: z.string().min(1),
  quality: z.enum(['auto', 'low', 'medium', 'high']),
  output_format: z.enum(['png', 'jpeg', 'webp']),
  output_compression: z.number().int().min(0).max(100).nullable(),
  moderation: z.enum(['auto', 'low']),
  n: z.number().int().min(1).max(10),
})

const GenerateSchema = z.object({
  localTaskId: z.string().trim().min(1).max(120).optional(),
  prompt: z.string().trim().min(1),
  params: TaskParamsSchema,
  inputImageDataUrls: z.array(z.string().startsWith('data:')).default([]),
  maskDataUrl: z.string().startsWith('data:').optional(),
})

const FILE_LINK_TTL_MS = 10 * 60 * 1000

function toMillis(value: unknown): number | null {
  return value instanceof Date ? value.getTime() : value ? new Date(String(value)).getTime() : null
}

function mapTask(row: any, images: any[] = []) {
  const outputImages = images.filter((image) => image.source === 'generated').map(mapStoredFileRow)
  const inputImages = images.filter((image) => image.source === 'upload').map(mapStoredFileRow)
  const maskImages = images.filter((image) => image.source === 'mask').map(mapStoredFileRow)
  return {
    id: row.id,
    localTaskId: row.local_task_id,
    userId: row.user_id,
    username: row.username,
    prompt: row.prompt,
    params: row.params,
    apiProvider: row.api_provider,
    apiModel: row.api_model,
    status: row.status,
    error: row.error,
    elapsed: row.elapsed_ms == null ? null : Number(row.elapsed_ms),
    createdAt: toMillis(row.created_at),
    queuedAt: toMillis(row.queued_at),
    startedAt: toMillis(row.started_at),
    finishedAt: toMillis(row.finished_at),
    cancelledAt: toMillis(row.cancelled_at),
    cancelReason: row.cancel_reason,
    queuePosition: row.queue_position_snapshot == null ? null : Number(row.queue_position_snapshot),
    creditsEstimated: row.credits_estimated == null ? null : Number(row.credits_estimated),
    creditsReserved: row.credits_reserved == null ? 0 : Number(row.credits_reserved),
    creditsCharged: row.credits_charged == null ? null : Number(row.credits_charged),
    imageCount: row.image_count == null ? null : Number(row.image_count),
    hiddenAt: toMillis(row.hidden_at),
    favoriteAt: toMillis(row.favorite_at),
    isFavorite: Boolean(row.favorite_at),
    rawImageUrls: Array.isArray(row.raw_image_urls) ? row.raw_image_urls : [],
    actualParams: row.actual_params ?? undefined,
    actualParamsByImage: row.actual_params_by_image ?? undefined,
    revisedPromptByImage: row.revised_prompt_by_image ?? undefined,
    outputImages,
    inputImages,
    maskImages,
  }
}

async function loadTaskImages(app: FastifyInstance, taskIds: string[]) {
  if (!taskIds.length) return new Map<string, any[]>()
  const result = await app.context.db.query(
    `
      select id::text, task_id::text, source, relative_path, sha256, mime_type, size_bytes, width, height, created_at
      from image_files
      where task_id = any($1::uuid[])
      order by created_at asc, id asc
    `,
    [taskIds],
  )
  const map = new Map<string, any[]>()
  for (const row of result.rows) {
    const list = map.get(row.task_id) ?? []
    list.push(row)
    map.set(row.task_id, list)
  }
  return map
}

async function getQueueCounts(app: FastifyInstance, userId: string) {
  const result = await app.context.db.query<{ queued: string; running: string }>(
    `
      select
        count(*) filter (where status = 'queued') as queued,
        count(*) filter (where status = 'running') as running
      from image_tasks
      where user_id = $1 and status in ('queued', 'running')
    `,
    [userId],
  )
  return {
    queued: Number(result.rows[0]?.queued ?? 0),
    running: Number(result.rows[0]?.running ?? 0),
  }
}

function signFileToken(secret: string, fileId: string, expiresAt: number): string {
  const payload = `${fileId}.${expiresAt}`
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${expiresAt}.${signature}`
}

function verifyFileToken(secret: string, fileId: string, token: string): boolean {
  const [expiresAtText, signature] = token.split('.')
  const expiresAt = Number(expiresAtText)
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now() || !signature) return false
  const expected = signFileToken(secret, fileId, expiresAt).split('.')[1]
  const expectedBytes = Buffer.from(expected)
  const actualBytes = Buffer.from(signature)
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes)
}

async function loadImageFile(app: FastifyInstance, fileId: string) {
  const result = await app.context.db.query(
    'select id::text, user_id::text, relative_path, mime_type from image_files where id = $1',
    [fileId],
  )
  return result.rows[0] ?? null
}

async function authorizeImageFile(app: FastifyInstance, request: FastifyRequest, reply: FastifyReply, row: any, fileId: string) {
  const query = z.object({ token: z.string().optional() }).parse(request.query)
  if (query.token && verifyFileToken(app.context.config.JWT_SECRET, fileId, query.token)) return
  await requireAuth(request, reply)
  if (row.user_id !== request.user.id && request.user.role !== 'admin') throw forbidden('无权查看该图片')
}

async function createQueuedTask(app: FastifyInstance, userId: string, body: z.infer<typeof GenerateSchema>) {
  const settings = await readSystemSettings(app.context.db)
  if (body.localTaskId) {
    const existing = await app.context.db.query<{ id: string; status: string }>(
      'select id::text, status from image_tasks where user_id = $1 and local_task_id = $2',
      [userId, body.localTaskId],
    )
    if (existing.rows[0]) {
      app.imageQueue?.wake()
      return existing.rows[0].id
    }
  }
  const wallet = await app.context.db.query('select credits, multiplier from user_wallets where user_id = $1', [userId])
  const currentCredits = Number(wallet.rows[0]?.credits ?? 0)
  const multiplier = Number(wallet.rows[0]?.multiplier ?? 1)
  const estimatedCredits = calculateCredits(body.params, multiplier)
  if (currentCredits < estimatedCredits) throw badRequest(`Credits 不足，本次预计消耗 ${estimatedCredits} Credits`)

  const currentQueue = await app.context.db.query<{ count: string }>(
    "select count(*) from image_tasks where user_id = $1 and status in ('queued', 'running')",
    [userId],
  )
  if (Number(currentQueue.rows[0]?.count ?? 0) >= settings.queue.maxQueueSize) throw badRequest('当前排队任务较多，请稍后再试')

  const task = await withTransaction(app.context.db, async (client) => {
    if (body.localTaskId) {
      const existing = await client.query<{ id: string }>(
        'select id::text from image_tasks where user_id = $1 and local_task_id = $2 for update',
        [userId, body.localTaskId],
      )
      if (existing.rows[0]) return existing.rows[0]
    }
    const lockedWallet = await client.query('select credits, multiplier from user_wallets where user_id = $1 for update', [userId])
    const lockedCredits = Number(lockedWallet.rows[0]?.credits ?? 0)
    const lockedMultiplier = Number(lockedWallet.rows[0]?.multiplier ?? multiplier)
    const lockedEstimatedCredits = calculateCredits(body.params, lockedMultiplier)
    if (lockedCredits < lockedEstimatedCredits) throw badRequest(`Credits 不足，本次预计消耗 ${lockedEstimatedCredits} Credits`)

    const created = await client.query<{ id: string }>(
      `
        insert into image_tasks (
          user_id, local_task_id, prompt, params, api_provider, api_model, status,
          queued_at, credits_estimated, credits_reserved, image_count
        )
        values ($1, $2, $3, $4::jsonb, $5, $6, 'queued', now(), $7, $7, $8)
        on conflict (user_id, local_task_id) where local_task_id is not null
        do nothing
        returning id::text
      `,
      [
        userId,
        body.localTaskId ?? null,
        body.prompt,
        JSON.stringify(body.params),
        settings.imageApi.provider,
        settings.imageApi.model,
        lockedEstimatedCredits,
        body.params.n,
      ],
    )
    if (!created.rows[0] && body.localTaskId) {
      const existing = await client.query<{ id: string }>(
        'select id::text from image_tasks where user_id = $1 and local_task_id = $2',
        [userId, body.localTaskId],
      )
      if (existing.rows[0]) return existing.rows[0]
    }
    const taskId = created.rows[0].id
    await client.query(
      'update user_wallets set credits = credits - $1, updated_at = now(), version = version + 1 where user_id = $2',
      [lockedEstimatedCredits, userId],
    )
    for (const dataUrl of body.inputImageDataUrls) {
      await storeImageFile(client, {
        userId,
        taskId,
        dataUrl,
        source: 'upload',
        storageRoot: app.context.config.IMAGE_STORAGE_PATH,
      })
    }
    if (body.maskDataUrl) {
      await storeImageFile(client, {
        userId,
        taskId,
        dataUrl: body.maskDataUrl,
        source: 'mask',
        storageRoot: app.context.config.IMAGE_STORAGE_PATH,
      })
    }
    await refreshQueuePositions(client)
    return created.rows[0]
  })
  app.imageQueue?.wake()
  return task.id
}

export async function registerImageRoutes(app: FastifyInstance) {
  app.post('/api/images/tasks', { preHandler: requireAuth }, async (request) => {
    const body = GenerateSchema.parse(request.body)
    const taskId = await createQueuedTask(app, request.user.id, body)
    await writeAuditLog(app.context.db, request.user, 'image.task.create', 'image_task', taskId)
    const counts = await getQueueCounts(app, request.user.id)
    return { taskId, status: 'queued', queue: counts }
  })

  app.post('/api/images/generate', { preHandler: requireAuth }, async (request) => {
    const body = GenerateSchema.parse(request.body)
    const taskId = await createQueuedTask(app, request.user.id, body)
    await writeAuditLog(app.context.db, request.user, 'image.task.create', 'image_task', taskId)
    const counts = await getQueueCounts(app, request.user.id)
    return { taskId, status: 'queued', queue: counts }
  })

  app.get('/api/images/tasks/:taskId', { preHandler: requireAuth }, async (request) => {
    const params = z.object({ taskId: z.string().uuid() }).parse(request.params)
    const result = await app.context.db.query(
      `
        select t.*, t.id::text, t.user_id::text, u.username
        from image_tasks t
        join users u on u.id = t.user_id
        where t.id = $1
      `,
      [params.taskId],
    )
    const row = result.rows[0]
    if (!row) throw notFound('任务不存在')
    if (row.user_id !== request.user.id && request.user.role !== 'admin') throw forbidden('无权查看该任务')
    const imageMap = await loadTaskImages(app, [params.taskId])
    return { task: mapTask(row, imageMap.get(params.taskId) ?? []) }
  })

  app.get('/api/me/image-tasks/active', { preHandler: requireAuth }, async (request) => {
    const result = await app.context.db.query(
      `
        select t.*, t.id::text, t.user_id::text, u.username
        from image_tasks t
        join users u on u.id = t.user_id
        where t.user_id = $1 and t.status in ('queued', 'running')
        order by t.queued_at asc nulls last, t.created_at asc
      `,
      [request.user.id],
    )
    const imageMap = await loadTaskImages(app, result.rows.map((row) => row.id))
    return {
      items: result.rows.map((row) => mapTask(row, imageMap.get(row.id) ?? [])),
      queue: await getQueueCounts(app, request.user.id),
    }
  })

  app.get('/api/me/image-tasks', { preHandler: requireAuth }, async (request) => {
    const query = PaginationSchema.parse(request.query)
    const result = await app.context.db.query(
      `
        select t.*, t.id::text, t.user_id::text, u.username, count(*) over() as total
        from image_tasks t
        join users u on u.id = t.user_id
        where t.user_id = $1 and t.hidden_at is null
        order by t.created_at desc
        limit $2 offset $3
      `,
      [request.user.id, query.pageSize, toOffset(query.page, query.pageSize)],
    )
    const imageMap = await loadTaskImages(app, result.rows.map((row) => row.id))
    return {
      items: result.rows.map((row) => mapTask(row, imageMap.get(row.id) ?? [])),
      total: Number(result.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    }
  })

  app.post('/api/images/tasks/:taskId/cancel', { preHandler: requireAuth }, async (request) => {
    const params = z.object({ taskId: z.string().uuid() }).parse(request.params)
    const result = await withTransaction(app.context.db, async (client) => {
      const task = await client.query('select user_id::text, status, credits_reserved from image_tasks where id = $1 for update', [params.taskId])
      const row = task.rows[0]
      if (!row) throw notFound('任务不存在')
      if (row.user_id !== request.user.id && request.user.role !== 'admin') throw forbidden('无权取消该任务')
      if (row.status !== 'queued') throw badRequest('只能取消排队中的任务')
      const reserved = Number(row.credits_reserved ?? 0)
      if (reserved > 0) {
        await client.query(
          'update user_wallets set credits = credits + $1, updated_at = now(), version = version + 1 where user_id = $2',
          [reserved, row.user_id],
        )
      }
      await client.query(
        `
          update image_tasks
          set status = 'cancelled',
              cancelled_at = now(),
              finished_at = now(),
              cancel_reason = '用户取消',
              credits_reserved = 0
          where id = $1
        `,
        [params.taskId],
      )
      await refreshQueuePositions(client)
      return { ok: true }
    })
    app.imageQueue?.wake()
    await writeAuditLog(app.context.db, request.user, 'image.task.cancel', 'image_task', params.taskId)
    return result
  })

  app.patch('/api/images/tasks/:taskId/favorite', { preHandler: requireAuth }, async (request) => {
    const params = z.object({ taskId: z.string().uuid() }).parse(request.params)
    const body = z.object({ favorite: z.boolean() }).parse(request.body)
    const result = await app.context.db.query(
      `
        update image_tasks
        set favorite_at = case when $3 then now() else null end
        where id = $1 and user_id = $2 and hidden_at is null
        returning id::text
      `,
      [params.taskId, request.user.id, body.favorite],
    )
    if (!result.rows[0]) throw notFound('任务不存在')
    await writeAuditLog(app.context.db, request.user, body.favorite ? 'image.task.favorite' : 'image.task.unfavorite', 'image_task', params.taskId)
    return { ok: true }
  })

  app.delete('/api/images/tasks/:taskId', { preHandler: requireAuth }, async (request) => {
    const params = z.object({ taskId: z.string().uuid() }).parse(request.params)
    const result = await app.context.db.query(
      `
        update image_tasks
        set hidden_at = now()
        where id = $1 and user_id = $2 and status in ('done', 'error', 'cancelled')
        returning id::text
      `,
      [params.taskId, request.user.id],
    )
    if (!result.rows[0]) throw notFound('任务不存在或暂不可删除')
    await writeAuditLog(app.context.db, request.user, 'image.task.hide', 'image_task', params.taskId)
    return { ok: true }
  })

  app.get('/api/admin/image-tasks', { preHandler: requireAdmin }, async (request) => {
    const query = PaginationSchema.extend({
      userId: z.string().uuid().optional(),
      status: z.enum(['queued', 'running', 'done', 'error', 'cancelled']).optional(),
      model: z.string().trim().optional(),
      quality: z.enum(['auto', 'low', 'medium', 'high']).optional(),
      keyword: z.string().trim().optional(),
      from: z.coerce.number().optional(),
      to: z.coerce.number().optional(),
    }).parse(request.query)
    const values: unknown[] = []
    const where: string[] = []
    if (query.userId) {
      values.push(query.userId)
      where.push(`t.user_id = $${values.length}`)
    }
    if (query.status) {
      values.push(query.status)
      where.push(`t.status = $${values.length}`)
    }
    if (query.model) {
      values.push(`%${query.model}%`)
      where.push(`t.api_model ilike $${values.length}`)
    }
    if (query.quality) {
      values.push(query.quality)
      where.push(`t.params->>'quality' = $${values.length}`)
    }
    if (query.keyword) {
      values.push(`%${query.keyword}%`)
      where.push(`t.prompt ilike $${values.length}`)
    }
    if (query.from) {
      values.push(new Date(query.from))
      where.push(`t.created_at >= $${values.length}`)
    }
    if (query.to) {
      values.push(new Date(query.to))
      where.push(`t.created_at <= $${values.length}`)
    }
    values.push(query.pageSize, toOffset(query.page, query.pageSize))
    const result = await app.context.db.query(
      `
        select t.*, t.id::text, t.user_id::text, u.username, count(*) over() as total
        from image_tasks t
        join users u on u.id = t.user_id
        ${where.length ? `where ${where.join(' and ')}` : ''}
        order by t.created_at desc
        limit $${values.length - 1} offset $${values.length}
      `,
      values,
    )
    const imageMap = await loadTaskImages(app, result.rows.map((row) => row.id))
    return {
      items: result.rows.map((row) => mapTask(row, imageMap.get(row.id) ?? [])),
      total: Number(result.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    }
  })

  app.get('/api/images/files/:fileId/link', { preHandler: requireAuth }, async (request) => {
    const params = z.object({ fileId: z.string().uuid() }).parse(request.params)
    const row = await loadImageFile(app, params.fileId)
    if (!row) throw notFound('图片不存在')
    if (row.user_id !== request.user.id && request.user.role !== 'admin') throw forbidden('无权查看该图片')
    const expiresAt = Date.now() + FILE_LINK_TTL_MS
    return {
      url: `/api/images/files/${params.fileId}?token=${signFileToken(app.context.config.JWT_SECRET, params.fileId, expiresAt)}`,
      expiresAt,
    }
  })

  app.get('/api/images/files/:fileId', async (request, reply) => {
    const params = z.object({ fileId: z.string().uuid() }).parse(request.params)
    const row = await loadImageFile(app, params.fileId)
    if (!row) throw notFound('图片不存在')
    await authorizeImageFile(app, request, reply, row, params.fileId)
    reply.header('Content-Type', row.mime_type)
    return reply.send(createReadStream(resolveStoredImagePath(app.context.config.IMAGE_STORAGE_PATH, row.relative_path)))
  })
}
