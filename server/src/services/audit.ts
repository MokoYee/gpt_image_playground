import type { DbClient, DbPool } from '../db.js'
import type { AuthUser } from '../auth.js'

export async function writeAuditLog(
  db: DbPool | DbClient,
  actor: AuthUser | null,
  action: string,
  targetType: string,
  targetId?: string | null,
  detail: Record<string, unknown> = {},
) {
  await db.query(
    `
      insert into audit_logs (actor_id, actor_username, action, target_type, target_id, detail)
      values ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [actor?.id ?? null, actor?.username ?? null, action, targetType, targetId ?? null, JSON.stringify(detail)],
  )
}
