import type { DbPool, DbClient } from '../db.js'

export interface AuthSettings {
  registrationOpen: boolean
  defaultCredits: number
  defaultMultiplier: number
}

export interface StorageSettings {
  provider: 'local' | 's3'
  s3Enabled: boolean
  s3?: {
    bucket?: string
    region?: string
    endpoint?: string
  }
}

export interface SystemSettings {
  auth: AuthSettings
  storage: StorageSettings
  imageApi: ImageApiSettings
}

export interface ImageApiSettings {
  provider: 'openai-compatible'
  baseUrl: string
  apiKey?: string
  model: string
  apiMode: 'images' | 'responses'
  timeoutSeconds: number
}

const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  registrationOpen: true,
  defaultCredits: 20,
  defaultMultiplier: 1,
}

const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  provider: 'local',
  s3Enabled: false,
}

const DEFAULT_IMAGE_API_SETTINGS: ImageApiSettings = {
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-image-2',
  apiMode: 'images',
  timeoutSeconds: 120,
}

function normalizeAuthSettings(value: unknown): AuthSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    registrationOpen: typeof record.registrationOpen === 'boolean' ? record.registrationOpen : DEFAULT_AUTH_SETTINGS.registrationOpen,
    defaultCredits: typeof record.defaultCredits === 'number' && Number.isFinite(record.defaultCredits) ? record.defaultCredits : DEFAULT_AUTH_SETTINGS.defaultCredits,
    defaultMultiplier: typeof record.defaultMultiplier === 'number' && Number.isFinite(record.defaultMultiplier) ? record.defaultMultiplier : DEFAULT_AUTH_SETTINGS.defaultMultiplier,
  }
}

function normalizeStorageSettings(value: unknown): StorageSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    provider: record.provider === 's3' ? 's3' : 'local',
    s3Enabled: Boolean(record.s3Enabled),
    s3: record.s3 && typeof record.s3 === 'object' ? record.s3 as StorageSettings['s3'] : undefined,
  }
}

function normalizeImageApiSettings(value: unknown): ImageApiSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    provider: 'openai-compatible',
    baseUrl: typeof record.baseUrl === 'string' && record.baseUrl.trim() ? record.baseUrl.trim() : DEFAULT_IMAGE_API_SETTINGS.baseUrl,
    apiKey: typeof record.apiKey === 'string' && record.apiKey.trim() ? record.apiKey : undefined,
    model: typeof record.model === 'string' && record.model.trim() ? record.model.trim() : DEFAULT_IMAGE_API_SETTINGS.model,
    apiMode: record.apiMode === 'responses' ? 'responses' : 'images',
    timeoutSeconds: typeof record.timeoutSeconds === 'number' && Number.isFinite(record.timeoutSeconds) ? record.timeoutSeconds : DEFAULT_IMAGE_API_SETTINGS.timeoutSeconds,
  }
}

export async function readSystemSettings(pool: DbPool | DbClient): Promise<SystemSettings> {
  const result = await pool.query<{ key: string; value: unknown }>('select key, value from system_settings where key in ($1, $2, $3)', ['auth', 'storage', 'imageApi'])
  const map = new Map(result.rows.map((row) => [row.key, row.value]))
  return {
    auth: normalizeAuthSettings(map.get('auth')),
    storage: normalizeStorageSettings(map.get('storage')),
    imageApi: normalizeImageApiSettings(map.get('imageApi')),
  }
}

export async function writeSetting(pool: DbPool | DbClient, key: 'auth' | 'storage' | 'imageApi', value: unknown, userId: string): Promise<void> {
  await pool.query(
    `
      insert into system_settings (key, value, updated_by, updated_at)
      values ($1, $2::jsonb, $3, now())
      on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()
    `,
    [key, JSON.stringify(value), userId],
  )
}
