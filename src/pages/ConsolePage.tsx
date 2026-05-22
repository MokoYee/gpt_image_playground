import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Alert from 'antd/es/alert'
import Button from 'antd/es/button'
import ConfigProvider from 'antd/es/config-provider'
import DatePicker from 'antd/es/date-picker'
import Dropdown from 'antd/es/dropdown'
import Empty from 'antd/es/empty'
import Form from 'antd/es/form'
import Input from 'antd/es/input'
import message from 'antd/es/message'
import Modal from 'antd/es/modal'
import Select from 'antd/es/select'
import Space from 'antd/es/space'
import Switch from 'antd/es/switch'
import Table from 'antd/es/table'
import Tag from 'antd/es/tag'
import CopyOutlined from '@ant-design/icons/es/icons/CopyOutlined'
import LinkOutlined from '@ant-design/icons/es/icons/LinkOutlined'
import ReloadOutlined from '@ant-design/icons/es/icons/ReloadOutlined'
import SearchOutlined from '@ant-design/icons/es/icons/SearchOutlined'
import UserAddOutlined from '@ant-design/icons/es/icons/UserAddOutlined'
import zhCN from 'antd/es/locale/zh_CN'
import antdTheme from 'antd/es/theme'
import dayjs from 'dayjs'
import type { MenuProps } from 'antd/es/menu'
import type { ColumnsType } from 'antd/es/table'
import 'antd/dist/reset.css'
import {
  adjustUserCredits,
  createUser,
  DEFAULT_APP_NAME,
  deleteUser,
  readCreditRecords,
  readAuditLogs,
  readSystemSettings,
  readUsageRecords,
  listUsers,
  updateAuthSettings,
  updateModelProfiles,
  updateQueueSettings,
  updateSiteSettings,
  updateUser,
} from '../lib/auth'
import type { AppUser, AuditLog, CreditRecord, ModelProfile, SystemSettings, UsageRecord, UsageRecordFilters } from '../lib/auth'
import { createProtectedImageLink, fetchProtectedImageDataUrl } from '../lib/api'
import { copyTextToClipboard, getClipboardFailureMessage } from '../lib/clipboard'
import { useStore } from '../store'
import Lightbox from '../components/Lightbox'
import SidebarUserMenu from '../components/SidebarUserMenu'
import ThemeToggle from '../components/ThemeToggle'
import AppLogoMark from '../components/AppLogoMark'
import { readThemePreference, resolveThemePreference } from '../lib/theme'
import type { ResolvedTheme } from '../lib/theme'

interface ConsolePageProps {
  currentUser: AppUser
  appName: string
  onAppNameChange?: (appName: string) => void
  onLogout: () => void
  onClose: () => void
}

type ConsoleTab = 'users' | 'credits' | 'usage' | 'settings' | 'audit'
type ConsoleTableKey = 'users' | 'credits' | 'usage' | 'audit'
type ModelApiMode = ModelProfile['apiMode']
type ModelEnvironment = ModelProfile['environment']

const EMPTY_SETTINGS_DRAFT = {
  appName: '',
  registrationOpen: true,
  defaultCredits: '',
  defaultMultiplier: '',
  globalConcurrency: '',
  defaultUserConcurrency: '',
  maxQueueSize: '',
}

const EMPTY_TABLE_LOADING: Record<ConsoleTableKey, boolean> = {
  users: false,
  credits: false,
  usage: false,
  audit: false,
}

const SETTINGS_PLACEHOLDERS = {
  defaultCredits: '20',
  defaultMultiplier: '1',
  globalConcurrency: '10',
  defaultUserConcurrency: '3',
  maxQueueSize: '3',
}

const EMPTY_CREATE_USER_FORM = {
  username: '',
  email: '',
  password: '',
  credits: '',
  multiplier: '',
  concurrencyLimit: '',
}

const EMPTY_EDIT_USER_FORM = {
  multiplier: '',
  concurrencyLimit: '',
  note: '',
  password: '',
  disabled: false,
}

const EMPTY_CREDIT_FORM = {
  amount: '',
  note: '',
}

const DEFAULT_MODEL_DRAFT: ModelProfile = {
  name: '默认模型',
  provider: 'openai-compatible',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-image-2',
  apiMode: 'images',
  timeoutSeconds: 120,
  environment: 'all',
  enabled: true,
  isDefault: true,
}

const EMPTY_USAGE_FILTERS = {
  userId: '',
  model: '',
  quality: '',
  status: '',
  keyword: '',
  minCredits: '',
  maxCredits: '',
  onlyMine: false,
  from: '',
  to: '',
}

const QUALITY_OPTIONS = [
  { value: '', label: '全部质量' },
  { value: 'auto', label: 'auto' },
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
]

const TASK_STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '生成中' },
  { value: 'done', label: '已完成' },
  { value: 'error', label: '失败' },
  { value: 'cancelled', label: '已取消' },
]

const API_MODE_OPTIONS = [
  { value: 'images', label: 'Images' },
  { value: 'responses', label: 'Responses' },
]

const MODEL_ENVIRONMENT_OPTIONS = [
  { value: 'all', label: '全部环境' },
  { value: 'development', label: '仅开发' },
  { value: 'production', label: '仅生产' },
]

const TABLE_SCROLL_Y = 'min(52vh, 520px)'

const TASK_STATUS_LABELS: Record<string, string> = {
  queued: '排队中',
  running: '生成中',
  done: '已完成',
  error: '失败',
  cancelled: '已取消',
}

const TASK_STATUS_COLORS: Record<string, string> = {
  queued: 'processing',
  running: 'blue',
  done: 'success',
  error: 'error',
  cancelled: 'default',
}

function formatTime(value: number) {
  return new Date(value).toLocaleString()
}

function formatOptionalTime(value?: number | null) {
  return value ? formatTime(value) : '-'
}

function userInitial(user: AppUser) {
  return (user.username || user.email || '?').slice(0, 1).toUpperCase()
}

function formatElapsed(value?: number | null) {
  return value == null ? '-' : `${Math.round(value / 1000)} 秒`
}

function formatDetail(value: Record<string, unknown>) {
  try {
    const detail = JSON.stringify(value)
    return detail === '{}' ? '-' : detail
  } catch {
    return '-'
  }
}

function renderUserStatus(disabled: boolean) {
  return <Tag color={disabled ? 'default' : 'success'}>{disabled ? '禁用' : '启用'}</Tag>
}

function renderRole(role: AppUser['role']) {
  return <Tag color={role === 'admin' ? 'geekblue' : 'default'}>{role === 'admin' ? '管理员' : '用户'}</Tag>
}

function renderTaskStatus(status?: string) {
  const key = status || 'unknown'
  return <Tag color={TASK_STATUS_COLORS[key] ?? 'default'}>{TASK_STATUS_LABELS[key] ?? status ?? '未知'}</Tag>
}

function tableLocale(description: string) {
  return {
    emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />,
  }
}

