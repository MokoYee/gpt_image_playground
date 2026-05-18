import pg from 'pg'
import type { AppConfig } from './config.js'

export type DbPool = pg.Pool
export type DbClient = pg.PoolClient

export function createDbPool(config: AppConfig): DbPool {
  return new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
}

export async function withTransaction<T>(pool: DbPool, fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
