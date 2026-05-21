import type { TaskParams } from '../types'

export type UserRole = 'user' | 'admin'

export interface AppUser {
  id: string
  username: string
  email: string
  note: string
  role: UserRole
  credits: number
  multiplier: number
  concurrencyLimit?: number | null
  disabled: boolean
  createdAt: number
  lastLoginAt?: number | null
  lastActiveAt?: number | null
  lastUsedAt?: number | null
}

export interface CreditRecord {
  id: string
  userId: string
  username?: string
  type: 'recharge' | 'refund'
  amount: number
  note?: string
  operatorUsername: string
  createdAt: number
}

export interface UsageRecord {
  id: string
  userId: string
  username?: string
  taskId: string
  prompt: string
  quality: TaskParams['quality']
  imageCount: number
  baseCredits: number
  multiplier: number
  totalCredits: number
  createdAt: number
  apiModel?: string
  taskStatus?: string
  elapsed?: number | null
  imageFiles?: Array<{ id: string; mimeType?: string; width?: number | null; height?: number | null }>
}

export interface UsageRecordFilters {
  userId?: string
  model?: string
  quality?: TaskParams['quality']
  status?: 'queued' | 'running' | 'done' | 'error' | 'cancelled'
  keyword?: string
  from?: number
  to?: number
}

export interface SystemSettings {
  site?: {
    appName: string
  }
  auth: {
    registrationOpen: boolean
    defaultCredits: number
    defaultMultiplier: number
  }
  storage: {
    provider: 'local' | 's3'
    s3Enabled: boolean
    s3?: {
      bucket?: string
      region?: string
      endpoint?: string
    }
  }
  queue: {
    globalConcurrency: number
    defaultUserConcurrency: number
    maxQueueSize: number
  }
  models: ModelProfile[]
  defaultModel?: ModelProfile
}

export interface ModelProfile {
  id?: string
  name: string
  provider: 'openai-compatible'
  baseUrl: string
  apiKey?: string
  model: string
  apiMode: 'images' | 'responses'
  timeoutSeconds: number
  environment: 'all' | 'development' | 'production'
  enabled: boolean
  isDefault: boolean
}

export interface AuditLog {
  id: string
  actorId?: string
  actorUsername?: string
  action: string
  targetType: string
  targetId?: string
  detail: Record<string, unknown>
  createdAt: number
}

export interface PublicSettings {
  site?: {
    appName: string
  }
  auth: {
    registrationOpen: boolean
  }
  storage: {
    provider: 'local' | 's3'
    s3Enabled: boolean
  }
}

export const DEFAULT_APP_NAME = 'MQIMAGE'
export const AUTH_SESSION_STORAGE_KEY = 'gpt-image-playground.auth-session'
const LEGACY_AUTH_SESSION_STORAGE_KEY = 'hua-image-playground.auth-session'

interface AuthSession {
  token: string
  user: AppUser
}

export function readAuthSession(): AuthSession | null {
  try {
    const saved = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_AUTH_SESSION_STORAGE_KEY)
    if (saved && !window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)) {
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, saved)
      window.localStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY)
    }
    return saved ? JSON.parse(saved) as AuthSession : null
  } catch {
    return null
  }
}

export function writeAuthSession(session: AuthSession) {
  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
  window.localStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY)
}

export function clearAuthSession() {
  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
  window.localStorage.removeItem(LEGACY_AUTH_SESSION_STORAGE_KEY)
}

export function getAuthToken(): string | null {
  return readAuthSession()?.token ?? null
}

async function requestApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const payload = await response.json()
      message = payload.error?.message ?? payload.message ?? message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export async function authenticateUser(identifier: string, password: string): Promise<{ user: AppUser | null; error: string | null }> {
  try {
    const result = await requestApi<AuthSession>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    })
    writeAuthSession(result)
    return { user: result.user, error: null }
  } catch (error) {
    return { user: null, error: error instanceof Error ? error.message : '登录失败' }
  }
}

export async function registerUser(input: { username: string; email: string; password: string }): Promise<{ user: AppUser | null; error: string | null }> {
  try {
    const result = await requestApi<AuthSession>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    writeAuthSession(result)
    return { user: result.user, error: null }
  } catch (error) {
    return { user: null, error: error instanceof Error ? error.message : '注册失败' }
  }
}