function StatIcon({ type }: { type: 'users' | 'enabled' | 'credits' | 'today' }) {
  if (type === 'users') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9.5" cy="7" r="4" />
        <path d="M22 21v-2.2a4 4 0 0 0-3-3.8" />
        <path d="M16 3.3a4 4 0 0 1 0 7.4" />
      </svg>
    )
  }
  if (type === 'enabled') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
        <path d="M21 12a9 9 0 1 1-3.3-7" />
      </svg>
    )
  }
  if (type === 'credits') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v18" />
        <path d="M17 7.5c-.8-1-2.3-1.7-4.2-1.7-2.4 0-4.1 1.1-4.1 2.8 0 4 8.8 1.8 8.8 6.3 0 1.8-1.8 3.3-4.6 3.3-2.1 0-3.9-.8-4.9-2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 2v4M17 2v4M3 10h18" />
      <path d="M8 15h3M13 15h3" />
    </svg>
  )
}

function Stat({ label, value, trend, icon }: { label: string; value: string | number; trend?: string; icon: 'users' | 'enabled' | 'credits' | 'today' }) {
  return (
    <div className={`console-stat-card is-${icon}`}>
      <div className="console-stat-heading">
        <span><StatIcon type={icon} /></span>
        <em>{label}</em>
      </div>
      <div className="console-stat-value-row">
        <strong>{value}</strong>
        {trend && <span>{trend}</span>}
      </div>
    </div>
  )
}

function ActionIcon({ type }: { type: 'edit' | 'disable' | 'more' | 'plus' | 'minus' | 'delete' }) {
  if (type === 'edit') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    )
  }
  if (type === 'disable') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="m5.7 5.7 12.6 12.6" />
      </svg>
    )
  }
  if (type === 'plus') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  }
  if (type === 'minus') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M5 12h14" />
      </svg>
    )
  }
  if (type === 'delete') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15" />
        <path d="M10 11v6M14 11v6" />
      </svg>
    )
  }
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  )
}

function RowActionButton({ label, title, disabled, onClick, children }: { label: string; title?: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="text"
      onClick={onClick}
      disabled={disabled}
      className="console-row-action"
      icon={children}
      title={title ?? label}
      aria-label={title ?? label}
    >
      {label}
    </Button>
  )
}

function NavIcon({ type }: { type: ConsoleTab }) {
  if (type === 'settings') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.73l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.73v-.51a2 2 0 0 1 1-1.72l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  if (type === 'credits') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 3v18M17 7.5c-.8-1-2.3-1.7-4.2-1.7-2.4 0-4.1 1.1-4.1 2.8 0 4 8.8 1.8 8.8 6.3 0 1.8-1.8 3.3-4.6 3.3-2.1 0-3.9-.8-4.9-2" />
      </svg>
    )
  }
  if (type === 'usage') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M4 19V5M4 19h16M8 16v-5M12 16V8M16 16v-3" />
      </svg>
    )
  }
  if (type === 'audit') {
    return (
      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4" />
        <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4Z" />
      </svg>
    )
  }
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-7 text-center text-sm text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
      {text}
    </div>
  )
}

function ProtectedImage({ fileId }: { fileId: string }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchProtectedImageDataUrl(fileId)
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc('')
      })
    return () => {
      cancelled = true
    }
  }, [fileId])

  if (!src) return <div className="h-full w-full bg-gray-100 dark:bg-black/20" />
  return <img src={src} className="block h-full w-full object-cover" alt="" />
}

function toServerLightboxImageId(fileId: string) {
  return `server:${fileId}`
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint8Array(12)
  window.crypto.getRandomValues(bytes)
  const randomPart = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join('')
  return `${randomPart}A1`
}

