import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { authenticateUser, DEFAULT_APP_NAME, readPublicSettings, registerUser } from '../lib/auth'
import type { AppUser } from '../lib/auth'

type AuthMode = 'login' | 'register'

interface AuthPageProps {
  appName: string
  onAppNameChange?: (appName: string) => void
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
  if (password.length < 6 || password.length > 72) return '密码长度需为 6-72 位'
  return null
}

function validateLoginIdentifier(identifier: string): string | null {
  const value = identifier.trim()
  if (!value) return '请输入用户名或邮箱'
  return value.includes('@') ? validateEmail(value) : validateUsername(value)
}

function FieldError({ message }: { message?: string | null }) {
  return (
    <div className="min-h-[18px] pt-1 text-[11px] font-medium leading-[14px] text-red-300">
      {message ?? ''}
    </div>
  )
}

const inputClassName =
  'h-10 w-full rounded-lg border border-white/[0.11] bg-white/[0.06] pl-10 pr-10 text-[12px] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-slate-400/80 hover:bg-white/[0.08] focus:border-blue-400/70 focus:bg-white/[0.09] focus:ring-2 focus:ring-blue-500/25'

function ArrowRightIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

function BrandIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5.5 14.5a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5v.5a3 3 0 0 1-3 3h-1.2l-1.8 2-1.8-2H8a3 3 0 0 1-3-3v-.5Z" />
      <path d="M8.2 10.4 7.5 7.2M15.8 10.4l.7-3.2M9 14h.01M15 14h.01" />
    </svg>
  )
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.06A1.7 1.7 0 0 0 8.9 19.36a1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.53 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 0 1 0-4h.06A1.7 1.7 0 0 0 4.64 8.9a1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.53a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 0 1 4 0v.06A1.7 1.7 0 0 0 15.1 4.64a1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 0 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.47 9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 0 1 0 4h-.06A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 8.5 4 10 8a13.2 13.2 0 0 1-3.1 4.6" />
      <path d="M6.6 6.6A13.2 13.2 0 0 0 2 12c1.5 4 5 8 10 8 1.4 0 2.7-.3 3.8-.9" />
    </svg>
  )
}

function GithubIcon() {
  return (
    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.18-3.37-1.18-.45-1.15-1.1-1.46-1.1-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.9.83.09-.64.35-1.08.64-1.33-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.02c.85 0 1.7.11 2.5.33 1.9-1.29 2.74-1.02 2.74-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.23c0-.76-.07-1.49-.2-2.19H12v4.14h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.32 2.98-7.48Z" />
      <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.29l-3.24-2.51c-.9.6-2.04.95-3.38.95-2.6 0-4.8-1.76-5.59-4.12H3.07v2.59A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.41 14.03A6 6 0 0 1 6.1 12c0-.7.11-1.38.31-2.03V7.38H3.07A10 10 0 0 0 2 12c0 1.61.39 3.14 1.07 4.62l3.34-2.59Z" />
      <path fill="#EA4335" d="M12 5.85c1.47 0 2.8.5 3.84 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2 10 10 0 0 0 3.07 7.38l3.34 2.59C7.2 7.61 9.4 5.85 12 5.85Z" />
    </svg>
  )
}

function CubeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M12 12 4.4 7.8M12 12l7.6-4.2M12 12v8.5" />
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
          ? 'bg-blue-500 text-white shadow-sm ring-1 ring-blue-300/30'
          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

