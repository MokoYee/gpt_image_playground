import { useState } from 'react'
import { readUsageRecords, updateUser } from '../lib/auth'
import type { AppUser } from '../lib/auth'

interface AccountPageProps {
  user: AppUser
  onClose: () => void
  onUserChange: (user: AppUser) => void
}

function formatTime(value: number) {
  return new Date(value).toLocaleString()
}

export default function AccountPage({ user, onClose, onUserChange }: AccountPageProps) {
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const usageRecords = readUsageRecords().filter((record) => record.userId === user.id)

  const changePassword = () => {
    if (oldPassword !== user.password) {
      setMessage('原密码不正确')
      return
    }
    if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setMessage('新密码至少 8 位，并包含字母和数字')
      return
    }
    const nextUser = updateUser(user.id, { password: newPassword })
    if (nextUser) onUserChange(nextUser)
    setOldPassword('')
    setNewPassword('')
    setMessage('密码已修改')
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="safe-area-top sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-white/[0.08] dark:bg-gray-950/80">
        <div className="safe-area-x safe-header-inner mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight">我的账户</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
          <button onClick={onClose} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-200">
            返回生图
          </button>
        </div>
      </header>

      <div className="safe-area-x mx-auto grid max-w-5xl gap-5 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-xl border border-gray-200/70 bg-white/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <h2 className="text-sm font-semibold">账户额度</h2>
          <div className="mt-4 rounded-xl bg-blue-50 p-4 dark:bg-blue-500/10">
            <div className="text-xs text-blue-600 dark:text-blue-300">当前 Credits</div>
            <div className="mt-1 text-3xl font-bold text-blue-700 dark:text-blue-200">{user.credits.toFixed(2)}</div>
            <div className="mt-2 text-xs text-blue-600/80 dark:text-blue-300/80">专属倍率：{user.multiplier}x</div>
          </div>

          <h2 className="mt-6 text-sm font-semibold">修改密码</h2>
          <div className="mt-3 grid gap-3">
            <input value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} type="password" placeholder="原密码" className="rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03]" />
            <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" placeholder="新密码" className="rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm outline-none focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03]" />
            {message && <div className="rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-white/[0.08] dark:text-gray-300">{message}</div>}
            <button onClick={changePassword} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700">保存密码</button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200/70 bg-white/70 p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
          <h2 className="text-sm font-semibold">我的消费记录</h2>
          <div className="mt-4 grid gap-3">
            {usageRecords.length === 0 && (
              <div className="rounded-xl bg-gray-100 px-4 py-6 text-center text-sm text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
                暂无消费记录
              </div>
            )}
            {usageRecords.map((record) => (
              <div key={record.id} className="rounded-xl border border-gray-100 bg-white/60 p-3 text-sm dark:border-white/[0.06] dark:bg-white/[0.03]">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-gray-800 dark:text-gray-100">-{record.totalCredits} Credits</div>
                  <div className="text-xs text-gray-500">{formatTime(record.createdAt)}</div>
                </div>
                <div className="mt-1 text-xs text-gray-500">质量 {record.quality}，图片 {record.imageCount} 张，倍率 {record.multiplier}</div>
                <div className="mt-2 line-clamp-2 text-xs text-gray-500">{record.prompt}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