export default function ConsolePage({ currentUser, appName, onAppNameChange, onLogout, onClose }: ConsolePageProps) {
  const [tab, setTab] = useState<ConsoleTab>('users')
  const [users, setUsers] = useState<AppUser[]>([])
  const [creditRecords, setCreditRecords] = useState<CreditRecord[]>([])
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [tableLoading, setTableLoading] = useState<Record<ConsoleTableKey, boolean>>(EMPTY_TABLE_LOADING)
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  const [modelDrafts, setModelDrafts] = useState<ModelProfile[]>([])
  const [settingsDraft, setSettingsDraft] = useState(EMPTY_SETTINGS_DRAFT)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [editUserForm, setEditUserForm] = useState(EMPTY_EDIT_USER_FORM)
  const [creditTarget, setCreditTarget] = useState<{ user: AppUser; type: 'recharge' | 'refund' } | null>(null)
  const [creditForm, setCreditForm] = useState(EMPTY_CREDIT_FORM)
  const [usageFilters, setUsageFilters] = useState(EMPTY_USAGE_FILTERS)
  const [error, setError] = useState<string | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_CREATE_USER_FORM)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveThemePreference(readThemePreference()))
  const [messageApi, messageContextHolder] = message.useMessage()
  const [modalApi, modalContextHolder] = Modal.useModal()
  const setLightboxImageId = useStore((state) => state.setLightboxImageId)
  const isDarkMode = resolvedTheme === 'dark'
  const sidebarUser = users.find((user) => user.id === currentUser.id) ?? currentUser

  const totals = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return {
      users: users.length,
      enabled: users.filter((user) => !user.disabled).length,
      credits: Number(users.reduce((sum, user) => sum + user.credits, 0).toFixed(2)),
      today: usageRecords.filter((record) => record.createdAt >= today.getTime()).length,
    }
  }, [users, usageRecords])

  const modelOptions = useMemo(() => {
    const models = Array.from(new Set(usageRecords.map((record) => record.apiModel).filter(Boolean)))
    return [{ value: '', label: '全部模型' }, ...models.map((model) => ({ value: model as string, label: model as string }))]
  }, [usageRecords])

  const buildUsageFilters = (): UsageRecordFilters => ({
    userId: usageFilters.onlyMine ? currentUser.id : usageFilters.userId || undefined,
    model: usageFilters.model.trim() || undefined,
    quality: usageFilters.quality ? usageFilters.quality as UsageRecordFilters['quality'] : undefined,
    status: usageFilters.status ? usageFilters.status as UsageRecordFilters['status'] : undefined,
    keyword: usageFilters.keyword.trim() || undefined,
    from: usageFilters.from ? new Date(`${usageFilters.from}T00:00:00`).getTime() : undefined,
    to: usageFilters.to ? new Date(`${usageFilters.to}T23:59:59`).getTime() : undefined,
  })

  const applyUsageClientFilters = (records: UsageRecord[]) => {
    const minCredits = Number(usageFilters.minCredits)
    const maxCredits = Number(usageFilters.maxCredits)
    return records.filter((record) => {
      if (usageFilters.minCredits.trim() && Number.isFinite(minCredits) && record.totalCredits < minCredits) return false
      if (usageFilters.maxCredits.trim() && Number.isFinite(maxCredits) && record.totalCredits > maxCredits) return false
      return true
    })
  }

  const setConsoleTableLoading = (keys: ConsoleTableKey[], loading: boolean) => {
    setTableLoading((current) => {
      const next = { ...current }
      keys.forEach((key) => {
        next[key] = loading
      })
      return next
    })
  }

  const refresh = async () => {
    const keys: ConsoleTableKey[] = ['users', 'credits', 'usage', 'audit']
    setError(null)
    setConsoleTableLoading(keys, true)
    try {
      const [nextUsers, nextCreditRecords, nextUsageRecords, nextAuditLogs] = await Promise.all([
        listUsers(),
        readCreditRecords(),
        readUsageRecords(true, buildUsageFilters()),
        readAuditLogs(),
      ])
      setUsers(nextUsers)
      setCreditRecords(nextCreditRecords)
      setUsageRecords(applyUsageClientFilters(nextUsageRecords))
      setAuditLogs(nextAuditLogs)
    } catch (error) {
      setError(error instanceof Error ? error.message : '数据加载失败')
    } finally {
      setConsoleTableLoading(keys, false)
    }
  }

  const refreshSettings = async () => {
    const settings = await readSystemSettings()
    const nextAppName = settings.site?.appName || appName || DEFAULT_APP_NAME
    setSystemSettings(settings)
    setModelDrafts(settings.models?.length ? settings.models : [DEFAULT_MODEL_DRAFT])
    setSettingsDraft({
      appName: nextAppName,
      registrationOpen: settings.auth.registrationOpen,
      defaultCredits: String(settings.auth.defaultCredits),
      defaultMultiplier: String(settings.auth.defaultMultiplier),
      globalConcurrency: String(settings.queue.globalConcurrency),
      defaultUserConcurrency: String(settings.queue.defaultUserConcurrency),
      maxQueueSize: String(settings.queue.maxQueueSize),
    })
    setForm((current) => ({
      ...current,
      credits: current.credits || String(settings.auth.defaultCredits),
      multiplier: current.multiplier || String(settings.auth.defaultMultiplier),
      concurrencyLimit: current.concurrencyLimit || '',
    }))
  }

  useEffect(() => {
    void refresh()
    void refreshSettings().catch((error) => {
      setError(error instanceof Error ? error.message : '系统设置加载失败')
    })
  }, [])

  const copyText = async (value: string, successText: string) => {
    try {
      await copyTextToClipboard(value)
      messageApi.success(successText)
    } catch (error) {
      messageApi.error(getClipboardFailureMessage('复制失败，请检查浏览器剪贴板权限', error))
    }
  }

  const handleCreateUser = async () => {
    setDialogError(null)
    const credits = Number(form.credits)
    const multiplier = Number(form.multiplier)
    const concurrencyLimit = form.concurrencyLimit.trim() ? Number(form.concurrencyLimit) : null
    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setDialogError('请填写用户名、邮箱和密码')
      return
    }
    if (!Number.isFinite(credits) || credits < 0) {
      setDialogError('用户额度必须是非负数字')
      return
    }
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      setDialogError('专属倍率必须是非负数字，允许填写 0.2 这类小数')
      return
    }
    if (concurrencyLimit !== null && (!Number.isInteger(concurrencyLimit) || concurrencyLimit <= 0)) {
      setDialogError('专属并发必须是大于 0 的整数')
      return
    }
    const result = await createUser({
      username: form.username,
      email: form.email,
      password: form.password,
      credits,
      multiplier,
      concurrencyLimit,
    })
    if (!result.user) {
      setDialogError(result.error)
      return
    }
    setForm({
      ...EMPTY_CREATE_USER_FORM,
      credits: systemSettings ? String(systemSettings.auth.defaultCredits) : '',
      multiplier: systemSettings ? String(systemSettings.auth.defaultMultiplier) : '',
      concurrencyLimit: '',
    })
    setShowCreateUser(false)
    setDialogError(null)
    await refresh()
    messageApi.success('用户已创建')
  }

  const openEditUser = (user: AppUser) => {
    setDialogError(null)
    setEditingUser(user)
    setEditUserForm({
      multiplier: String(user.multiplier),
      concurrencyLimit: user.concurrencyLimit == null ? '' : String(user.concurrencyLimit),
      note: user.note ?? '',
      password: '',
      disabled: user.disabled,
    })
  }

  const saveEditingUser = async () => {
    if (!editingUser) return
    setDialogError(null)
    const isEditingAdmin = editingUser.role === 'admin'
    const multiplier = Number(editUserForm.multiplier)
    const concurrencyLimit = editUserForm.concurrencyLimit.trim() ? Number(editUserForm.concurrencyLimit) : null
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      setDialogError('专属倍率必须是非负数字，允许填写 0.2 这类小数')
      return
    }
    if (concurrencyLimit !== null && (!Number.isInteger(concurrencyLimit) || concurrencyLimit <= 0)) {
      setDialogError('专属并发必须是大于 0 的整数')
      return
    }
    const password = editUserForm.password
    if (password && (password.length < 6 || password.length > 72)) {
      setDialogError('新密码需为 6-72 位')
      return
    }
    try {
      await updateUser(editingUser.id, {
        multiplier,
        concurrencyLimit,
        note: editUserForm.note.trim(),
        disabled: isEditingAdmin ? editingUser.disabled : editUserForm.disabled,
        ...(password ? { password } : {}),
      })
      setEditingUser(null)
      setDialogError(null)
      await refresh()
      messageApi.success('用户配置已保存')
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '用户配置保存失败')
    }
  }

  const openCreditDialog = (user: AppUser, type: 'recharge' | 'refund') => {
    setDialogError(null)
    setCreditTarget({ user, type })
    setCreditForm(EMPTY_CREDIT_FORM)
  }

  const toggleUserDisabled = async (user: AppUser) => {
    if (user.role === 'admin') return
    setError(null)
    await updateUser(user.id, { disabled: !user.disabled })
    await refresh()
    messageApi.success(user.disabled ? '用户已启用' : '用户已禁用')
  }

  const removeUser = async (user: AppUser) => {
    if (user.id === currentUser.id || user.role === 'admin') return
    modalApi.confirm({
      title: `删除用户「${user.username}」？`,
      content: '该操作会禁用账号并保留历史记录。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      async onOk() {
        setError(null)
        await deleteUser(user.id)
        await refresh()
        messageApi.success('用户已删除')
      },
    })
  }

  const submitCreditDialog = async () => {
    if (!creditTarget) return
    setDialogError(null)
    const value = Number(creditForm.amount)
    if (!Number.isFinite(value) || value <= 0) {
      setDialogError('请输入大于 0 的金额')
      return
    }
    try {
      await adjustUserCredits(creditTarget.user.id, value, creditTarget.type, creditForm.note.trim())
      setCreditTarget(null)
      setDialogError(null)
      await refresh()
      messageApi.success(creditTarget.type === 'recharge' ? '充值已完成' : '退款已完成')
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : '额度操作失败')
    }
  }

  const saveSiteSettings = async () => {
    setError(null)
    const nextName = settingsDraft.appName.trim()
    if (!nextName) {
      setError('系统名称不能为空')
      return
    }
    const settings = await updateSiteSettings({ appName: nextName })
    const savedName = settings.site?.appName || nextName
    setSystemSettings(settings)
    setSettingsDraft((draft) => ({ ...draft, appName: savedName }))
    onAppNameChange?.(savedName)
    messageApi.success('基础信息已保存')
  }

  const saveAuthSettings = async () => {
    setError(null)
    const defaultCredits = Number(settingsDraft.defaultCredits)
    const defaultMultiplier = Number(settingsDraft.defaultMultiplier)
    if (!Number.isFinite(defaultCredits) || defaultCredits < 0) {
      setError('默认额度必须是非负数字')
      return
    }
    if (!Number.isFinite(defaultMultiplier) || defaultMultiplier < 0) {
      setError('默认倍率必须是非负数字，允许填写 0.2 这类小数')
      return
    }
    const settings = await updateAuthSettings({
      registrationOpen: settingsDraft.registrationOpen,
      defaultCredits,
      defaultMultiplier,
    })
    setSystemSettings(settings)
    messageApi.success('注册设置已保存')
  }

  const saveQueueSettings = async () => {
    setError(null)
    const globalConcurrency = Number(settingsDraft.globalConcurrency)
    const defaultUserConcurrency = Number(settingsDraft.defaultUserConcurrency)
    const maxQueueSize = Number(settingsDraft.maxQueueSize)
    if (![globalConcurrency, defaultUserConcurrency, maxQueueSize].every((value) => Number.isInteger(value) && value > 0)) {
      setError('并发和队列上限必须是大于 0 的整数')
      return
    }
    const settings = await updateQueueSettings({
      globalConcurrency,
      defaultUserConcurrency,
      maxQueueSize,
    })
    setSystemSettings(settings)
    messageApi.success('队列设置已保存')
  }

  const saveModelProfiles = async () => {
    setError(null)
    if (modelDrafts.filter((item) => item.enabled && item.isDefault).length !== 1) {
      setError('必须选择一个启用的默认模型')
      return
    }
    const payload = modelDrafts.map((model) => {
      const apiKey = model.apiKey?.trim()
      return apiKey ? { ...model, apiKey } : { ...model, apiKey: undefined }
    })
    if (payload.some((model) => model.enabled && model.isDefault && !model.id && !model.apiKey)) {
      setError('默认模型必须配置 API Key')
      return
    }
    const settings = await updateModelProfiles(payload)
    setSystemSettings(settings)
    setModelDrafts(settings.models)
    messageApi.success('模型服务已保存')
  }

  const applyUsageFilters = async () => {
    setError(null)
    setConsoleTableLoading(['usage'], true)
    try {
      setUsageRecords(applyUsageClientFilters(await readUsageRecords(true, buildUsageFilters())))
      messageApi.success('筛选已应用')
    } catch (error) {
      setError(error instanceof Error ? error.message : '消费记录加载失败')
    } finally {
      setConsoleTableLoading(['usage'], false)
    }
  }

  const resetUsageFilters = async () => {
    setError(null)
    setUsageFilters(EMPTY_USAGE_FILTERS)
    setConsoleTableLoading(['usage'], true)
    try {
      setUsageRecords(await readUsageRecords(true))
      messageApi.success('筛选已重置')
    } catch (error) {
      setError(error instanceof Error ? error.message : '消费记录加载失败')
    } finally {
      setConsoleTableLoading(['usage'], false)
    }
  }

  const navItems: Array<{ key: ConsoleTab; label: string }> = [
    { key: 'users', label: '用户管理' },
    { key: 'usage', label: '创作记录' },
    { key: 'settings', label: '系统设置' },
    { key: 'audit', label: '审计日志' },
    { key: 'credits', label: '充值记录' },
  ]

  const compactPagination = { pageSize: 10, showSizeChanger: false, hideOnSinglePage: true }

  const userColumns: ColumnsType<AppUser> = [
    {
      title: '账号',
      dataIndex: 'username',
      key: 'account',
      width: 242,
      render: (_, user) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-gray-800 dark:text-gray-100" title={user.username}>{user.username}</div>
          <div className="truncate text-xs text-gray-500" title={user.email}>{user.email}</div>
        </div>
      ),
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 98,
      render: renderRole,
    },
    {
      title: '状态',
      dataIndex: 'disabled',
      key: 'status',
      width: 104,
      render: renderUserStatus,
    },
    {
      title: 'Credits',
      dataIndex: 'credits',
      key: 'credits',
      width: 100,
      render: (value: number) => <span className="font-semibold">{value.toFixed(2)}</span>,
    },
    {
      title: '倍率',
      dataIndex: 'multiplier',
      key: 'multiplier',
      width: 75,
      align: 'center',
    },
    {
      title: '并发',
      dataIndex: 'concurrencyLimit',
      key: 'concurrencyLimit',
      width: 75,
      render: (value?: number | null) => value ?? '默认',
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 172,
      render: formatOptionalTime,
    },
    {
      title: '最后活跃',
      dataIndex: 'lastActiveAt',
      key: 'lastActiveAt',
      width: 158,
      render: formatOptionalTime,
    },
    {
      title: '最后使用',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      width: 110,
      render: formatOptionalTime,
    },
    {
      title: '操作',
      key: 'actions',
      width: 210,
      fixed: 'right',
      className: 'console-table-action-cell',
      render: (_, user) => {
        const isSelf = user.id === currentUser.id
        const isAdmin = user.role === 'admin'
        const menuItems = [
          { key: 'recharge', label: '充值', icon: <span className="text-emerald-500"><ActionIcon type="plus" /></span> },
          { key: 'refund', label: '退款', icon: <span className="text-orange-500"><ActionIcon type="minus" /></span> },
          !isAdmin ? { type: 'divider' as const } : null,
          !isAdmin ? { key: 'delete', label: '删除', danger: true, disabled: isSelf, icon: <ActionIcon type="delete" /> } : null,
        ].filter(Boolean) as MenuProps['items']

        return (
          <Space size={4} wrap={false}>
            <RowActionButton label="编辑" onClick={() => openEditUser(user)}>
              <ActionIcon type="edit" />
            </RowActionButton>
            {!isAdmin && (
              <RowActionButton label={user.disabled ? '启用' : '禁用'} onClick={() => toggleUserDisabled(user)}>
                <ActionIcon type="disable" />
              </RowActionButton>
            )}
            <Dropdown
              trigger={['click']}
              menu={{
                items: menuItems,
                onClick: ({ key }) => {
                  if (key === 'recharge') openCreditDialog(user, 'recharge')
                  if (key === 'refund') openCreditDialog(user, 'refund')
                  if (key === 'delete') void removeUser(user)
                },
              }}
            >
              <Button type="text" icon={<ActionIcon type="more" />}>更多</Button>
            </Dropdown>
          </Space>
        )
      },
    },
  ]

  const creditColumns: ColumnsType<CreditRecord> = [
    {
      title: '用户',
      key: 'user',
      width: 180,
      render: (_, record) => {
        const user = users.find((item) => item.id === record.userId)
        return user?.username ?? record.username ?? '未知用户'
      },
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 96,
      render: (value: CreditRecord['type']) => <Tag color={value === 'recharge' ? 'blue' : 'orange'}>{value === 'recharge' ? '充值' : '退款'}</Tag>,
    },
    {
      title: '金额',
      key: 'amount',
      dataIndex: 'amount',
      width: 120,
      align: 'right',
      render: (value: number, record) => <span className={record.type === 'recharge' ? 'text-blue-600' : 'text-orange-600'}>{record.type === 'recharge' ? '+' : '-'}{value}</span>,
    },
    {
      title: '管理员',
      dataIndex: 'operatorUsername',
      key: 'operatorUsername',
      width: 150,
      ellipsis: true,
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      width: 300,
      ellipsis: true,
      render: (value?: string) => <span title={value || ''}>{value || '-'}</span>,
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: formatTime,
    },
  ]

  const usageColumns: ColumnsType<UsageRecord> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 88,
      render: (value: string) => <span className="console-id-cell">#{String(value).slice(-5)}</span>,
    },
    {
      title: '用户',
      key: 'user',
      width: 112,
      render: (_, record) => {
        const user = users.find((item) => item.id === record.userId)
        return <span className="console-user-cell">{user?.username ?? record.username ?? '未知用户'}</span>
      },
    },
    {
      title: '预览图',
      key: 'images',
      width: 92,
      render: (_, record) => {
        const image = record.imageFiles?.[0]
        const imageList = record.imageFiles?.map((item) => toServerLightboxImageId(item.id)) ?? []
        if (!image) return <div className="console-preview-thumb is-empty" />
        return (
          <button
            type="button"
            className="console-preview-thumb"
            onClick={() => setLightboxImageId(toServerLightboxImageId(image.id), imageList)}
            title="点击预览"
            aria-label="预览图片"
          >
            <ProtectedImage fileId={image.id} />
          </button>
        )
      },
    },
    {
      title: '提示词',
      dataIndex: 'prompt',
      key: 'prompt',
      width: 260,
      ellipsis: true,
      render: (value: string) => <span className="console-prompt-cell" title={value}>{value || '-'}</span>,
    },
    {
      title: '模型',
      dataIndex: 'apiModel',
      key: 'apiModel',
      width: 150,
      ellipsis: true,
      render: (value?: string) => <span title={value || ''}>{value || '-'}</span>,
    },
    {
      title: '质量',
      dataIndex: 'quality',
      key: 'quality',
      width: 96,
      render: (value: UsageRecord['quality']) => <Tag color={value === 'high' ? 'gold' : 'cyan'}>{value === 'high' ? '高质量' : value}</Tag>,
    },
    {
      title: '尺寸',
      key: 'size',
      width: 78,
      render: (_, record) => {
        const image = record.imageFiles?.find((item) => item.width && item.height)
        if (!image?.width || !image.height) return '-'
        const ratio = image.width / image.height
        if (Math.abs(ratio - 1) < 0.08) return '1:1'
        if (ratio > 1) return '16:9'
        return '3:4'
      },
    },
    {
      title: 'Credits',
      dataIndex: 'totalCredits',
      key: 'totalCredits',
      width: 96,
      align: 'right',
      render: (value: number) => <span className="font-semibold">{value}</span>,
    },
    {
      title: '状态',
      dataIndex: 'taskStatus',
      key: 'taskStatus',
      width: 104,
      render: renderTaskStatus,
    },
    {
      title: '生成时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 132,
      render: (value: number) => {
        const date = new Date(value)
        return (
          <span className="console-time-cell">
            {date.toISOString().slice(0, 10)}<br />{date.toTimeString().slice(0, 5)}
          </span>
        )
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 190,
      fixed: 'right',
      className: 'console-table-action-cell',
      render: (_, record) => {
        const firstImage = record.imageFiles?.[0]
        return (
          <Space size={4} wrap={false} className="console-usage-actions">
            <Button
              className="console-text-action"
              icon={<CopyOutlined />}
              onClick={() => void copyText(record.prompt, '提示词已复制')}
              aria-label="复制提示词"
              title="复制提示词"
            >
              提示词
            </Button>
            {firstImage && (
              <Button
                className="console-text-action"
                icon={<LinkOutlined />}
                onClick={() => {
                  void createProtectedImageLink(firstImage.id)
                    .then((link) => copyText(link, '图片链接已复制'))
                    .catch(() => messageApi.error('图片链接生成失败'))
                }}
                aria-label="复制图片链接"
                title="复制图片链接"
              >
                图片链接
              </Button>
            )}
          </Space>
        )
      },
    },
  ]

  const auditColumns: ColumnsType<AuditLog> = [
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 190,
      fixed: 'left',
      render: (value: string) => <Tag color="geekblue">{value}</Tag>,
    },
    {
      title: '操作人',
      dataIndex: 'actorUsername',
      key: 'actorUsername',
      width: 150,
      render: (value?: string) => value ?? '系统',
    },
    {
      title: '对象',
      key: 'target',
      width: 240,
      ellipsis: true,
      render: (_, log) => <span title={`${log.targetType}${log.targetId ? `/${log.targetId}` : ''}`}>{log.targetType}{log.targetId ? `/${log.targetId}` : ''}</span>,
    },
    {
      title: '明细',
      dataIndex: 'detail',
      key: 'detail',
      width: 360,
      ellipsis: true,
      render: (value: Record<string, unknown>) => {
        const detail = formatDetail(value)
        return <span title={detail}>{detail}</span>
      },
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: formatTime,
    },
  ]

  const activeNavItem = navItems.find((item) => item.key === tab) ?? navItems[0]
  const tabSubtitles: Record<ConsoleTab, string> = {
    users: '管理账号、额度与使用状态',
    usage: '查询图片生成记录、模型与消耗明细',
    settings: '维护站点、安全、队列与模型服务',
    audit: '追踪管理员操作与系统审计事件',
    credits: '查看充值、退款与管理员操作流水',
  }
  const isRefreshing = Object.values(tableLoading).some(Boolean)

  return (
    <ConfigProvider
      locale={zhCN}
      componentSize="middle"
      theme={{
        algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          borderRadius: 8,
          colorPrimary: '#3b82f6',
          colorBgBase: isDarkMode ? '#080b12' : '#f4f7fb',
          colorBgContainer: isDarkMode ? '#10141d' : '#ffffff',
          colorBgElevated: isDarkMode ? '#121722' : '#ffffff',
          colorBorder: isDarkMode ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.12)',
          colorText: isDarkMode ? '#e5edf7' : '#142033',
          colorTextSecondary: isDarkMode ? '#9aa4b2' : '#667085',
          fontFamily: 'var(--font-ui-sans)',
        },
        components: {
          Button: { borderRadius: 8 },
          Table: {
            borderRadius: 8,
            cellPaddingBlockSM: 8,
            cellPaddingInlineSM: 10,
            headerBg: isDarkMode ? '#101a2a' : '#f8fafc',
          },
        },
      }}
    >
      <main className="console-antd-scope console-shell">
        {messageContextHolder}
        {modalContextHolder}
        <div className="console-layout-shell">
          <aside className="console-sidebar" aria-label="控制台导航">
            <div className="console-brand">
              <span><AppLogoMark /></span>
              <strong title={appName}>{appName}</strong>
            </div>
            <div className="console-sidebar-nav">
              {navItems.map((item) => (
                <Button
                  key={item.key}
                  type="text"
                  block
                  onClick={() => setTab(item.key)}
                  className={`console-nav-button ${tab === item.key ? 'is-active' : ''}`}
                >
                  {tab === item.key && <span className="console-nav-indicator" />}
                  <span className="console-nav-content">
                    <span className="console-nav-icon">
                      <NavIcon type={item.key} />
                    </span>
                    <span className="console-nav-text">
                      <span>{item.label}</span>
                    </span>
                  </span>
                </Button>
              ))}
            </div>
            <div className="console-sidebar-footer">
              <ThemeToggle className="console-page-theme-toggle" tooltipPlacement="right" onResolvedThemeChange={setResolvedTheme} />
              <SidebarUserMenu
                user={sidebarUser}
                className="console-sidebar-user-menu"
                actions={[{ label: '返回生图', onClick: onClose }]}
                onLogout={onLogout}
              />
            </div>
          </aside>

          <section className="console-main">
            <header className="console-topbar">
              <div className="console-title-block">
                <h1>{activeNavItem.label}</h1>
                <p>{tabSubtitles[tab]}</p>
              </div>
              <div className="console-page-actions">
                <Button
                  className="console-refresh-button"
                  icon={<ReloadOutlined />}
                  loading={isRefreshing}
                  onClick={() => void refresh()}
                >
                  刷新
                </Button>
              </div>
            </header>

            <div className="console-content-body">
              {tab === 'users' && (
                <div className="console-panel-actionbar flex justify-end px-5 py-4">
                  <Button
                    type="primary"
                    icon={<UserAddOutlined />}
                    onClick={() => {
                      setDialogError(null)
                      setShowCreateUser(true)
                    }}
                  >
                    创建用户
                  </Button>
                </div>
              )}

              <div className="console-stats-grid grid gap-3 bg-gray-50/60 p-4 dark:bg-white/[0.02] sm:grid-cols-4">
                <Stat label="用户总数" value={totals.users} trend="+12%" icon="users" />
                <Stat label="启用账号" value={totals.enabled} trend="+8%" icon="enabled" />
                <Stat label="总 Credits" value={totals.credits} trend="+23%" icon="credits" />
                <Stat label="今日生成" value={totals.today} trend="+15%" icon="today" />
              </div>

              {error && (
                <div className="mx-5 mt-4">
                  <Alert type="error" showIcon title={error} />
                </div>
              )}

              {tab === 'users' && (
                <div className="console-table-panel p-5">
                  <Table<AppUser>
                    className="console-compact-table"
                    rowKey="id"
                    size="small"
                    columns={userColumns}
                    dataSource={users}
                    loading={tableLoading.users}
                    pagination={compactPagination}
                    scroll={{ x: 1660, y: TABLE_SCROLL_Y }}
                    locale={tableLocale('暂无用户')}
                  />
                </div>
              )}

              {tab === 'credits' && (
                <div className="console-table-panel p-5">
                  <Table<CreditRecord>
                    className="console-compact-table"
                    rowKey="id"
                    size="small"
                    columns={creditColumns}
                    dataSource={creditRecords}
                    loading={tableLoading.credits}
                    pagination={compactPagination}
                    scroll={{ x: 1010, y: TABLE_SCROLL_Y }}
                    locale={tableLocale('暂无充值或退款记录')}
                  />
                </div>
              )}

              {tab === 'usage' && (
                <div className="console-table-panel p-5">
                  <Form layout="vertical" className="console-filter-form mb-4 rounded-xl border border-gray-200/70 bg-gray-50 p-3 dark:border-white/[0.08] dark:bg-white/[0.03]">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Form.Item label="用户" className="mb-0">
                      <Select
                        value={usageFilters.userId}
                        disabled={usageFilters.onlyMine}
                        options={[{ value: '', label: '全部用户' }, ...users.map((user) => ({ value: user.id, label: user.username }))]}
                        onChange={(value) => setUsageFilters((filters) => ({ ...filters, userId: value }))}
                      />
                    </Form.Item>
                    <Form.Item label="模型" className="mb-0">
                      <Select
                        value={usageFilters.model}
                        options={modelOptions}
                        onChange={(value) => setUsageFilters((filters) => ({ ...filters, model: value }))}
                      />
                    </Form.Item>
                    <Form.Item label="质量" className="mb-0">
                      <Select
                        value={usageFilters.quality}
                        options={QUALITY_OPTIONS}
                        onChange={(value) => setUsageFilters((filters) => ({ ...filters, quality: value }))}
                      />
                    </Form.Item>
                    <Form.Item label="状态" className="mb-0">
                      <Select
                        value={usageFilters.status}
                        options={TASK_STATUS_OPTIONS}
                        onChange={(value) => setUsageFilters((filters) => ({ ...filters, status: value }))}
                      />
                    </Form.Item>
                    <Form.Item label="日期范围" className="mb-0 console-date-range-item">
                      <DatePicker.RangePicker
                        className="w-full"
                        value={usageFilters.from || usageFilters.to ? [
                          usageFilters.from ? dayjs(usageFilters.from) : null,
                          usageFilters.to ? dayjs(usageFilters.to) : null,
                        ] : null}
                        onChange={(values) => setUsageFilters((filters) => ({
                          ...filters,
                          from: values?.[0] ? values[0].format('YYYY-MM-DD') : '',
                          to: values?.[1] ? values[1].format('YYYY-MM-DD') : '',
                        }))}
                      />
                    </Form.Item>
                    <Form.Item label="提示词" className="mb-0">
                      <Input
                        value={usageFilters.keyword}
                        placeholder="提示词关键词"
                        onChange={(event) => setUsageFilters((filters) => ({ ...filters, keyword: event.target.value }))}
                      />
                    </Form.Item>
                    <Form.Item label="最小 Credits" className="mb-0">
                      <Input
                        value={usageFilters.minCredits}
                        placeholder="最小 Credits"
                        onChange={(event) => setUsageFilters((filters) => ({ ...filters, minCredits: event.target.value }))}
                      />
                    </Form.Item>
                    <Form.Item label="最大 Credits" className="mb-0">
                      <Input
                        value={usageFilters.maxCredits}
                        placeholder="最大 Credits"
                        onChange={(event) => setUsageFilters((filters) => ({ ...filters, maxCredits: event.target.value }))}
                      />
                    </Form.Item>
                    <Form.Item label="仅看我" className="mb-0 console-only-mine-item">
                      <Switch
                        checked={usageFilters.onlyMine}
                        onChange={(checked) => setUsageFilters((filters) => ({ ...filters, onlyMine: checked, userId: checked ? '' : filters.userId }))}
                      />
                    </Form.Item>
                    <Form.Item label=" " colon={false} className="mb-0 console-filter-actions">
                      <div className="console-filter-action-row">
                        <Button type="primary" icon={<SearchOutlined />} loading={tableLoading.usage} onClick={applyUsageFilters}>筛选</Button>
                        <Button
                          icon={<ReloadOutlined />}
                          loading={tableLoading.usage}
                          onClick={() => void resetUsageFilters()}
                        >
                          重置
                        </Button>
                      </div>
                    </Form.Item>
                  </div>
                </Form>
                  <Table<UsageRecord>
                    className="console-compact-table"
                    rowKey="id"
                    size="small"
                    columns={usageColumns}
                    dataSource={usageRecords}
                    loading={tableLoading.usage}
                    pagination={{ ...compactPagination, pageSize: 6 }}
                    scroll={{ x: 1180, y: TABLE_SCROLL_Y }}
                    locale={tableLocale('暂无消费记录')}
                  />
                </div>
              )}

          {tab === 'settings' && (
            <div className="console-settings-panel grid gap-4 p-5 lg:grid-cols-2">
              <section className="rounded-xl border border-gray-200/70 p-4 dark:border-white/[0.08] lg:col-span-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">基础信息</h3>
                <Form layout="vertical" className="mt-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                    <Form.Item label="系统名称" className="mb-0">
                      <Input
                        value={settingsDraft.appName}
                        placeholder={appName}
                        onChange={(event) => setSettingsDraft({ ...settingsDraft, appName: event.target.value })}
                      />
                    </Form.Item>
                    <Form.Item label=" " colon={false} className="mb-0">
                      <Button type="primary" onClick={saveSiteSettings}>保存基础信息</Button>
                    </Form.Item>
                  </div>
                </Form>
              </section>

              <section className="rounded-xl border border-gray-200/70 p-4 dark:border-white/[0.08] lg:col-span-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">安全与注册</h3>
                <Form layout="vertical" className="mt-4">
                  <Form.Item label="允许公开注册">
                    <Switch
                      checked={settingsDraft.registrationOpen}
                      checkedChildren="开启"
                      unCheckedChildren="关闭"
                      onChange={(checked) => setSettingsDraft((draft) => ({ ...draft, registrationOpen: checked }))}
                    />
                  </Form.Item>
                  {settingsDraft.registrationOpen && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Form.Item label="新用户默认 Credits">
                        <Input
                          value={settingsDraft.defaultCredits}
                          placeholder={SETTINGS_PLACEHOLDERS.defaultCredits}
                          onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultCredits: event.target.value })}
                        />
                      </Form.Item>
                      <Form.Item label="新用户默认倍率">
                        <Input
                          value={settingsDraft.defaultMultiplier}
                          placeholder={SETTINGS_PLACEHOLDERS.defaultMultiplier}
                          onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultMultiplier: event.target.value })}
                        />
                      </Form.Item>
                    </div>
                  )}
                  <Button type="primary" onClick={saveAuthSettings}>保存注册设置</Button>
                </Form>
              </section>

              <section className="rounded-xl border border-gray-200/70 p-4 dark:border-white/[0.08] lg:col-span-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">任务队列</h3>
                <Form layout="vertical" className="mt-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Form.Item label="全局并发上限">
                      <Input
                        value={settingsDraft.globalConcurrency}
                        placeholder={SETTINGS_PLACEHOLDERS.globalConcurrency}
                        onChange={(event) => setSettingsDraft({ ...settingsDraft, globalConcurrency: event.target.value })}
                      />
                    </Form.Item>
                    <Form.Item label="用户默认并发">
                      <Input
                        value={settingsDraft.defaultUserConcurrency}
                        placeholder={SETTINGS_PLACEHOLDERS.defaultUserConcurrency}
                        onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultUserConcurrency: event.target.value })}
                      />
                    </Form.Item>
                    <Form.Item label="单用户队列上限">
                      <Input
                        value={settingsDraft.maxQueueSize}
                        placeholder={SETTINGS_PLACEHOLDERS.maxQueueSize}
                        onChange={(event) => setSettingsDraft({ ...settingsDraft, maxQueueSize: event.target.value })}
                      />
                    </Form.Item>
                  </div>
                  <Button type="primary" onClick={saveQueueSettings}>保存队列设置</Button>
                </Form>
              </section>

              <section className="rounded-xl border border-gray-200/70 p-4 dark:border-white/[0.08] lg:col-span-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">模型服务</h3>
                <div className="mt-4 grid gap-3">
                  {modelDrafts.map((model, index) => (
                    <Form key={model.id ?? index} layout="vertical" className="rounded-xl border border-gray-100 p-3 dark:border-white/[0.06]">
                      <div className="grid gap-3 md:grid-cols-[1fr_1.4fr_1fr_110px]">
                        <Form.Item label="名称">
                          <Input value={model.name} onChange={(event) => setModelDrafts((items) => items.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} placeholder="名称" />
                        </Form.Item>
                        <Form.Item label="API URL">
                          <Input value={model.baseUrl} onChange={(event) => setModelDrafts((items) => items.map((item, i) => i === index ? { ...item, baseUrl: event.target.value } : item))} placeholder="API URL" />
                        </Form.Item>
                        <Form.Item label="模型 ID">
                          <Input value={model.model} onChange={(event) => setModelDrafts((items) => items.map((item, i) => i === index ? { ...item, model: event.target.value } : item))} placeholder="模型 ID" />
                        </Form.Item>
                        <Form.Item label="超时秒">
                          <Input value={model.timeoutSeconds} onChange={(event) => setModelDrafts((items) => items.map((item, i) => i === index ? { ...item, timeoutSeconds: Math.max(10, Number(event.target.value) || 120) } : item))} placeholder="超时秒" />
                        </Form.Item>
                      </div>
                      <div className="grid gap-3 md:grid-cols-[1fr_140px_140px_120px_120px_auto]">
                        <Form.Item label="API Key">
                          <Input.Password value={model.apiKey ?? ''} onChange={(event) => setModelDrafts((items) => items.map((item, i) => i === index ? { ...item, apiKey: event.target.value } : item))} placeholder="留空保持原值" />
                        </Form.Item>
                        <Form.Item label="API 模式">
                          <Select value={model.apiMode} options={API_MODE_OPTIONS} onChange={(value) => setModelDrafts((items) => items.map((item, i) => i === index ? { ...item, apiMode: value as ModelApiMode } : item))} />
                        </Form.Item>
                        <Form.Item label="适用环境">
                          <Select value={model.environment ?? 'all'} options={MODEL_ENVIRONMENT_OPTIONS} onChange={(value) => setModelDrafts((items) => items.map((item, i) => i === index ? { ...item, environment: value as ModelEnvironment } : item))} />
                        </Form.Item>
                        <Form.Item label="启用状态">
                          <Button block onClick={() => setModelDrafts((items) => items.map((item, i) => i === index ? { ...item, enabled: !item.enabled } : item))}>{model.enabled ? '启用' : '停用'}</Button>
                        </Form.Item>
                        <Form.Item label="默认模型">
                          <Button block type={model.isDefault ? 'primary' : 'default'} onClick={() => setModelDrafts((items) => items.map((item, i) => ({ ...item, isDefault: i === index })))}>默认</Button>
                        </Form.Item>
                        <Form.Item label="操作">
                          <Button block danger onClick={() => setModelDrafts((items) => items.length > 1 ? items.filter((_, i) => i !== index) : items)}>删除</Button>
                        </Form.Item>
                      </div>
                    </Form>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => setModelDrafts((items) => [...items, { ...DEFAULT_MODEL_DRAFT, name: '新模型', isDefault: items.length === 0 }])}>添加模型</Button>
                  <Button type="primary" onClick={saveModelProfiles}>保存模型服务</Button>
                </div>
              </section>

            </div>
          )}

            {tab === 'audit' && (
              <div className="console-table-panel p-5">
                  <Table<AuditLog>
                    className="console-compact-table"
                    rowKey="id"
                    size="small"
                    columns={auditColumns}
                    dataSource={auditLogs}
                    loading={tableLoading.audit}
                    pagination={compactPagination}
                    scroll={{ x: 1110, y: TABLE_SCROLL_Y }}
                    locale={tableLocale('暂无审计日志')}
                  />
              </div>
            )}
            </div>
        </section>
      </div>

        <Modal
          className="console-modal"
          open={showCreateUser}
          title="创建用户"
          onCancel={() => {
            setDialogError(null)
            setShowCreateUser(false)
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setDialogError(null)
                setShowCreateUser(false)
              }}
            >
              取消
            </Button>,
            <Button key="submit" type="primary" onClick={handleCreateUser}>创建</Button>,
          ]}
        >
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">创建普通用户账号，管理员权限需在数据库中手动调整。</p>
          <Form layout="vertical">
            <Form.Item label="用户名">
              <Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="用户名" />
            </Form.Item>
            <Form.Item label="邮箱">
              <Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="邮箱" />
            </Form.Item>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <Form.Item label="密码">
                <Input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="密码，至少 6 位" />
              </Form.Item>
              <div className="flex mb-[12px]">
                <Button className="w-full sm:w-auto" onClick={() => setForm((draft) => ({ ...draft, password: generatePassword() }))}>随机生成</Button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Form.Item label="Credits">
                <Input value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} placeholder="Credits" />
              </Form.Item>
              <Form.Item label="倍率">
                <Input value={form.multiplier} onChange={(event) => setForm({ ...form, multiplier: event.target.value })} placeholder="倍率" />
              </Form.Item>
              <Form.Item label="并发上限">
                <Input value={form.concurrencyLimit} onChange={(event) => setForm({ ...form, concurrencyLimit: event.target.value })} placeholder="留空使用默认" />
              </Form.Item>
            </div>
            {dialogError && <Alert type="error" showIcon title={dialogError} />}
          </Form>
        </Modal>

        <Modal
          className="console-modal"
          open={Boolean(editingUser)}
          title="编辑用户配置"
          onCancel={() => {
            setDialogError(null)
            setEditingUser(null)
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setDialogError(null)
                setEditingUser(null)
              }}
            >
              取消
            </Button>,
            <Button key="submit" type="primary" onClick={saveEditingUser}>保存</Button>,
          ]}
        >
          {editingUser && (
            <>
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">{editingUser.username} · {editingUser.email}</p>
              <Form layout="vertical">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Form.Item label="专属倍率">
                    <Input value={editUserForm.multiplier} onChange={(event) => setEditUserForm({ ...editUserForm, multiplier: event.target.value })} />
                  </Form.Item>
                  <Form.Item label="专属并发">
                    <Input value={editUserForm.concurrencyLimit} onChange={(event) => setEditUserForm({ ...editUserForm, concurrencyLimit: event.target.value })} placeholder="留空使用默认" />
                  </Form.Item>
                </div>
                <Form.Item label="备注">
                  <Input.TextArea value={editUserForm.note} onChange={(event) => setEditUserForm({ ...editUserForm, note: event.target.value })} rows={3} maxLength={500} placeholder="填写用户备注" />
                </Form.Item>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <Form.Item label="重置密码">
                    <Input value={editUserForm.password} onChange={(event) => setEditUserForm({ ...editUserForm, password: event.target.value })} placeholder="留空不修改密码" />
                  </Form.Item>
                  <div className="flex sm:pt-6">
                    <Button className="w-full sm:w-auto" onClick={() => setEditUserForm((draft) => ({ ...draft, password: generatePassword() }))}>随机生成</Button>
                  </div>
                </div>
                {editingUser.role !== 'admin' && (
                  <Form.Item label="账号状态">
                    <Switch
                      checked={!editUserForm.disabled}
                      checkedChildren="启用"
                      unCheckedChildren="禁用"
                      onChange={(checked) => setEditUserForm((draft) => ({ ...draft, disabled: !checked }))}
                    />
                  </Form.Item>
                )}
                {dialogError && <Alert type="error" showIcon title={dialogError} />}
              </Form>
            </>
          )}
        </Modal>

        <Modal
          className="console-modal"
          open={Boolean(creditTarget)}
          title={creditTarget?.type === 'recharge' ? '充值' : '退款'}
          onCancel={() => {
            setDialogError(null)
            setCreditTarget(null)
          }}
          footer={[
            <Button
              key="cancel"
              onClick={() => {
                setDialogError(null)
                setCreditTarget(null)
              }}
            >
              取消
            </Button>,
            <Button key="submit" type="primary" danger={creditTarget?.type === 'refund'} onClick={submitCreditDialog}>确认</Button>,
          ]}
        >
          {creditTarget && (
            <Form layout="vertical">
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-4 dark:bg-white/[0.04]">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                  {userInitial(creditTarget.user)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">{creditTarget.user.email}</div>
                  <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">当前余额：{creditTarget.user.credits.toFixed(2)} Credits</div>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <Form.Item label={creditTarget.type === 'recharge' ? '充值金额' : '退款金额'}>
                  <Input
                    value={creditForm.amount}
                    addonAfter="Credits"
                    placeholder="0"
                    onChange={(event) => setCreditForm((draft) => ({ ...draft, amount: event.target.value }))}
                  />
                </Form.Item>
                {creditTarget.type === 'refund' && (
                  <Form.Item label=" " colon={false}>
                    <Button onClick={() => setCreditForm((draft) => ({ ...draft, amount: String(Math.max(0, creditTarget.user.credits)) }))}>全部</Button>
                  </Form.Item>
                )}
              </div>
              <Form.Item label="备注">
                <Input.TextArea value={creditForm.note} onChange={(event) => setCreditForm((draft) => ({ ...draft, note: event.target.value }))} rows={3} maxLength={500} placeholder="填写本次操作备注" />
              </Form.Item>
              {dialogError && <Alert type="error" showIcon title={dialogError} />}
            </Form>
          )}
        </Modal>
        <Lightbox />
      </main>
    </ConfigProvider>
  )
}
