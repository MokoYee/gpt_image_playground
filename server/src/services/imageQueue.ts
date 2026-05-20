import type { DbClient, DbPool } from '../db.js'
import { withTransaction } from '../db.js'
import { callImageProvider, type TaskParams } from './imageProxy.js'
import { readStoredImageAsDataUrl, storeImageFile } from './imageStorage.js'
import { readSystemSettings } from './settings.js'

const STUCK_RUNNING_MS = 15 * 60 * 1000

interface ImageQueueConfig {
  storageRoot: string
  logger?: {
    info: (value: unknown, message?: string) => void
    error: (value: unknown, message?: string) => void
  }
}

interface QueuedTaskRow {
  id: string
  user_id: string
  prompt: string
  params: TaskParams
  api_provider: string
  api_model: string
}

function baseCredits(quality: TaskParams['quality']): number {
  if (quality === 'low') return 1
  if (quality === 'high') return 4
  return 2
}

export function calculateCredits(params: TaskParams, multiplier: number, imageCount = params.n): number {
  return Number((baseCredits(params.quality) * Math.max(1, imageCount) * multiplier).toFixed(4))
}

function mapParams(value: unknown): TaskParams {
  return value as TaskParams
}

function mapActualParamsByImage(fileIds: string[], actualParamsList?: Array<Partial<TaskParams> | undefined>): Record<string, Partial<TaskParams>> | null {
  if (!actualParamsList?.length) return null
  const result: Record<string, Partial<TaskParams>> = {}
  for (let index = 0; index < fileIds.length; index++) {
    const params = actualParamsList[index]
    if (params && Object.keys(params).length) result[fileIds[index]] = params
  }
  return Object.keys(result).length ? result : null
}

function mapRevisedPromptByImage(fileIds: string[], revisedPrompts?: Array<string | undefined>): Record<string, string> | null {
  if (!revisedPrompts?.length) return null
  const result: Record<string, string> = {}
  for (let index = 0; index < fileIds.length; index++) {
    const revised = revisedPrompts[index]?.trim()
    if (revised) result[fileIds[index]] = revised
  }
  return Object.keys(result).length ? result : null
}

export class ImageQueueWorker {
  private wakeTimer: NodeJS.Timeout | null = null
  private scanTimer: NodeJS.Timeout | null = null
  private running = false
  private stopped = false

  constructor(private readonly pool: DbPool, private readonly config: ImageQueueConfig) {}

  start() {
    this.stopped = false
    this.wake()
    this.scanTimer = setInterval(() => {
      void this.markStuckTasks().finally(() => this.wake())
    }, 60_000)
  }

  stop() {
    this.stopped = true
    if (this.wakeTimer) clearTimeout(this.wakeTimer)
    if (this.scanTimer) clearInterval(this.scanTimer)
    this.wakeTimer = null
    this.scanTimer = null
  }

