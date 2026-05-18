import { loadConfig } from './config.js'
import { createDbPool } from './db.js'
import { runMigrations } from './migrations.js'
import { createApp } from './app.js'
import { ensureInitialAdmin } from './bootstrap.js'

async function main() {
  const config = loadConfig()
  const db = createDbPool(config)
  await runMigrations(db)
  await ensureInitialAdmin(db, config)
  const app = await createApp({ config, db })
  await app.listen({ host: config.SERVER_HOST, port: config.SERVER_PORT })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
