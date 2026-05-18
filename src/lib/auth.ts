import type { TaskParams } from '../types'

export type UserRole = 'user' | 'admin'

export interface AppUser {
  id: string
  username: string
  email: string
  password: string
  role: UserRole
  credits: number
  multiplier: number
  disabled: boolean
  createdAt: number
}

export interface CreditRecord {
  id: string
  userId: string
  type: 'recharge' | 'refund'
  amount: number
  operatorUsername: string
  createdAt: number
}

export interface UsageRecord {
  id: string
  userId: string
  taskId: string
  prompt: string
  quality: TaskParams['quality']
  imageCount: number
  baseCredits: number
  multiplier: number
  totalCredits: number
  createdAt: number
}

export const DEFAULT_ADMIN: AppUser = {
  id: 'admin',
  username: 'admin',
  email: 'admin@example.com',
  password: 'admin123456',
  role: 'admin',
  credits: 9999,
  multiplier: 1,
  disabled: false,
  createdAt: 0,
}

const USERS_STORAGE_KEY = 'hua-image-playground.users'
const LEGACY_USERS_STORAGE_KEY = 'gpt-image-playground.demo-users'
const CREDIT_RECORDS_STORAGE_KEY = 'hua-image-playground.credit-records'
const USAGE_RECORDS_STORAGE_KEY = 'hua-image-playground.usage-records'
export const AUTH_SESSION_STORAGE_KEY = 'hua-image-playground.auth-session'

function genId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('hua-auth-storage'))
}

function normalizeUser(input: Partial<AppUser> | null | undefined): AppUser | null {
  if (!input || typeof input.username !== 'string' || typeof input.email !== 'string' || typeof input.password !== 'string') return null
  return {
    id: typeof input.id === 'string' && input.id ? input.id : genId('user'),
    username: input.username,
    email: input.email,
    password: input.password,
    role: input.role === 'admin' ? 'admin' : 'user',
    credits: typeof input.credits === 'number' && Number.isFinite(input.credits) ? input.credits : 0,
    multiplier: typeof input.multiplier === 'number' && Number.isFinite(input.multiplier) ? input.multiplier : 1,
    disabled: Boolean(input.disabled),
    createdAt: typeof input.createdAt === 'number' ? input.createdAt : Date.now(),
  }
}

function readLegacyUsers(): AppUser[] {
  const legacy = readJson<Array<{ username: string; email: string; password: string }>>(LEGACY_USERS_STORAGE_KEY, [])
  return legacy
    .filter((item) => item.username !== DEFAULT_ADMIN.username && item.email !== DEFAULT_ADMIN.email)
    .map((item) => normalizeUser({
      ...item,
      role: 'user',
      credits: 20,
      multiplier: 1,
      disabled: false,
      createdAt: Date.now(),
    }))
    .filter((item): item is AppUser => Boolean(item))
}

export function readUsers(): AppUser[] {
  const saved = readJson<Partial<AppUser>[]>(USERS_STORAGE_KEY, [])
  const users = saved.map(normalizeUser).filter((item): item is AppUser => Boolean(item))
  const merged = [DEFAULT_ADMIN, ...readLegacyUsers(), ...users]
  const seen = new Set<string>()
  return merged.filter((user) => {
    const key = `${user.username.toLowerCase()}|${user.email.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function writeUsers(users: AppUser[]) {
  const normalized = users.map(normalizeUser).filter((item): item is AppUser => Boolean(item))
  writeJson(USERS_STORAGE_KEY, normalized.filter((user) => user.id !== DEFAULT_ADMIN.id))
}

export function findUserById(id: string | null | undefined): AppUser | null {
  if (!id) return null
  return readUsers().find((user) => user.id === id) ?? null
}

export function authenticateUser(identifier: string, password: string): { user: AppUser | null; error: string | null } {
  const value = identifier.trim().toLowerCase()
  const user = readUsers().find((item) =>
    item.password === password &&
    (item.username.toLowerCase() === value || item.email.toLowerCase() === value),
  ) ?? null
  if (!user) return { user: null, error: '账号或密码不正确' }
  if (user.disabled) return { user: null, error: '该账号已被禁用' }
  return { user, error: null }
}

export function createUser(input: Pick<AppUser, 'username' | 'email' | 'password' | 'role' | 'credits' | 'multiplier'>): { user: AppUser | null; error: string | null } {
  const users = readUsers()
  const exists = users.some((user) =>
    user.username.toLowerCase() === input.username.trim().toLowerCase() ||
    user.email.toLowerCase() === input.email.trim().toLowerCase(),
  )
  if (exists) return { user: null, error: '用户名或邮箱已存在' }
  const user: AppUser = {
    id: genId('user'),
    username: input.username.trim(),
    email: input.email.trim(),
    password: input.password,
    role: input.role,
    credits: Math.max(0, input.credits),
    multiplier: Math.max(0, input.multiplier),
    disabled: false,
    createdAt: Date.now(),
  }
  writeUsers([...users, user])
  return { user, error: null }
}

export function updateUser(userId: string, patch: Partial<AppUser>): AppUser | null {
  const users = readUsers()
  const nextUsers = users.map((user) => user.id === userId ? { ...user, ...patch, id: user.id } : user)
  writeUsers(nextUsers)
  return nextUsers.find((user) => user.id === userId) ?? null
}

export function deleteUser(userId: string) {
  if (userId === DEFAULT_ADMIN.id) return
  writeUsers(readUsers().filter((user) => user.id !== userId))
}

export function readCreditRecords(): CreditRecord[] {
  return readJson<CreditRecord[]>(CREDIT_RECORDS_STORAGE_KEY, []).filter((record) => record && typeof record.userId === 'string')
}

export function readUsageRecords(): UsageRecord[] {
  return readJson<UsageRecord[]>(USAGE_RECORDS_STORAGE_KEY, []).filter((record) => record && typeof record.userId === 'string')
}

export function adjustUserCredits(userId: string, amount: number, type: CreditRecord['type'], operatorUsername: string) {
  const user = findUserById(userId)
  if (!user) return null
  const signedAmount = type === 'refund' ? -Math.abs(amount) : Math.abs(amount)
  const nextCredits = Math.max(0, user.credits + signedAmount)
  const nextUser = updateUser(userId, { credits: nextCredits })
  const records = readCreditRecords()
  writeJson(CREDIT_RECORDS_STORAGE_KEY, [{
    id: genId(type),
    userId,
    type,
    amount: Math.abs(amount),
    operatorUsername,
    createdAt: Date.now(),
  }, ...records])
  return nextUser
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

export function recordTaskUsage(userId: string, taskId: string, prompt: string, params: TaskParams, imageCount: number): UsageRecord | null {
  const user = findUserById(userId)
  if (!user) return null
  const baseCredits = getQualityBaseCredits(params.quality)
  const totalCredits = calculateTaskCredits(params, user.multiplier, imageCount)
  updateUser(userId, { credits: Math.max(0, Number((user.credits - totalCredits).toFixed(2))) })
  const record: UsageRecord = {
    id: genId('usage'),
    userId,
    taskId,
    prompt,
    quality: params.quality,
    imageCount,
    baseCredits,
    multiplier: user.multiplier,
    totalCredits,
    createdAt: Date.now(),
  }
  writeJson(USAGE_RECORDS_STORAGE_KEY, [record, ...readUsageRecords()])
  return record
}