  wake() {
    if (this.stopped || this.wakeTimer) return
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null
      void this.drain()
    }, 20)
  }

  private async drain() {
    if (this.running || this.stopped) return
    this.running = true
    try {
      while (!this.stopped) {
        const task = await this.claimNextTask()
        if (!task) break
        void this.executeTask(task).finally(() => this.wake())
      }
    } catch (error) {
      this.config.logger?.error(error, 'image queue drain failed')
    } finally {
      this.running = false
    }
  }

  private async claimNextTask(): Promise<QueuedTaskRow | null> {
    return withTransaction(this.pool, async (client) => {
      const settings = await readSystemSettings(client)
      const globalRunning = await client.query<{ count: string }>("select count(*) from image_tasks where status = 'running'")
      if (Number(globalRunning.rows[0]?.count ?? 0) >= settings.queue.globalConcurrency) return null

      const candidate = await client.query<QueuedTaskRow & { user_running: string; concurrency_limit: number | null }>(
        `
          select t.id::text, t.user_id::text, t.prompt, t.params, t.api_provider, t.api_model,
                 w.concurrency_limit,
                 (
                   select count(*) from image_tasks running
                   where running.user_id = t.user_id and running.status = 'running'
                 ) as user_running
          from image_tasks t
          join user_wallets w on w.user_id = t.user_id
          join users u on u.id = t.user_id
          where t.status = 'queued' and u.status = 'enabled'
          order by t.queued_at asc nulls last, t.created_at asc
          for update of t skip locked
          limit 20
        `,
      )

      for (const row of candidate.rows) {
        const limit = row.concurrency_limit ?? settings.queue.defaultUserConcurrency
        if (Number(row.user_running) >= limit) continue
        await client.query(
          `
            update image_tasks
            set status = 'running', started_at = now(), last_heartbeat_at = now()
            where id = $1 and status = 'queued'
          `,
          [row.id],
        )
        return {
          id: row.id,
          user_id: row.user_id,
          prompt: row.prompt,
          params: mapParams(row.params),
          api_provider: row.api_provider,
          api_model: row.api_model,
        }
      }

      return null
    })
  }

  private async executeTask(task: QueuedTaskRow) {
    const startedAt = Date.now()
    try {
      const settings = await readSystemSettings(this.pool)
      const modelProfile = settings.models.find((model) =>
        model.enabled &&
        model.provider === task.api_provider &&
        model.model === task.api_model
      ) ?? (settings.defaultModel ? { ...settings.defaultModel, provider: task.api_provider as 'openai-compatible', model: task.api_model } : undefined)
      if (!modelProfile) throw new Error('管理员尚未配置启用的默认模型服务')
      const inputImages = await this.readTaskImages(task.id, 'upload')
      const maskImages = await this.readTaskImages(task.id, 'mask')

      const providerResult = await callImageProvider(modelProfile, {
        prompt: task.prompt,
        params: task.params,
        inputImageDataUrls: inputImages,
        maskDataUrl: maskImages[0],
      })
      const elapsed = Date.now() - startedAt
      const actualImageCount = providerResult.images.length

      await withTransaction(this.pool, async (client) => {
        const lockedWallet = await client.query('select multiplier from user_wallets where user_id = $1 for update', [task.user_id])
        const multiplier = Number(lockedWallet.rows[0]?.multiplier ?? 1)
        const totalCredits = calculateCredits(task.params, multiplier, actualImageCount)
        const reservedResult = await client.query<{ credits_reserved: string }>('select credits_reserved from image_tasks where id = $1 for update', [task.id])
        const reservedCredits = Number(reservedResult.rows[0]?.credits_reserved ?? 0)
        const diffCredits = Number((totalCredits - reservedCredits).toFixed(4))
        if (diffCredits > 0) {
          const wallet = await client.query('select credits from user_wallets where user_id = $1 for update', [task.user_id])
          const credits = Number(wallet.rows[0]?.credits ?? 0)
          if (credits < diffCredits) throw new Error(`Credits 不足，本次还需要 ${diffCredits} Credits`)
          await client.query(
            'update user_wallets set credits = credits - $1, updated_at = now(), version = version + 1 where user_id = $2',
            [diffCredits, task.user_id],
          )
        } else if (diffCredits < 0) {
          await client.query(
            'update user_wallets set credits = credits + $1, updated_at = now(), version = version + 1 where user_id = $2',
            [Math.abs(diffCredits), task.user_id],
          )
        }

        const storedImages = []
        for (const image of providerResult.images) {
          storedImages.push(await storeImageFile(client, {
            userId: task.user_id,
            taskId: task.id,
            dataUrl: image,
            source: 'generated',
            storageRoot: this.config.storageRoot,
          }))
        }
        const outputFileIds = storedImages.map((image) => image.id)
        const actualParamsByImage = mapActualParamsByImage(outputFileIds, providerResult.actualParamsList)
        const revisedPromptByImage = mapRevisedPromptByImage(outputFileIds, providerResult.revisedPrompts)

        await client.query(
          `
            insert into usage_records (user_id, task_id, prompt, quality, image_count, base_credits, multiplier, total_credits)
            values ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [task.user_id, task.id, task.prompt, task.params.quality, actualImageCount, baseCredits(task.params.quality), multiplier, totalCredits],
        )
        await client.query('update users set last_active_at = now(), updated_at = now() where id = $1', [task.user_id])
        await client.query(
          `
            update image_tasks
            set status = 'done',
                elapsed_ms = $2,
                finished_at = now(),
                last_heartbeat_at = now(),
                credits_reserved = 0,
                credits_charged = $3,
                image_count = $4,
                raw_image_urls = $5::jsonb,
                actual_params = $6::jsonb,
                actual_params_by_image = $7::jsonb,
                revised_prompt_by_image = $8::jsonb
            where id = $1 and status = 'running'
          `,
          [
            task.id,
            elapsed,
            totalCredits,
            actualImageCount,
            JSON.stringify(providerResult.rawImageUrls ?? []),
            JSON.stringify(providerResult.actualParams ?? null),
            JSON.stringify(actualParamsByImage),
            JSON.stringify(revisedPromptByImage),
          ],
        )
      })
    } catch (error) {
      await this.markTaskError(task.id, error instanceof Error ? error.message : String(error))
    }
  }

  private async readTaskImages(taskId: string, source: 'upload' | 'mask'): Promise<string[]> {
    const result = await this.pool.query<{ relative_path: string; mime_type: string }>(
      `
        select relative_path, mime_type
        from image_files
        where task_id = $1 and source = $2
        order by created_at asc, id asc
      `,
      [taskId, source],
    )
    const images: string[] = []
    for (const row of result.rows) {
      images.push(await readStoredImageAsDataUrl(this.config.storageRoot, row.relative_path, row.mime_type))
    }
    return images
  }

  private async markTaskError(taskId: string, message: string) {
    await withTransaction(this.pool, async (client) => {
      const task = await client.query<{ user_id: string; credits_reserved: string }>(
        "select user_id::text, credits_reserved from image_tasks where id = $1 and status in ('queued', 'running') for update",
        [taskId],
      )
      const row = task.rows[0]
      if (!row) return
      const reservedCredits = Number(row.credits_reserved ?? 0)
      if (reservedCredits > 0) {
        await client.query(
          'update user_wallets set credits = credits + $1, updated_at = now(), version = version + 1 where user_id = $2',
          [reservedCredits, row.user_id],
        )
      }
      await client.query(
        `
          update image_tasks
          set status = 'error',
              error = $2,
              finished_at = now(),
              last_heartbeat_at = now(),
              credits_reserved = 0
          where id = $1 and status in ('queued', 'running')
        `,
        [taskId, message],
      )
    })
  }

  private async markStuckTasks() {
    const cutoff = new Date(Date.now() - STUCK_RUNNING_MS)
    const stuck = await this.pool.query<{ id: string }>(
      `
        select id::text from image_tasks
        where status = 'running'
          and coalesce(last_heartbeat_at, started_at, created_at) < $1
      `,
      [cutoff],
    )
    for (const row of stuck.rows) {
      await this.markTaskError(row.id, '任务执行超时，请重试')
    }
  }
}

export async function refreshQueuePositions(client: DbClient): Promise<void> {
  await client.query(`
    with ranked as (
      select id, row_number() over (order by queued_at asc nulls last, created_at asc) as position
      from image_tasks
      where status = 'queued'
    )
    update image_tasks t
    set queue_position_snapshot = ranked.position
    from ranked
    where ranked.id = t.id
  `)
}
