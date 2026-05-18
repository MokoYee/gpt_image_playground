import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { DbPool } from './db.js'

const MIGRATION_LOCK_ID = '912345678901234567'

interface MigrationFile {
  filename: string
  checksum: string
  sql: string
}

async function readMigrations(): Promise<MigrationFile[]> {
  const dir = path.resolve(process.cwd(), 'server/migrations')
  const entries = (await readdir(dir)).filter((name) => /^\d+_.+\.sql$/.test(name)).sort()
  return Promise.all(entries.map(async (filename) => {
    const sql = await readFile(path.join(dir, filename), 'utf-8')
    const checksum = createHash('sha256').update(sql.trim()).digest('hex')
    return { filename, checksum, sql }
  }))
}

export async function runMigrations(pool: DbPool): Promise<void> {
  const client = await pool.connect()
  try {
    const lock = await client.query<{ locked: boolean }>('select pg_try_advisory_lock($1) as locked', [MIGRATION_LOCK_ID])
    if (!lock.rows[0]?.locked) {
      throw new Error('数据库迁移锁获取失败，可能已有实例正在执行迁移')
    }

    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `)

    const applied = await client.query<{ filename: string; checksum: string }>('select filename, checksum from schema_migrations')
    const appliedMap = new Map(applied.rows.map((row) => [row.filename, row.checksum]))

    for (const migration of await readMigrations()) {
      const existingChecksum = appliedMap.get(migration.filename)
      if (existingChecksum) {
        if (existingChecksum !== migration.checksum) {
          throw new Error(`迁移脚本 checksum 不一致：${migration.filename}`)
        }
        continue
      }

      await client.query('BEGIN')
      try {
        await client.query(migration.sql)
        await client.query(
          'insert into schema_migrations (filename, checksum) values ($1, $2)',
          [migration.filename, migration.checksum],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  } finally {
    await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => undefined)
    client.release()
  }
}
