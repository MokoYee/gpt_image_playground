import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { authenticateUser, createUser, DEFAULT_ADMIN } from '../lib/auth'
import type { AppUser } from '../lib/auth'

type AuthMode = 'login' | 'register' | 'forgot'

interface AuthPageProps {
  onAuthenticated: (user: AppUser) => void
}

function validateUsername(username: string): string | null {
  const value = username.trim()
  if (!value) return '请输入用户名'
  if (value.length < 3 || value.length > 20) return '用户名长度需为 3-20 位'
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) return '用户名需以字母开头，仅支持字母、数字和下划线'
  return null
}

function validateEmail(email: string): string | null {
  const value = email.trim()
  if (!value) return '请输入邮箱'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '请输入有效的邮箱地址'
  return null
}

function validatePassword(password: string): string | null {
  if (!password) return '请输入密码'
  if (password.length < 8 || password.length > 32) return '密码长度需为 8-32 位'
  if (/\s/.test(password)) return '密码不能包含空格'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return '密码需同时包含字母和数字'
  return null
}

function validateLoginIdentifier(identifier: string): string | null {
  const value = identifier.trim()
  if (!value) return '请输入用户名或邮箱'
  return value.includes('@') ? validateEmail(value) : validateUsername(value)
}

function FieldError({ message }: { message?: string | null }) {
  return (
    <div className="min-h-[18px] pt-1 text-xs text-red-500 dark:text-red-400">
      {message ?? ''}
    </div>
  )
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [loginId, setLoginId] = useState(DEFAULT_ADMIN.username)
  const [loginPassword, setLoginPassword] = useState(DEFAULT_ADMIN.password)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [message, setMessage] = useState<string | null>(null)

  const title = useMemo(() => {
    if (mode === 'register') return '创建账号'
    if (mode === 'forgot') return '找回密码'
    return '登录'
  }, [mode])

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setErrors({})
    setMessage(null)
  }

  const handleLogin = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = {
      loginId: validateLoginIdentifier(loginId),
      loginPassword: validatePassword(loginPassword),
    }
    setErrors(nextErrors)
    setMessage(null)
    if (nextErrors.loginId || nextErrors.loginPassword) return

    const result = authenticateUser(loginId, loginPassword)
    if (!result.user) {
      setErrors({ loginPassword: result.error ?? '账号或密码不正确' })
      return
    }

    onAuthenticated(result.user)
  }

  const handleRegister = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = {
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: confirmPassword === password ? null : '两次输入的密码不一致',
    }
    setErrors(nextErrors)
    setMessage(null)
    if (Object.values(nextErrors).some(Boolean)) return

    const result = createUser({
      username: username.trim(),
      email: email.trim(),
      password,
      role: 'user',
      credits: 20,
      multiplier: 1,
    })
    if (!result.user) {
      setErrors({ email: result.error })
      return
    }
    const user = result.user
    setLoginId(user.email)
    setLoginPassword('')
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    switchMode('login')
    setMessage('注册成功，请使用新账号登录')
  }

  const handleForgotPassword = (event: FormEvent) => {
    event.preventDefault()
    const resetEmailError = validateEmail(resetEmail)
    setErrors({ resetEmail: resetEmailError })
    setMessage(null)
    if (resetEmailError) return

    setMessage('密码重置校验已通过，当前版本暂不发送邮件')
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <div className="safe-area-x mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center py-8">
        <section className="auth-panel grid w-full overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm dark:border-white/[0.08] dark:bg-gray-900 lg:grid-cols-[minmax(0,0.92fr)_minmax(380px,0.68fr)]">
          <div className="hidden min-h-[700px] bg-gray-900 px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg font-black">
                G
              </div>
              <h1 className="mt-7 text-3xl font-bold tracking-tight">Hua Image Playground</h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-gray-300">
                使用统一账号入口管理图像生成配置、历史任务和本地工作流。
              </p>
            </div>
            <div className="grid gap-3 text-sm text-gray-300">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  默认账号：<span className="font-semibold text-white">{DEFAULT_ADMIN.username}</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  默认邮箱：<span className="font-semibold text-white">{DEFAULT_ADMIN.email}</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  默认密码：<span className="font-semibold text-white">{DEFAULT_ADMIN.password}</span>
              </div>
            </div>
          </div>

          <div className="flex min-h-[700px] flex-col justify-center px-5 py-8 sm:px-10">
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 lg:hidden">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-lg font-black text-white dark:bg-white dark:text-gray-950">
                  G
                </div>
                <h1 className="mt-4 text-2xl font-bold tracking-tight">Hua Image Playground</h1>
              </div>

              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  默认管理员 {DEFAULT_ADMIN.username}，邮箱 {DEFAULT_ADMIN.email}
                </p>
              </div>

              <div className="mb-5 grid grid-cols-3 rounded-xl bg-gray-100 p-1 text-sm dark:bg-white/[0.06]">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`rounded-lg px-3 py-2 font-medium transition ${mode === 'login' ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                  登录
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`rounded-lg px-3 py-2 font-medium transition ${mode === 'register' ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                  注册
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className={`rounded-lg px-3 py-2 font-medium transition ${mode === 'forgot' ? 'bg-white text-blue-600 shadow-sm dark:bg-gray-800 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}`}
                >
                  忘记密码
                </button>
              </div>

              {mode === 'login' && (
                <form onSubmit={handleLogin} noValidate>
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">用户名或邮箱</span>
                    <input
                      value={loginId}
                      onChange={(event) => setLoginId(event.target.value)}
                      autoComplete="username"
                      className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
                    />
                    <FieldError message={errors.loginId} />
                  </label>

                  <label className="mt-2 block">
                    <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">密码</span>
                    <input
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      type="password"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
                    />
                    <FieldError message={errors.loginPassword} />
                  </label>

                  {message && <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{message}</div>}

                  <button
                    type="submit"
                    className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
                  >
                    登录
                  </button>
                </form>
              )}

              {mode === 'register' && (
                <form onSubmit={handleRegister} noValidate>
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">用户名</span>
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
                    />
                    <FieldError message={errors.username} />
                  </label>

                  <label className="mt-2 block">
                    <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">邮箱</span>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      autoComplete="email"
                      className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
                    />
                    <FieldError message={errors.email} />
                  </label>

                  <label className="mt-2 block">
                    <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">密码</span>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
                    />
                    <FieldError message={errors.password} />
                  </label>

                  <label className="mt-2 block">
                    <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">确认密码</span>
                    <input
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      type="password"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
                    />
                    <FieldError message={errors.confirmPassword} />
                  </label>

                  <button
                    type="submit"
                    className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
                  >
                    注册
                  </button>
                </form>
              )}

              {mode === 'forgot' && (
                <form onSubmit={handleForgotPassword} noValidate>
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600 dark:text-gray-300">邮箱</span>
                    <input
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      type="email"
                      autoComplete="email"
                      className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
                    />
                    <FieldError message={errors.resetEmail} />
                  </label>

                  {message && <div className="mb-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">{message}</div>}

                  <button
                    type="submit"
                    className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
                  >
                    提交
                  </button>
                </form>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
