import { useMemo, useState } from 'react'
import {
  adjustUserCredits,
  createUser,
  deleteUser,
  readCreditRecords,
  readUsageRecords,
  readUsers,
  updateUser,
} from '../lib/auth'
import type { AppUser, UserRole } from '../lib/auth'

interface ConsolePageProps {
  currentUser: AppUser
  onClose: () => void
}

type ConsoleTab = 'users' | 'credits' | 'usage'

function formatTime(value: number) {
  return new Date(value).toLocaleString()
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200/70 bg-white px-5 py-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  )
}

function NavIcon({ type }: { type: ConsoleTab }) {
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
    <div className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
      {text}
    </div>
  )
}

export default function ConsolePage({ currentUser, onClose }: ConsolePageProps) {
  const [tab, setTab] = useState<ConsoleTab>('users')
  const [users, setUsers] = useState(readUsers)
  const [creditRecords, setCreditRecords] = useState(readCreditRecords)
  const [usageRecords, setUsageRecords] = useState(readUsageRecords)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [amountByUser, setAmountByUser] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: 'user123456',
    role: 'user' as UserRole,
    credits: '20',
    multiplier: '1',
  })

  const totals = useMemo(() => ({
    users: users.length,
    enabled: users.filter((user) => !user.disabled).length,
    credits: Number(users.reduce((sum, user) => sum + user.credits, 0).toFixed(2)),
  }), [users])

  const refresh = () => {
    setUsers(readUsers())
    setCreditRecords(readCreditRecords())
    setUsageRecords(readUsageRecords())
  }

  const handleCreateUser = () => {
    setError(null)
    const credits = Number(form.credits)
    const multiplier = Number(form.multiplier)
    if (!form.username.trim() || !form.email.trim() || !form.password.trim()) {
      setError('请填写用户名、邮箱和密码')
      return
    }
    if (!Number.isFinite(credits) || credits < 0) {
      setError('默认额度必须是非负数字')
      return
    }
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      setError('专属倍率必须是非负数字')
      return
    }
    const result = createUser({
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
    setForm({ username: '', email: '', password: 'user123456', role: 'user', credits: '20', multiplier: '1' })
    setShowCreateUser(false)
    refresh()
  }

  const adjustCredits = (user: AppUser, type: 'recharge' | 'refund') => {
    setError(null)
    const value = Number(amountByUser[user.id] ?? '10')
    if (!Number.isFinite(value) || value <= 0) {
      setError('请输入大于 0 的金额')
      return
    }
    adjustUserCredits(user.id, value, type, currentUser.username)
    refresh()
  }

  const navItems: Array<{ key: ConsoleTab; label: string; desc: string }> = [
    { key: 'users', label: '用户管理', desc: '账号、额度、倍率' },
    { key: 'credits', label: '充值记录', desc: '充值和退款流水' },
    { key: 'usage', label: '消费记录', desc: '生图扣费明细' },
  ]

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="safe-area-top sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur dark:border-white/[0.08] dark:bg-gray-950/90">
        <div className="safe-area-x safe-header-inner mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">控制台</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">用户管理、额度和计费记录</p>
          </div>
          <button onClick={onClose} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200">
            返回生图
          </button>
        </div>
      </header>

      <div className="safe-area-x mx-auto grid max-w-7xl gap-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/[0.08] dark:bg-gray-900">
          <div className="border-b border-gray-200/70 px-5 py-5 dark:border-white/[0.08]">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Workspace</div>
            <div className="mt-2 text-base font-bold text-gray-900 dark:text-gray-100">Hua Admin</div>
          </div>
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`relative flex w-full items-center gap-3 border-b border-gray-100 px-5 py-4 text-left transition last:border-b-0 dark:border-white/[0.06] ${tab === item.key ? 'bg-blue-50/80 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.04] dark:hover:text-gray-200'}`}
            >
              {tab === item.key && <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-blue-500" />}
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl transition ${tab === item.key ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400'}`}>
                <NavIcon type={item.key} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{item.label}</span>
                <span className="mt-0.5 block text-xs">{item.desc}</span>
              </span>
            </button>
          ))}
        </aside>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/[0.08] dark:bg-gray-900">
          <div className="border-b border-gray-200/70 px-7 py-7 dark:border-white/[0.08]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  {tab === 'users' ? '用户管理' : tab === 'credits' ? '充值记录' : '消费记录'}
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {tab === 'users' ? '创建、禁用用户，并直接在表格中调整额度与倍率。' : tab === 'credits' ? '查看每次充值和退款的时间、金额、管理员操作账号。' : '查看用户生图扣费、倍率和质量明细。'}
                </p>
              </div>
              {tab === 'users' && (
                <button onClick={() => setShowCreateUser(true)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">
                  创建用户
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-3 border-b border-gray-200/70 bg-gray-50/60 p-5 dark:border-white/[0.08] dark:bg-white/[0.02] sm:grid-cols-3">
            <Stat label="用户总数" value={totals.users} />
            <Stat label="启用账号" value={totals.enabled} />
            <Stat label="总 Credits" value={totals.credits} />
          </div>

          {error && <div className="mx-6 mt-5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</div>}

          {tab === 'users' && (
            <div className="overflow-x-auto p-6">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 dark:bg-white/[0.04] dark:text-gray-400">
                  <tr>
                    <th className="px-3 py-3">账号</th>
                    <th className="px-3 py-3">角色</th>
                    <th className="px-3 py-3">Credits</th>
                    <th className="px-3 py-3">专属倍率</th>
                    <th className="px-3 py-3">充值/退款</th>
                    <th className="px-3 py-3">状态</th>
                    <th className="px-3 py-3">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-gray-100 transition last:border-b-0 hover:bg-gray-50/70 dark:border-white/[0.06] dark:hover:bg-white/[0.03]">
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-800 dark:text-gray-100">{user.username}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </td>
                      <td className="px-3 py-3">{user.role}</td>
                      <td className="px-3 py-3 font-semibold">{user.credits.toFixed(2)}</td>
                      <td className="px-3 py-3">
                        <input
                          value={user.multiplier}
                          onChange={(event) => {
                            updateUser(user.id, { multiplier: Math.max(0, Number(event.target.value) || 0) })
                            refresh()
                          }}
                          className="w-20 rounded-lg border border-gray-200/70 bg-white/60 px-2 py-1.5 text-sm outline-none dark:border-white/[0.08] dark:bg-white/[0.03]"
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            value={amountByUser[user.id] ?? '10'}
                            onChange={(event) => setAmountByUser({ ...amountByUser, [user.id]: event.target.value })}
                            className="w-20 rounded-lg border border-gray-200/70 bg-white/60 px-2 py-1.5 text-sm outline-none dark:border-white/[0.08] dark:bg-white/[0.03]"
                          />
                          <button onClick={() => adjustCredits(user, 'recharge')} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">充值</button>
                          <button onClick={() => adjustCredits(user, 'refund')} className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:bg-white/[0.08] dark:text-gray-200">退款</button>
                        </div>
                      </td>
                      <td className="px-3 py-3">{user.disabled ? '禁用' : '启用'}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { updateUser(user.id, { disabled: !user.disabled }); refresh() }} className="rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-medium dark:bg-white/[0.08]">
                            {user.disabled ? '启用' : '禁用'}
                          </button>
                          <button disabled={user.id === currentUser.id} onClick={() => { deleteUser(user.id); refresh() }} className="rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 disabled:opacity-40 dark:bg-red-500/10 dark:text-red-300">
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'credits' && (
            <div className="p-6">
              {creditRecords.length === 0 ? <EmptyState text="暂无充值或退款记录" /> : (
                <div className="grid gap-2">
                  {creditRecords.map((record) => {
                    const user = users.find((item) => item.id === record.userId)
                    return (
                      <div key={record.id} className="grid gap-2 rounded-xl border border-gray-100 bg-white/60 px-4 py-3 text-sm dark:border-white/[0.06] dark:bg-white/[0.03] sm:grid-cols-[1fr_auto_auto] sm:items-center">
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
            <div className="p-6">
              {usageRecords.length === 0 ? <EmptyState text="暂无消费记录" /> : (
                <div className="grid gap-2">
                  {usageRecords.map((record) => {
                    const user = users.find((item) => item.id === record.userId)
                    return (
                      <div key={record.id} className="rounded-xl border border-gray-100 bg-white/60 px-4 py-3 text-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
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
        </section>
      </div>

      {showCreateUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm animate-overlay-in">
          <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-xl animate-confirm-in dark:border-white/[0.08] dark:bg-gray-900">
            <div className="border-b border-gray-200/70 px-6 py-5 dark:border-white/[0.08]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold tracking-tight">创建用户</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">设置账号信息、角色、默认额度和专属倍率。</p>
                </div>
                <button onClick={() => setShowCreateUser(false)} className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/[0.08] dark:hover:text-gray-200">×</button>
              </div>
            </div>
            <div className="grid gap-3 px-6 py-5">
              <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="用户名" className="rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03]" />
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="邮箱" className="rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03]" />
              <input value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="密码" className="rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03]" />
              <div className="grid gap-2 sm:grid-cols-2">
                {(['user', 'admin'] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setForm({ ...form, role })}
                    className={`rounded-xl border px-4 py-3 text-left transition ${form.role === role ? 'border-blue-300 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-500/50 dark:bg-blue-500/10 dark:text-blue-300' : 'border-gray-200/70 bg-white/60 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.06]'}`}
                  >
                    <span className="block text-sm font-semibold">{role}</span>
                    <span className="mt-1 block text-xs opacity-75">{role === 'admin' ? '可进入控制台和全局设置' : '仅可生图和查看个人记录'}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={form.credits} onChange={(event) => setForm({ ...form, credits: event.target.value })} placeholder="Credits" className="rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm outline-none dark:border-white/[0.08] dark:bg-white/[0.03]" />
                <input value={form.multiplier} onChange={(event) => setForm({ ...form, multiplier: event.target.value })} placeholder="倍率" className="rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm outline-none dark:border-white/[0.08] dark:bg-white/[0.03]" />
              </div>
              {error && <div className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-500/10 dark:text-red-300">{error}</div>}
              <div className="mt-2 flex justify-end gap-2 border-t border-gray-100 pt-4 dark:border-white/[0.06]">
                <button onClick={() => setShowCreateUser(false)} className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 dark:bg-white/[0.08] dark:text-gray-200">取消</button>
                <button onClick={handleCreateUser} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">创建</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
