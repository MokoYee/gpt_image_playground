import { z } from 'zod'

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
  return ConfigSchema.parse(process.env)
}
