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
  }
}

export async function registerUsageRoutes(app: FastifyInstance) {
  app.get('/api/me/usage-records', { preHandler: requireAuth }, async (request) => {
    const query = PaginationSchema.parse(request.query)
    const result = await app.context.db.query(
      `
        select ur.id::text, ur.user_id::text, u.username, ur.task_id::text, ur.prompt, ur.quality, ur.image_count,
               ur.base_credits, ur.multiplier, ur.total_credits, ur.created_at, count(*) over() as total
        from usage_records ur
        join users u on u.id = ur.user_id
        where ur.user_id = $1
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
    }).parse(request.query)
    const params: unknown[] = []
    const where: string[] = []
    if (query.userId) {
      params.push(query.userId)
      where.push(`ur.user_id = $${params.length}`)
    }
    params.push(query.pageSize, toOffset(query.page, query.pageSize))
    const result = await app.context.db.query(
      `
        select ur.id::text, ur.user_id::text, u.username, ur.task_id::text, ur.prompt, ur.quality, ur.image_count,
               ur.base_credits, ur.multiplier, ur.total_credits, ur.created_at, count(*) over() as total
        from usage_records ur
        join users u on u.id = ur.user_id
        ${where.length ? `where ${where.join(' and ')}` : ''}
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