export async function readPublicSettings(): Promise<PublicSettings> {
  return await requestApi<PublicSettings>('/api/settings/public')
}

export async function fetchCurrentUser(): Promise<AppUser | null> {
  if (!getAuthToken()) return null
  try {
    const result = await requestApi<{ user: AppUser }>('/api/auth/me')
    writeAuthSession({ token: getAuthToken()!, user: result.user })
    return result.user
  } catch {
    clearAuthSession()
    return null
  }
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  await requestApi('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ oldPassword, newPassword }),
  })
}

export async function listUsers(): Promise<AppUser[]> {
  const result = await requestApi<{ items: AppUser[] }>('/api/admin/users?pageSize=100')
  return result.items
}

export async function createUser(input: Pick<AppUser, 'username' | 'email'> & { password: string; credits?: number; multiplier?: number; concurrencyLimit?: number | null }): Promise<{ user: AppUser | null; error: string | null }> {
  try {
    const result = await requestApi<{ user: AppUser }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return { user: result.user, error: null }
  } catch (error) {
    return { user: null, error: error instanceof Error ? error.message : '创建失败' }
  }
}

export async function updateUser(userId: string, patch: Partial<Pick<AppUser, 'disabled' | 'note' | 'multiplier' | 'concurrencyLimit'>> & { password?: string }): Promise<AppUser | null> {
  const result = await requestApi<{ user: AppUser }>(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  })
  return result.user
}

export async function deleteUser(userId: string) {
  await requestApi(`/api/admin/users/${userId}`, { method: 'DELETE' })
}

export async function adjustUserCredits(userId: string, amount: number, type: CreditRecord['type'], note = '') {
  const result = await requestApi<{ user: AppUser }>(`/api/admin/users/${userId}/credits`, {
    method: 'POST',
    body: JSON.stringify({ amount, type, note }),
  })
  return result.user
}

export async function readCreditRecords(): Promise<CreditRecord[]> {
  const result = await requestApi<{ items: CreditRecord[] }>('/api/admin/credit-records?pageSize=100')
  return result.items
}

export async function readUsageRecords(admin = false, filters: UsageRecordFilters = {}): Promise<UsageRecord[]> {
  const params = new URLSearchParams({ pageSize: '100' })
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') params.set(key, String(value))
  }
  const path = admin ? `/api/admin/usage-records?${params.toString()}` : `/api/me/usage-records?${params.toString()}`
  const result = await requestApi<{ items: UsageRecord[] }>(path)
  return result.items
}

export async function readSystemSettings(): Promise<SystemSettings> {
  const result = await requestApi<{ settings: SystemSettings }>('/api/admin/settings')
  return result.settings
}

export async function updateAuthSettings(input: SystemSettings['auth']): Promise<SystemSettings> {
  const result = await requestApi<{ settings: SystemSettings }>('/api/admin/settings/auth', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return result.settings
}

export async function updateSiteSettings(input: SystemSettings['site']): Promise<SystemSettings> {
  const result = await requestApi<{ settings: SystemSettings }>('/api/admin/settings/site', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return result.settings
}

export async function updateQueueSettings(input: SystemSettings['queue']): Promise<SystemSettings> {
  const result = await requestApi<{ settings: SystemSettings }>('/api/admin/settings/queue', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
  return result.settings
}

export async function updateModelProfiles(items: ModelProfile[]): Promise<SystemSettings> {
  const result = await requestApi<{ settings: SystemSettings }>('/api/admin/model-profiles', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  })
  return result.settings
}

export async function readAuditLogs(): Promise<AuditLog[]> {
  const result = await requestApi<{ items: AuditLog[] }>('/api/admin/audit-logs?pageSize=100')
  return result.items
}

export function getQualityBaseCredits(quality: TaskParams['quality']): number {
  if (quality === 'low') return 1
  if (quality === 'high') return 4
  return 2
}

export function calculateTaskCredits(params: TaskParams, multiplier: number, imageCount = params.n) {
  const baseCredits = getQualityBaseCredits(params.quality)
  return Number((baseCredits * Math.max(1, imageCount) * multiplier).toFixed(2))
}
