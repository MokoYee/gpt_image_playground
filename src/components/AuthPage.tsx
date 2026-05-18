import { useState } from 'react'
import type { FormEvent } from 'react'
import { authenticateUser, createUser } from '../lib/auth'
import type { AppUser } from '../lib/auth'

type AuthMode = 'login' | 'register'

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
    <div className="min-h-[18px] pt-1.5 text-xs font-medium text-red-500">
      {message ?? ''}
    </div>
  )
}

const inputClassName =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-700 shadow-sm outline-none transition placeholder:text-gray-400 hover:bg-gray-50 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-500/30'

function ArrowRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 flex-1 rounded-lg px-3 text-sm font-medium outline-none transition focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
        active
          ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200'
          : 'text-gray-500 hover:bg-white/60 hover:text-gray-800'
      }`}
    >
      {children}
    </button>
  )
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [message, setMessage] = useState<string | null>(null)

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
    setLoginId(result.user.email)
    setLoginPassword('')
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    switchMode('login')
    setMessage('注册成功，请使用新账号登录')
  }

  const handleForgotPassword = () => {
    const emailError = validateEmail(loginId)
    setErrors(emailError ? { loginId: '请输入邮箱地址后再找回密码' } : {})
    setMessage(emailError ? null : '密码找回暂未接入后端，请联系管理员重置密码')
  }

  return (
    <main
      className="min-h-screen overflow-hidden bg-slate-50 bg-cover bg-center text-gray-900"
      style={{ backgroundImage: "url('/auth-bg.png')" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_80%_8%,rgba(14,165,233,0.12),transparent_28%)]" />
      <div className="safe-area-x relative flex min-h-screen items-center justify-center py-6 sm:py-8">
        <section className="grid w-full max-w-[860px] overflow-hidden rounded-2xl border border-white/75 bg-white/[0.94] shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-md min-[760px]:grid-cols-[0.9fr_1.1fr]">
          <div
            className="relative hidden min-h-[520px] overflow-hidden bg-cover bg-center min-[760px]:block"
            style={{ backgroundImage: "url('/auth-tech-bg.png')" }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-sky-50/35 to-blue-200/20" />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/90 via-white/58 to-transparent" />
            <div className="absolute left-7 top-7 inline-flex items-center gap-2.5 rounded-xl border border-white/80 bg-white/58 px-3 py-2.5 text-slate-900 shadow-sm backdrop-blur-md">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs font-black text-white shadow-sm">H</span>
              <div>
                <div className="text-sm font-bold leading-none">Hua Image</div>
                <div className="mt-1 text-[11px] text-slate-500">Playground</div>
              </div>
            </div>
            <div className="absolute bottom-7 left-7 right-7 text-slate-950">
              <div className="max-w-[280px]">
                <h1 className="text-2xl font-bold leading-tight tracking-tight">更专注地进入图像创作工作台</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">登录后继续在本地保存生成记录、配置 Image2 模型，并管理你的图像创作流程。</p>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2.5 text-center">
                <div className="rounded-xl border border-white/75 bg-white/54 px-2.5 py-2.5 shadow-sm backdrop-blur-md">
                  <div className="text-sm font-bold">Local</div>
                  <div className="mt-1 text-[11px] text-slate-500">本地存储</div>
                </div>
                <div className="rounded-xl border border-white/75 bg-white/54 px-2.5 py-2.5 shadow-sm backdrop-blur-md">
                  <div className="text-sm font-bold">Image2</div>
                  <div className="mt-1 text-[11px] text-slate-500">模型配置</div>
                </div>
                <div className="rounded-xl border border-white/75 bg-white/54 px-2.5 py-2.5 shadow-sm backdrop-blur-md">
                  <div className="text-sm font-bold">Flow</div>
                  <div className="mt-1 text-[11px] text-slate-500">创作流程</div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex flex-col justify-center px-5 py-6 sm:px-9 sm:py-8 min-[760px]:min-h-[520px] lg:px-11">
            <div className="mx-auto w-full max-w-[360px]">
              <div className="mb-6 min-[760px]:hidden">
                <div className="inline-flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-sm font-black text-white shadow-sm">H</span>
                  <div>
                    <h1 className="text-[17px] font-bold tracking-tight text-gray-900">Hua Image Playground</h1>
                    <p className="mt-1 text-xs text-gray-500">AI 图像创作工作台</p>
                  </div>
                </div>
              </div>

              <div className={mode === 'register' ? 'mb-4' : 'mb-5'}>
                <p className="text-xs font-semibold text-blue-600">{mode === 'login' ? '欢迎回来' : '创建账号'}</p>
                <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-gray-950">{mode === 'login' ? '登录 Hua Image' : '加入 Hua Image'}</h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  {mode === 'login' ? '使用用户名或邮箱继续你的图像生成流程。' : '注册后在本地保存你的生成记录和偏好配置。'}
                </p>
              </div>

              <div className={mode === 'register' ? 'mb-4 flex rounded-xl bg-gray-100 p-1' : 'mb-5 flex rounded-xl bg-gray-100 p-1'}>
                <ModeButton active={mode === 'login'} onClick={() => switchMode('login')}>
                  登录
                </ModeButton>
                <ModeButton active={mode === 'register'} onClick={() => switchMode('register')}>
                  注册
                </ModeButton>
              </div>

              {mode === 'login' && (
                <form onSubmit={handleLogin} noValidate className="grid gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600">用户名或邮箱</span>
                    <input
                      value={loginId}
                      onChange={(event) => setLoginId(event.target.value)}
                      autoComplete="username"
                      placeholder="请输入邮箱地址 / 用户名"
                      className={inputClassName}
                    />
                    <FieldError message={errors.loginId} />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600">密码</span>
                    <input
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      type="password"
                      autoComplete="current-password"
                      placeholder="请输入密码"
                      className={inputClassName}
                    />
                    <FieldError message={errors.loginPassword} />
                  </label>

                  {message && <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">{message}</div>}

                  <button
                    type="submit"
                    className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm outline-none transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/30 active:scale-[0.99]"
                  >
                    <span>登录</span>
                    <ArrowRightIcon />
                  </button>

                  <div className="flex justify-center text-sm text-gray-500">
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="rounded-md outline-none transition hover:text-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500/30"
                    >
                      忘记密码
                    </button>
                  </div>
                </form>
              )}

              {mode === 'register' && (
                <form onSubmit={handleRegister} noValidate className="grid gap-2.5">
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600">用户名</span>
                    <input
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="username"
                      placeholder="请输入用户名"
                      className={inputClassName}
                    />
                    <FieldError message={errors.username} />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600">邮箱地址</span>
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      autoComplete="email"
                      placeholder="请输入邮箱地址"
                      className={inputClassName}
                    />
                    <FieldError message={errors.email} />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600">密码</span>
                    <input
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      type="password"
                      autoComplete="new-password"
                      placeholder="请输入密码"
                      className={inputClassName}
                    />
                    <FieldError message={errors.password} />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm text-gray-600">确认密码</span>
                    <input
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      type="password"
                      autoComplete="new-password"
                      placeholder="请再次输入密码"
                      className={inputClassName}
                    />
                    <FieldError message={errors.confirmPassword} />
                  </label>

                  <button
                    type="submit"
                    className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm outline-none transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/30 active:scale-[0.99]"
                  >
                    <span>注册</span>
                    <ArrowRightIcon />
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