export default function AuthPage({ appName, onAppNameChange, onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)
  const logoText = (appName.trim() || DEFAULT_APP_NAME).slice(0, 1).toUpperCase()

  useEffect(() => {
    void readPublicSettings()
      .then((settings) => {
        onAppNameChange?.(settings.site?.appName || DEFAULT_APP_NAME)
        setRegistrationOpen(settings.auth.registrationOpen)
        if (!settings.auth.registrationOpen) setMode('login')
      })
      .catch(() => {
        onAppNameChange?.(DEFAULT_APP_NAME)
        setRegistrationOpen(false)
      })
  }, [onAppNameChange])

  const switchMode = (nextMode: AuthMode) => {
    if (nextMode === 'register' && !registrationOpen) {
      setMode('login')
      setErrors({})
      setMessage('当前未开放公开注册，请联系管理员创建账号')
      return
    }
    setMode(nextMode)
    setErrors({})
    setMessage(null)
  }

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    const nextErrors = {
      loginId: validateLoginIdentifier(loginId),
      loginPassword: validatePassword(loginPassword),
    }
    setErrors(nextErrors)
    setMessage(null)
    if (nextErrors.loginId || nextErrors.loginPassword) return

    setSubmitting(true)
    const result = await authenticateUser(loginId, loginPassword)
    setSubmitting(false)
    if (!result.user) {
      setErrors({ loginPassword: result.error ?? '账号或密码不正确' })
      return
    }

    onAuthenticated(result.user)
  }

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault()
    if (!registrationOpen) {
      setMessage('当前未开放公开注册，请联系管理员创建账号')
      return
    }
    const nextErrors = {
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: confirmPassword === password ? null : '两次输入的密码不一致',
    }
    setErrors(nextErrors)
    setMessage(null)
    if (Object.values(nextErrors).some(Boolean)) return

    setSubmitting(true)
    const result = await registerUser({
      username: username.trim(),
      email: email.trim(),
      password,
    })
    setSubmitting(false)
    if (!result.user) {
      setErrors({ email: result.error })
      return
    }
    onAuthenticated(result.user)
  }

  const handleForgotPassword = () => {
    const emailError = validateEmail(loginId)
    setErrors(emailError ? { loginId: '请输入邮箱地址后再找回密码' } : {})
    setMessage(emailError ? null : '请联系管理员重置密码')
  }

  const socialButtonClass =
    'flex h-10 flex-1 items-center justify-center rounded-lg border border-white/[0.10] bg-white/[0.045] text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition hover:border-blue-300/35 hover:bg-white/[0.075] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30'

  return (
    <main className="auth-pro-page auth-reference-login min-h-screen overflow-hidden text-gray-900">
      <div className="auth-login-backdrop absolute inset-0 bg-black/45" />
      <div className="auth-login-viewport relative flex min-h-screen items-start justify-center pb-8 pt-[38px]">
        <section className="auth-login-card relative h-[734px] w-full max-w-[370px] overflow-hidden rounded-lg border border-white/75 bg-white/[0.95] shadow-[0_18px_50px_rgba(15,23,42,0.18)] backdrop-blur-md">
          <div className="auth-login-surface pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_28%,rgba(59,130,246,0.24),transparent_30%),linear-gradient(180deg,rgba(8,11,18,0.98)_0%,rgba(5,7,12,0.94)_100%)]" />
          <div className="pointer-events-none absolute left-[-40px] top-[54px] h-[260px] w-[210px] rounded-full bg-blue-500/10 blur-[62px]" />
          <div className="pointer-events-none absolute right-[-32px] top-[132px] h-[270px] w-[230px] rounded-full bg-cyan-300/10 blur-[58px]" />

          <header className="auth-login-header relative z-20 flex items-center justify-between px-[18px] pt-[17px]">
            <div className="flex items-center gap-2 text-slate-100">
              <span className="flex h-5 w-5 items-center justify-center rounded-md text-blue-100">
                <BrandIcon />
              </span>
              <span className="text-[11px] font-semibold tracking-tight">{appName}</span>
            </div>
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-white/[0.07] hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
              aria-label="登录页设置"
            >
              <SettingsIcon />
            </button>
          </header>

          {mode === 'login' && (
            <>
              <div className="auth-login-portal pointer-events-none absolute right-[16px] top-[52px] z-0 h-[320px] w-[196px]">
                <div className="absolute inset-x-5 top-5 h-[240px] rounded-full bg-blue-300/20 blur-2xl" />
                <img src="/auth-portal-pro.png" className="relative z-10 h-full w-full object-contain opacity-95 mix-blend-screen" alt="" />
              </div>

              <div className="auth-login-title absolute left-[28px] top-[84px] z-10 w-[180px]">
                <h1 className="text-[22px] font-semibold leading-[1.35] tracking-tight text-slate-50">
                  欢迎回来<br />开启你的创意之旅
                </h1>
                <p className="mt-2 text-[11px] leading-5 text-slate-400">登录账户以使用 AI 图像生成服务</p>
              </div>

              <form onSubmit={handleLogin} noValidate className="auth-login-form absolute left-[37px] right-[37px] top-[369px] z-20">
                <div className="auth-login-form-brand">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl text-blue-100">
                    <BrandIcon />
                  </span>
                  <span>{appName}</span>
                </div>
                <label className="relative block">
                    <span className="sr-only">用户名或邮箱</span>
                    <span className="pointer-events-none absolute left-3 top-3 text-slate-400"><MailIcon /></span>
                    <input
                      value={loginId}
                      onChange={(event) => setLoginId(event.target.value)}
                      autoComplete="username"
                      placeholder="codexuimocc5uyx@mail.com"
                      className={inputClassName}
                    />
                    <FieldError message={errors.loginId} />
                  </label>

                  <label className="relative mt-1.5 block">
                    <span className="sr-only">密码</span>
                    <span className="pointer-events-none absolute left-3 top-3 text-slate-400"><LockIcon /></span>
                    <input
                      value={loginPassword}
                      onChange={(event) => setLoginPassword(event.target.value)}
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••••••••••"
                      className={inputClassName}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-3 text-slate-500 transition hover:text-slate-200"
                      aria-label="密码可见性"
                      tabIndex={-1}
                    >
                      <EyeOffIcon />
                    </button>
                    <FieldError message={errors.loginPassword} />
                  </label>

                  {message && <div className="mb-3 rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">{message}</div>}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-1 flex h-[39px] w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-[12px] font-semibold text-white shadow-sm outline-none transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/30 active:scale-[0.99]"
                  >
                    <span>{submitting ? '登录中' : '登录'}</span>
                  </button>

                  <div className="mt-[19px] flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/[0.09]" />
                    <span className="text-[11px] text-slate-500">或继续使用</span>
                    <div className="h-px flex-1 bg-white/[0.09]" />
                  </div>

                  <div className="mt-[19px] flex gap-3">
                    <button type="button" className={socialButtonClass} aria-label="GitHub 登录">
                      <GithubIcon />
                    </button>
                    <button type="button" className={socialButtonClass} aria-label="Google 登录">
                      <GoogleIcon />
                    </button>
                    <button type="button" className={socialButtonClass} aria-label="SSO 登录">
                      <CubeIcon />
                    </button>
                  </div>

                  <div className="auth-login-register mt-[76px] flex justify-center text-[12px] text-slate-400">
                    <span>
                      还没有账户？
                    <button
                      type="button"
                        onClick={() => switchMode('register')}
                        className="ml-1 rounded-md font-medium text-blue-400 outline-none transition hover:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500/30"
                    >
                        立即注册
                    </button>
                    </span>
                  </div>
                </form>
            </>
          )}

              {mode === 'register' && (
            <div className="auth-register-panel relative z-20 flex h-[680px] flex-col justify-center px-8">
              <div className="mb-4">
                <p className="text-xs font-semibold text-blue-300">创建账号</p>
                <h1 className="mt-1.5 text-[24px] font-semibold leading-tight tracking-tight text-slate-50">注册账号</h1>
                <p className="mt-2 text-[12px] leading-5 text-slate-400">请填写账号信息完成注册。</p>
              </div>
              {registrationOpen && (
                <div className="mb-4 flex rounded-xl bg-white/[0.055] p-1">
                  <ModeButton active={false} onClick={() => switchMode('login')}>
                    登录
                  </ModeButton>
                  <ModeButton active onClick={() => switchMode('register')}>
                    注册
                  </ModeButton>
                </div>
              )}
              <form onSubmit={handleRegister} noValidate className="grid gap-2.5">
                  <label className="block">
                    <span className="mb-1.5 block text-sm text-slate-300">用户名</span>
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
                    <span className="mb-1.5 block text-sm text-slate-300">邮箱地址</span>
                    <input
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value)
                        if (errors.email) setErrors((current) => ({ ...current, email: validateEmail(event.target.value) }))
                      }}
                      onBlur={() => setErrors((current) => ({ ...current, email: validateEmail(email) }))}
                      type="email"
                      autoComplete="email"
                      placeholder="请输入邮箱地址"
                      className={inputClassName}
                    />
                    <FieldError message={errors.email} />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm text-slate-300">密码</span>
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
                    <span className="mb-1.5 block text-sm text-slate-300">确认密码</span>
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
                    disabled={submitting}
                    className="mt-1 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm outline-none transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/30 active:scale-[0.99]"
                  >
                    <span>{submitting ? '注册中' : '注册'}</span>
                    <ArrowRightIcon />
                  </button>
                </form>
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/45 to-transparent" />
        </section>
      </div>
    </main>
  )
}
