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

export interface SiteSettings {
  appName: string
}

export interface SystemSettings {
  site: SiteSettings
  auth: AuthSettings
  storage: StorageSettings
  queue: QueueSettings
  models: ModelProfile[]
  defaultModel?: ModelProfile
}

export interface ImageApiSettings {
  provider: 'openai-compatible'
  baseUrl: string
  apiKey?: string
  model: string
  apiMode: 'images' | 'responses'
  timeoutSeconds: number
}

export interface QueueSettings {
  globalConcurrency: number
  defaultUserConcurrency: number
  maxQueueSize: number
}

export interface ModelProfile extends ImageApiSettings {
  id: string
  name: string
  environment: 'all' | 'development' | 'production'
  enabled: boolean
  isDefault: boolean
}

const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  registrationOpen: true,
  defaultCredits: 20,
  defaultMultiplier: 1,
}

const DEFAULT_SITE_SETTINGS: SiteSettings = {
  appName: 'GPT Image Playground',
}

const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  provider: 'local',
  s3Enabled: false,
}

const DEFAULT_QUEUE_SETTINGS: QueueSettings = {
  globalConcurrency: 10,
  defaultUserConcurrency: 3,
  maxQueueSize: 100,
}

function normalizeAuthSettings(value: unknown): AuthSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    registrationOpen: typeof record.registrationOpen === 'boolean' ? record.registrationOpen : DEFAULT_AUTH_SETTINGS.registrationOpen,
    defaultCredits: typeof record.defaultCredits === 'number' && Number.isFinite(record.defaultCredits) ? record.defaultCredits : DEFAULT_AUTH_SETTINGS.defaultCredits,
    defaultMultiplier: typeof record.defaultMultiplier === 'number' && Number.isFinite(record.defaultMultiplier) ? record.defaultMultiplier : DEFAULT_AUTH_SETTINGS.defaultMultiplier,
  }
}

function normalizeSiteSettings(value: unknown): SiteSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const appName = typeof record.appName === 'string' ? record.appName.trim() : ''
  return {
    appName: appName || DEFAULT_SITE_SETTINGS.appName,
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

function normalizePositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback
}

function normalizeQueueSettings(value: unknown): QueueSettings {
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  return {
    globalConcurrency: normalizePositiveInteger(record.globalConcurrency, DEFAULT_QUEUE_SETTINGS.globalConcurrency),
    defaultUserConcurrency: normalizePositiveInteger(record.defaultUserConcurrency, DEFAULT_QUEUE_SETTINGS.defaultUserConcurrency),
    maxQueueSize: normalizePositiveInteger(record.maxQueueSize, DEFAULT_QUEUE_SETTINGS.maxQueueSize),
  }
}

export async function readSystemSettings(pool: DbPool | DbClient): Promise<SystemSettings> {
  const result = await pool.query<{ key: string; value: unknown }>('select key, value from system_settings where key in ($1, $2, $3, $4)', ['site', 'auth', 'storage', 'queue'])
  const map = new Map(result.rows.map((row) => [row.key, row.value]))
  const modelResult = await pool.query(
    `
      select id::text, name, provider, base_url, api_key, model, api_mode, timeout_seconds, environment, enabled, is_default
      from model_profiles
      order by is_default desc, created_at asc
    `,
  ).catch(() => ({ rows: [] as any[] }))
  const models = modelResult.rows.map((row: any): ModelProfile => ({
    id: row.id,
    name: row.name,
    provider: 'openai-compatible',
    baseUrl: row.base_url,
    apiKey: row.api_key ?? undefined,
    model: row.model,
    apiMode: row.api_mode === 'responses' ? 'responses' : 'images',
    timeoutSeconds: Number(row.timeout_seconds ?? 120),
    environment: ['development', 'production'].includes(row.environment) ? row.environment : 'all',
    enabled: Boolean(row.enabled),
    isDefault: Boolean(row.is_default),
  }))
  return {
    site: normalizeSiteSettings(map.get('site')),
    auth: normalizeAuthSettings(map.get('auth')),
    storage: normalizeStorageSettings(map.get('storage')),
    queue: normalizeQueueSettings(map.get('queue')),
    models,
    defaultModel: models.find((item) => item.enabled && item.isDefault),
  }
}

export async function writeSetting(pool: DbPool | DbClient, key: 'site' | 'auth' | 'storage' | 'queue', value: unknown, userId: string): Promise<void> {
  await pool.query(
    `
      insert into system_settings (key, value, updated_by, updated_at)
      values ($1, $2::jsonb, $3, now())
      on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()
    `,
    [key, JSON.stringify(value), userId],
  )
}
