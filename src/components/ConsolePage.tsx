import { useEffect, useMemo, useState } from 'react'
import {
  adjustUserCredits,
  createUser,
  deleteUser,
  readCreditRecords,
  readSystemSettings,
  readUsageRecords,
  listUsers,
  updateAuthSettings,
  updateImageApiSettings,
  updateUser,
} from '../lib/auth'
import type { AppUser, CreditRecord, SystemSettings, UsageRecord, UserRole } from '../lib/auth'

interface ConsolePageProps {
  currentUser: AppUser
  onClose: () => void
}

type ConsoleTab = 'users' | 'credits' | 'usage' | 'settings'

const EMPTY_SETTINGS_DRAFT = {
  registrationOpen: true,
  defaultCredits: '',
  defaultMultiplier: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  apiMode: 'images' as SystemSettings['imageApi']['apiMode'],
  timeoutSeconds: '',
}

const EMPTY_CREATE_USER_FORM = {
  username: '',
  email: '',
  password: '',
  role: 'user' as UserRole,
  credits: '',
  multiplier: '',
}

function formatTime(value: number) {
  return new Date(value).toLocaleString()
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200/70 bg-white px-4 py-3 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{value}</div>
    </div>
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

export default function ConsolePage({ currentUser, onClose }: ConsolePageProps) {
  const [tab, setTab] = useState<ConsoleTab>('users')
  const [users, setUsers] = useState<AppUser[]>([])
  const [creditRecords, setCreditRecords] = useState<CreditRecord[]>([])
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([])
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null)
  const [settingsDraft, setSettingsDraft] = useState(EMPTY_SETTINGS_DRAFT)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [amountByUser, setAmountByUser] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_CREATE_USER_FORM)

  const totals = useMemo(() => ({
    users: users.length,
    enabled: users.filter((user) => !user.disabled).length,
    credits: Number(users.reduce((sum, user) => sum + user.credits, 0).toFixed(2)),
  }), [users])

  const refresh = async () => {
    try {
      const [nextUsers, nextCreditRecords, nextUsageRecords] = await Promise.all([
        listUsers(),
        readCreditRecords(),
        readUsageRecords(true),
      ])
    setUsers(nextUsers)
      setCreditRecords(nextCreditRecords)
      setUsageRecords(nextUsageRecords)
    } catch (error) {
      setError(error instanceof Error ? error.message : '数据加载失败')
    }
  }

  const refreshSettings = async () => {
    const settings = await readSystemSettings()
    setSystemSettings(settings)
    setSettingsDraft({
      registrationOpen: settings.auth.registrationOpen,
      defaultCredits: String(settings.auth.defaultCredits),
      defaultMultiplier: String(settings.auth.defaultMultiplier),
      baseUrl: settings.imageApi.baseUrl,
      apiKey: settings.imageApi.apiKey ?? '',
      model: settings.imageApi.model,
      apiMode: settings.imageApi.apiMode,
      timeoutSeconds: String(settings.imageApi.timeoutSeconds),
    })
    setForm((current) => ({
      ...current,
      credits: current.credits || String(settings.auth.defaultCredits),
      multiplier: current.multiplier || String(settings.auth.defaultMultiplier),
    }))
  }

  useEffect(() => {
    void refresh()
    void refreshSettings().catch((error) => {
      setError(error instanceof Error ? error.message : '系统设置加载失败')
    })
  }, [])

  const handleCreateUser = async () => {
    setError(null)
    const credits = Number(form.credits)
    const multiplier = Number(form.multiplier)
    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setError('请填写用户名、邮箱和密码')
      return
    }
    if (!Number.isFinite(credits) || credits < 0) {
      setError('用户额度必须是非负数字')
      return
    }
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      setError('专属倍率必须是非负数字，允许填写 0.2 这类小数')
      return
    }
    const result = await createUser({
      username: form.username,
      email: form.email,
      password: form.password,
      role: form.role,
      credits,
      multiplier,
    })
    if (!result.user) {
      setError(result.error)
      return
    }
    setForm({
      ...EMPTY_CREATE_USER_FORM,
      credits: systemSettings ? String(systemSettings.auth.defaultCredits) : '',
      multiplier: systemSettings ? String(systemSettings.auth.defaultMultiplier) : '',
    })
    setShowCreateUser(false)
    await refresh()
  }

  const adjustCredits = async (user: AppUser, type: 'recharge' | 'refund') => {
    setError(null)
    const value = Number(amountByUser[user.id] ?? '')
    if (!Number.isFinite(value) || value <= 0) {
      setError('请输入大于 0 的金额')
      return
    }
    await adjustUserCredits(user.id, value, type)
    await refresh()
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
  }

  const saveImageApiSettings = async () => {
    setError(null)
    const timeoutSeconds = Number(settingsDraft.timeoutSeconds)
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 900) {
      setError('请求超时必须在 10 到 900 秒之间')
      return
    }
    const settings = await updateImageApiSettings({
      provider: 'openai-compatible',
      baseUrl: settingsDraft.baseUrl.trim(),
      apiKey: settingsDraft.apiKey.trim() || systemSettings?.imageApi.apiKey,
      model: settingsDraft.model.trim(),
      apiMode: settingsDraft.apiMode,
      timeoutSeconds,
    })
    setSystemSettings(settings)
  }

  const navItems: Array<{ key: ConsoleTab; label: string; desc: string }> = [
    { key: 'users', label: '用户管理', desc: '账号、额度、倍率' },
    { key: 'credits', label: '充值记录', desc: '充值和退款流水' },
    { key: 'usage', label: '消费记录', desc: '生图扣费明细' },
    { key: 'settings', label: '系统设置', desc: '注册、上游 API、存储' },
  ]

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="safe-area-top sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-white/[0.08] dark:bg-gray-950/80">
        <div className="safe-area-x safe-header-inner mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-[17px] font-bold tracking-tight">控制台</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">用户管理、额度和计费记录</p>
          </div>
          <button onClick={onClose} className="rounded-xl bg-gray-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200">
            返回生图
          </button>
        </div>
      </header>

      <div className="safe-area-x mx-auto grid max-w-7xl items-start gap-5 py-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="self-start overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-sm dark:border-white/[0.08] dark:bg-gray-900">
          <div className="border-b border-gray-200/70 px-4 py-4 dark:border-white/[0.08]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gray-400">系统管理</div>
            <div className="mt-1.5 text-sm font-bold text-gray-900 dark:text-gray-100">管理控制台</div>
          </div>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`relative flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 dark:border-white/[0.06] ${tab === item.key ? 'bg-blue-50/80 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.04] dark:hover:text-gray-200'}`}
            >
              {tab === item.key && <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-blue-500" />}
              <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${tab === item.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'}`}>
                <NavIcon type={item.key} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block text-xs">{item.desc}</span>
              </span>
            </button>
          ))}
        </aside>

        <section className="min-w-0 overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-sm dark:border-white/[0.08] dark:bg-gray-900">
          <div className="border-b border-gray-200/70 px-5 py-5 dark:border-white/[0.08]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">
                  {tab === 'users' ? '用户管理' : tab === 'credits' ? '充值记录' : tab === 'usage' ? '消费记录' : '系统设置'}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {tab === 'users' ? '创建、禁用用户，并直接在表格中调整额度与倍率。' : tab === 'credits' ? '查看每次充值和退款的时间、金额、管理员操作账号。' : tab === 'usage' ? '查看用户生图扣费、倍率和质量明细。' : '配置开放注册、默认额度、模型服务和存储选项。'}
                </p>
              </div>
              {tab === 'users' && (
                <button onClick={() => setShowCreateUser(true)} className="rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                  创建用户
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 border-b border-gray-200/70 bg-gray-50/60 p-4 dark:border-white/[0.08] dark:bg-white/[0.02] sm:grid-cols-3">
            <Stat label="用户总数" value={totals.users} />
            <Stat label="启用账号" value={totals.enabled} />
            <Stat label="总 Credits" value={totals.credits} />
          </div>

          {error && <div className="mx-5 mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</div>}

          {tab === 'users' && (
            <div className="p-5">
              <div className="overflow-x-auto rounded-xl border border-gray-200/70 dark:border-white/[0.08]">
                <div className="min-w-[980px]">
                  <table className="w-full table-fixed text-left text-sm">
                    <colgroup>
                      <col className="w-[23%]" />
                      <col className="w-[9%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[24%]" />
                      <col className="w-[8%]" />
                      <col className="w-[14%]" />
                    </colgroup>
                    <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                      <tr className="shadow-[0_1px_0_rgba(229,231,235,0.9)] dark:shadow-[0_1px_0_rgba(255,255,255,0.08)]">
                        <th className="px-3 py-2.5">账号</th>
                        <th className="px-3 py-2.5">角色</th>
                        <th className="px-3 py-2.5">Credits</th>
                        <th className="px-3 py-2.5">专属倍率</th>
                        <th className="px-3 py-2.5">充值/退款</th>
                        <th className="px-3 py-2.5">状态</th>
                        <th className="px-3 py-2.5">操作</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="max-h-[520px] overflow-y-auto">
                    <table className="w-full table-fixed text-left text-sm">
                      <colgroup>
                        <col className="w-[23%]" />
                        <col className="w-[9%]" />
                        <col className="w-[10%]" />
                        <col className="w-[12%]" />
                        <col className="w-[24%]" />
                        <col className="w-[8%]" />
                        <col className="w-[14%]" />
                      </colgroup>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id} className="border-b border-gray-100 transition last:border-b-0 hover:bg-gray-50/70 dark:border-white/[0.06] dark:hover:bg-white/[0.03]">
                            <td className="px-3 py-2.5">
                              <div className="font-medium text-gray-800 dark:text-gray-100">{user.username}</div>
                              <div className="text-xs text-gray-500">{user.email}</div>
                            </td>
                            <td className="px-3 py-2.5">{user.role}</td>
                            <td className="px-3 py-2.5 font-semibold">{user.credits.toFixed(2)}</td>
                            <td className="px-3 py-2.5">
                              <input
                                value={user.multiplier}
                                onChange={(event) => {
                                  void updateUser(user.id, { multiplier: Math.max(0, Number(event.target.value) || 0) }).then(refresh)
                                }}
                                className="w-20 rounded-lg border border-gray-200/70 bg-white px-2 py-1.5 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <input
                                  value={amountByUser[user.id] ?? ''}
                                  onChange={(event) => setAmountByUser({ ...amountByUser, [user.id]: event.target.value })}
                                  placeholder="金额"
                                  className="w-20 rounded-lg border border-gray-200/70 bg-white px-2 py-1.5 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]"
                                />
                                <button onClick={() => adjustCredits(user, 'recharge')} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">充值</button>
                                <button onClick={() => adjustCredits(user, 'refund')} className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:bg-white/[0.08] dark:text-gray-200">退款</button>
                              </div>
                            </td>
                            <td className="px-3 py-2.5">{user.disabled ? '禁用' : '启用'}</td>
                            <td className="px-3 py-2.5">
                              <div className="flex gap-2">
                                <button onClick={() => { void updateUser(user.id, { disabled: !user.disabled }).then(refresh) }} className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium dark:bg-white/[0.08]">
                                  {user.disabled ? '启用' : '禁用'}
                                </button>
                                <button disabled={user.id === currentUser.id} onClick={() => { void deleteUser(user.id).then(refresh) }} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 disabled:opacity-40 dark:bg-red-500/10 dark:text-red-300">
                                  删除
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'credits' && (
            <div className="p-5">
              {creditRecords.length === 0 ? <EmptyState text="暂无充值或退款记录" /> : (
                <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
                  {creditRecords.map((record) => {
                    const user = users.find((item) => item.id === record.userId)
                    return (
                      <div key={record.id} className="grid gap-2 rounded-xl border border-gray-100 bg-white px-3.5 py-3 text-sm shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03] sm:grid-cols-[1fr_auto_auto] sm:items-center">
                        <div>
                          <div className="font-medium text-gray-800 dark:text-gray-100">{user?.username ?? '未知用户'} · {record.type === 'recharge' ? '充值' : '退款'} {record.amount} Credits</div>
                          <div className="mt-0.5 text-xs text-gray-500">管理员：{record.operatorUsername}</div>
                        </div>
                        <div className="text-xs text-gray-500">{formatTime(record.createdAt)}</div>
                        <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${record.type === 'recharge' ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-gray-300'}`}>
                          {record.type === 'recharge' ? '+' : '-'}{record.amount}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'usage' && (
            <div className="p-5">
              {usageRecords.length === 0 ? <EmptyState text="暂无消费记录" /> : (
                <div className="grid max-h-[520px] gap-2 overflow-auto pr-1">
                  {usageRecords.map((record) => {
                    const user = users.find((item) => item.id === record.userId)
                    return (
                      <div key={record.id} className="rounded-xl border border-gray-100 bg-white px-3.5 py-3 text-sm shadow-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="font-medium text-gray-800 dark:text-gray-100">{user?.username ?? '未知用户'} 消耗 {record.totalCredits} Credits</div>
                          <div className="text-xs text-gray-500">{formatTime(record.createdAt)}</div>
                        </div>
                        <div className="mt-1 text-xs text-gray-500">质量 {record.quality}，图片 {record.imageCount} 张，基础 {record.baseCredits}，倍率 {record.multiplier}</div>
                        <div className="mt-2 line-clamp-1 text-xs text-gray-500">{record.prompt}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'settings' && (
            <div className="grid gap-4 p-5 lg:grid-cols-2">
              <section className="rounded-xl border border-gray-200/70 p-4 dark:border-white/[0.08]">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">安全与注册</h3>
                <div className="mt-4 space-y-4">
                  <label className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2.5 dark:bg-white/[0.04]">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">允许公开注册</span>
                    <button
                      type="button"
                      onClick={() => setSettingsDraft((draft) => ({ ...draft, registrationOpen: !draft.registrationOpen }))}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${settingsDraft.registrationOpen ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'}`}
                      role="switch"
                      aria-checked={settingsDraft.registrationOpen}
                    >
                      <span className={`h-4 w-4 rounded-full bg-white shadow transition ${settingsDraft.registrationOpen ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">新用户默认 Credits</span>
                      <input value={settingsDraft.defaultCredits} onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultCredits: event.target.value })} className="w-full rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">新用户默认倍率</span>
                      <input value={settingsDraft.defaultMultiplier} onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultMultiplier: event.target.value })} className="w-full rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
                    </label>
                  </div>
                  <button onClick={saveAuthSettings} className="rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">保存注册设置</button>
                </div>
              </section>

              <section className="rounded-xl border border-gray-200/70 p-4 dark:border-white/[0.08]">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">上游 API</h3>
                <div className="mt-4 space-y-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">API URL</span>
                    <input value={settingsDraft.baseUrl} onChange={(event) => setSettingsDraft({ ...settingsDraft, baseUrl: event.target.value })} placeholder="https://api.openai.com/v1" className="w-full rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">API Key</span>
                    <input value={settingsDraft.apiKey} onChange={(event) => setSettingsDraft({ ...settingsDraft, apiKey: event.target.value })} type="password" placeholder={systemSettings?.imageApi.apiKey ? '已配置，留空保持不变' : 'sk-...'} className="w-full rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-[1fr_140px_110px]">
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">模型 ID</span>
                      <input value={settingsDraft.model} onChange={(event) => setSettingsDraft({ ...settingsDraft, model: event.target.value })} className="w-full rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">接口模式</span>
                      <select value={settingsDraft.apiMode} onChange={(event) => setSettingsDraft({ ...settingsDraft, apiMode: event.target.value as SystemSettings['imageApi']['apiMode'] })} className="w-full rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]">
                        <option value="images">Images</option>
                        <option value="responses">Responses</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">超时秒</span>
                      <input value={settingsDraft.timeoutSeconds} onChange={(event) => setSettingsDraft({ ...settingsDraft, timeoutSeconds: event.target.value })} className="w-full rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
                    </label>
                  </div>
                  <button onClick={saveImageApiSettings} className="rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">保存 API 设置</button>
                </div>
              </section>

              <section className="rounded-xl border border-gray-200/70 p-4 dark:border-white/[0.08] lg:col-span-2">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">S3 对象存储桶设置</h3>
                <div className="mt-3 rounded-xl bg-gray-50 px-4 py-5 text-sm text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
                  敬请期待。当前图片保存到本地存储空间。
                </div>
              </section>
            </div>
          )}
        </section>
      </div>

      {showCreateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm animate-overlay-in">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-gray-200/70 bg-white shadow-xl animate-confirm-in dark:border-white/[0.08] dark:bg-gray-900">
            <div className="border-b border-gray-200/70 px-5 py-4 dark:border-white/[0.08]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight">创建用户</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">设置账号信息、角色、默认额度和专属倍率。</p>
                </div>
                <button onClick={() => setShowCreateUser(false)} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-gray-200">×</button>
              </div>
            </div>
            <div className="grid gap-3 px-5 py-4">
              <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="用户名" className="rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="邮箱" className="rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
              <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="密码" className="rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
              <div className="grid gap-2 sm:grid-cols-2">
                {(['user', 'admin'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm({ ...form, role })}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${form.role === role ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300' : 'border-gray-200/70 bg-white text-gray-600 shadow-sm hover:border-gray-300 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]'}`}
                  >
                    <span className="block text-sm font-semibold">{role}</span>
                    <span className="mt-1 block text-xs opacity-75">{role === 'admin' ? '可进入控制台和全局设置' : '仅可生图和查看个人记录'}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} placeholder="Credits" className="rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
                <input value={form.multiplier} onChange={(event) => setForm({ ...form, multiplier: event.target.value })} placeholder="倍率" className="rounded-xl border border-gray-200/70 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30 dark:border-white/[0.08] dark:bg-white/[0.03]" />
              </div>
              {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
              <div className="mt-2 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.06]">
                <button onClick={() => setShowCreateUser(false)} className="rounded-xl bg-gray-100 px-3.5 py-2 text-sm font-medium text-gray-700 dark:bg-white/[0.08] dark:text-gray-200">取消</button>
                <button onClick={handleCreateUser} className="rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">创建</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
