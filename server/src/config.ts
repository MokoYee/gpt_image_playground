import { z } from 'zod'
import { existsSync, readFileSync } from 'node:fs'

function loadLocalEnvFile(path = '.env.local'): void {
  if (!existsSync(path)) return
  const lines = readFileSync(path, 'utf-8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index <= 0) continue
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
    if (process.env[key] === undefined) process.env[key] = value
  }
}

const ConfigSchema = z.object({
  NODE_ENV: z.string().default('development'),
  SERVER_HOST: z.string().default('0.0.0.0'),
  SERVER_PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET 至少 32 位'),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 7),
  IMAGE_STORAGE_PATH: z.string().default('/data/images'),
  ADMIN_USERNAME: z.string().default('admin'),
  ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_PASSWORD: z.string().min(8).optional(),
})

export type AppConfig = z.infer<typeof ConfigSchema>

export function loadConfig(): AppConfig {
  loadLocalEnvFile()
  return ConfigSchema.parse(process.env)
}
