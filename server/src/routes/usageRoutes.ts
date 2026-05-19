import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { requireAdmin, requireAuth } from '../auth.js'
import { PaginationSchema, toOffset } from '../validators.js'

function mapUsage(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    taskId: row.task_id,
    prompt: row.prompt,
    quality: row.quality,
    imageCount: Number(row.image_count),
    baseCredits: Number(row.base_credits),
    multiplier: Number(row.multiplier),
    totalCredits: Number(row.total_credits),
    createdAt: new Date(row.created_at).getTime(),
    apiModel: row.api_model,
    taskStatus: row.task_status,
    elapsed: row.elapsed_ms == null ? null : Number(row.elapsed_ms),
    imageFiles: Array.isArray(row.image_files) ? row.image_files : [],
  }
}

export async function registerUsageRoutes(app: FastifyInstance) {
  app.get('/api/me/usage-records', { preHandler: requireAuth }, async (request) => {
    const query = PaginationSchema.parse(request.query)
    const result = await app.context.db.query(
      `
        select ur.id::text, ur.user_id::text, u.username, ur.task_id::text, ur.prompt, ur.quality, ur.image_count,
               ur.base_credits, ur.multiplier, ur.total_credits, ur.created_at,
               it.api_model, it.status as task_status, it.elapsed_ms,
               coalesce(
                 jsonb_agg(
                   jsonb_build_object(
                     'id', img.id::text,
                     'mimeType', img.mime_type,
                     'width', img.width,
                     'height', img.height
                   )
                   order by img.created_at asc
                 ) filter (where img.id is not null),
                 '[]'::jsonb
               ) as image_files,
               count(*) over() as total
        from usage_records ur
        join users u on u.id = ur.user_id
        left join image_tasks it on it.id = ur.task_id
        left join image_files img on img.task_id = ur.task_id and img.source = 'generated'
        where ur.user_id = $1
        group by ur.id, u.username, it.api_model, it.status, it.elapsed_ms
        order by ur.created_at desc
        limit $2 offset $3
      `,
      [request.user.id, query.pageSize, toOffset(query.page, query.pageSize)],
    )
    return {
      items: result.rows.map(mapUsage),
      total: Number(result.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    }
  })

  app.get('/api/admin/usage-records', { preHandler: requireAdmin }, async (request) => {
    const query = PaginationSchema.extend({
      userId: z.string().uuid().optional(),
      model: z.string().trim().optional(),
      quality: z.enum(['auto', 'low', 'medium', 'high']).optional(),
      status: z.enum(['queued', 'running', 'done', 'error', 'cancelled']).optional(),
      keyword: z.string().trim().optional(),
      from: z.coerce.number().optional(),
      to: z.coerce.number().optional(),
    }).parse(request.query)
    const params: unknown[] = []
    const where: string[] = []
    if (query.userId) {
      params.push(query.userId)
      where.push(`ur.user_id = $${params.length}`)
    }
    if (query.model) {
      params.push(`%${query.model}%`)
      where.push(`it.api_model ilike $${params.length}`)
    }
    if (query.quality) {
      params.push(query.quality)
      where.push(`ur.quality = $${params.length}`)
    }
    if (query.status) {
      params.push(query.status)
      where.push(`it.status = $${params.length}`)
    }
    if (query.keyword) {
      params.push(`%${query.keyword}%`)
      where.push(`ur.prompt ilike $${params.length}`)
    }
    if (query.from) {
      params.push(new Date(query.from))
      where.push(`ur.created_at >= $${params.length}`)
    }
    if (query.to) {
      params.push(new Date(query.to))
      where.push(`ur.created_at <= $${params.length}`)
    }
    params.push(query.pageSize, toOffset(query.page, query.pageSize))
    const result = await app.context.db.query(
      `
        select ur.id::text, ur.user_id::text, u.username, ur.task_id::text, ur.prompt, ur.quality, ur.image_count,
               ur.base_credits, ur.multiplier, ur.total_credits, ur.created_at,
               it.api_model, it.status as task_status, it.elapsed_ms,
               coalesce(
                 jsonb_agg(
                   jsonb_build_object(
                     'id', img.id::text,
                     'mimeType', img.mime_type,
                     'width', img.width,
                     'height', img.height
                   )
                   order by img.created_at asc
                 ) filter (where img.id is not null),
                 '[]'::jsonb
               ) as image_files,
               count(*) over() as total
        from usage_records ur
        join users u on u.id = ur.user_id
        left join image_tasks it on it.id = ur.task_id
        left join image_files img on img.task_id = ur.task_id and img.source = 'generated'
        ${where.length ? `where ${where.join(' and ')}` : ''}
        group by ur.id, u.username, it.api_model, it.status, it.elapsed_ms
        order by ur.created_at desc
        limit $${params.length - 1} offset $${params.length}
      `,
      params,
    )
    return {
      items: result.rows.map(mapUsage),
      total: Number(result.rows[0]?.total ?? 0),
      page: query.page,
      pageSize: query.pageSize,
    }
  })
}
