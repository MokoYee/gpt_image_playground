import pg from 'pg'
import type { AppConfig } from './config.js'

export type DbPool = pg.Pool
export type DbClient = pg.PoolClient

function encodeConnectionPart(value: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(value))
  } catch {
    return encodeURIComponent(value)
  }
}

export function normalizeDatabaseUrl(connectionString: string): string {
  const trimmed = connectionString.trim().replace(/^DATABASE_URL\s*=\s*/i, '')
  const match = trimmed.match(/^(postgres(?:ql)?:\/\/)(.*)$/i)
  if (!match) return trimmed

  const [, protocol, rest] = match
  const atIndex = rest.lastIndexOf('@')
  if (atIndex <= 0) return trimmed

  const credentials = rest.slice(0, atIndex)
  const hostAndPath = rest.slice(atIndex + 1)
  const passwordSeparatorIndex = credentials.indexOf(':')

  if (passwordSeparatorIndex < 0) {
    return `${protocol}${encodeConnectionPart(credentials)}@${hostAndPath}`
  }

  const username = credentials.slice(0, passwordSeparatorIndex)
  const password = credentials.slice(passwordSeparatorIndex + 1)
  return `${protocol}${encodeConnectionPart(username)}:${encodeConnectionPart(password)}@${hostAndPath}`
}

export function createDbPool(config: AppConfig): DbPool {
  return new pg.Pool({
    connectionString: normalizeDatabaseUrl(config.DATABASE_URL),
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
