import type { AppConfig } from './config.js'
import type { DbPool } from './db.js'
import { hashPassword } from './auth.js'

export async function ensureInitialAdmin(pool: DbPool, config: AppConfig): Promise<void> {
  if (!config.ADMIN_PASSWORD) return
  const exists = await pool.query("select 1 from users where role = 'admin' and status <> 'deleted' limit 1")
  if (exists.rowCount) return

  const passwordHash = await hashPassword(config.ADMIN_PASSWORD)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const created = await client.query(
      `
        insert into users (username, email, password_hash, role)
        values ($1, $2, $3, 'admin')
        returning id
      `,
      [config.ADMIN_USERNAME, config.ADMIN_EMAIL, passwordHash],
    )
    await client.query('insert into user_wallets (user_id, credits, multiplier) values ($1, 9999, 1)', [created.rows[0].id])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
