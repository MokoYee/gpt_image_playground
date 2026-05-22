import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { authenticateUser, DEFAULT_APP_NAME, readPublicSettings, registerUser } from '../lib/auth'
import type { AppUser } from '../lib/auth'
import ThemeToggle from '../components/ThemeToggle'
import AppLogoMark from '../components/AppLogoMark'
import { readThemePreference, resolveThemePreference } from '../lib/theme'
import type { ResolvedTheme } from '../lib/theme'
import { useStore } from '../store'

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
  'h-10 w-full rounded-lg border border-white/[0.11] bg-white/[0.06] pl-10 pr-10 text-[12px] text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition placeholder:text-slate-400/80 hover:bg-white/[0.08] focus:border-blue-400/70 focus:bg-white/[0.09] focus:ring-2 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-70'

const submitButtonClassName =
  'mt-1 flex h-[39px] w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-[12px] font-semibold text-white shadow-sm outline-none transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-85 disabled:active:scale-100'

function ButtonSpinner() {
  return <span className="auth-submit-spinner" aria-hidden="true" />
}

function UserIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
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

function EyeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export default function AuthPage({ appName, onAppNameChange, onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginPasswordVisible, setLoginPasswordVisible] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false)
  const [errors, setErrors] = useState<Record<string, string | null>>({})
  const [submitting, setSubmitting] = useState(false)
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveThemePreference(readThemePreference()))
  const showToast = useStore((state) => state.showToast)
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
    if (nextMode === 'register' && registrationOpen === false) {
      setMode('login')
      setErrors({})
      showToast('当前未开放公开注册，请联系管理员创建账号', 'info')
      return
    }
    setMode(nextMode)
    setErrors({})
  }

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    const nextErrors = {
      loginId: validateLoginIdentifier(loginId),
      loginPassword: validatePassword(loginPassword),
    }
    setErrors(nextErrors)
    if (nextErrors.loginId || nextErrors.loginPassword) return

    try {
      setSubmitting(true)
      const result = await authenticateUser(loginId, loginPassword)
      if (!result.user) {
        setErrors({ loginPassword: result.error ?? '账号或密码不正确' })
        return
      }

      onAuthenticated(result.user)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    if (!registrationOpen) {
      showToast('当前未开放公开注册，请联系管理员创建账号', 'info')
      return
    }
    const nextErrors = {
      username: validateUsername(username),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: confirmPassword === password ? null : '两次输入的密码不一致',
    }
    setErrors(nextErrors)
    if (Object.values(nextErrors).some(Boolean)) return

    try {
      setSubmitting(true)
      const result = await registerUser({
        username: username.trim(),
        email: email.trim(),
        password,
      })
      if (!result.user) {
        setErrors({ email: result.error })
        return
      }
      onAuthenticated(result.user)
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotPassword = () => {
    const emailError = validateEmail(loginId)
    setErrors(emailError ? { loginId: '请输入邮箱地址后再找回密码' } : {})
    if (!emailError) showToast('请联系管理员重置密码', 'info')
  }

  return (
    <main className={`auth-pro-page auth-reference-login auth-theme-${resolvedTheme} min-h-screen overflow-hidden text-gray-900`}>
      <ThemeToggle className="auth-page-theme-toggle" onResolvedThemeChange={setResolvedTheme} />
      <div className="auth-login-viewport relative flex min-h-screen items-stretch justify-center">
        <section className="auth-login-card relative min-h-screen w-full overflow-hidden bg-[#08090d]">
          <div className="auth-login-visual pointer-events-none absolute z-0 overflow-hidden" aria-hidden="true">
            <div className="auth-login-visual-media" />
          </div>

          <header className="auth-login-header relative z-20 flex items-center justify-between px-[18px] pt-[17px]">
            <div className="auth-login-brand-lockup">
              <AppLogoMark variant="wordmark" theme={resolvedTheme} alt={appName} className="auth-login-wordmark" />
            </div>
          </header>

          {mode === 'login' && (
            <form onSubmit={handleLogin} noValidate className="auth-login-form relative z-20" aria-busy={submitting}>
              <div className="auth-login-form-brand">
                <AppLogoMark variant="wordmark" theme={resolvedTheme} alt={appName} className="auth-login-wordmark" />
              </div>
              <div className="auth-login-copy">
                <h1>
                  欢迎回来<br />开启你的创意之旅
                </h1>
                <p>登录账户以使用 AI 图像生成服务</p>
              </div>
              <label className="relative block">
                <span className="sr-only">用户名或邮箱</span>
                <span className="pointer-events-none absolute left-3 top-3 text-slate-400"><UserIcon /></span>
                <input
                  value={loginId}
                  onChange={(event) => setLoginId(event.target.value)}
                  autoComplete="username"
                  placeholder="请输入用户名或邮箱"
                  className={inputClassName}
                  disabled={submitting}
                />
                <FieldError message={errors.loginId} />
              </label>

              <label className="relative mt-1.5 block">
                <span className="sr-only">密码</span>
                <span className="pointer-events-none absolute left-3 top-3 text-slate-400"><LockIcon /></span>
                <input
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  type={loginPasswordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="请输入密码"
                  className={inputClassName}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="auth-password-toggle absolute right-3 top-3 text-slate-500 transition hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={loginPasswordVisible ? '隐藏密码' : '显示密码'}
                  aria-pressed={loginPasswordVisible}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setLoginPasswordVisible((visible) => !visible)}
                  tabIndex={-1}
                  disabled={submitting}
                >
                  {loginPasswordVisible ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <FieldError message={errors.loginPassword} />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className={submitButtonClassName}
              >
                {submitting && <ButtonSpinner />}
                <span>{submitting ? '登录中...' : '登录'}</span>
              </button>

              <div className="auth-login-register mt-7 flex justify-center text-[12px] text-slate-400">
                <span>
                  还没有账户？
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className="ml-1 rounded-md font-medium text-blue-400 outline-none transition hover:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submitting || registrationOpen === null}
                  >
                    立即注册
                  </button>
                </span>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} noValidate className="auth-login-form auth-register-form relative z-20" aria-busy={submitting}>
              <div className="auth-login-form-brand">
                <AppLogoMark variant="wordmark" theme={resolvedTheme} alt={appName} className="auth-login-wordmark" />
              </div>
              <div className="auth-login-copy">
                <h1>
                  创建账号<br />加入创意之旅
                </h1>
                <p>填写账号信息后即可开始生成图像</p>
              </div>
              <label className="relative block">
                <span className="sr-only">用户名</span>
                <span className="pointer-events-none absolute left-3 top-3 text-slate-400"><UserIcon /></span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="请输入用户名"
                  className={inputClassName}
                  disabled={submitting}
                />
                <FieldError message={errors.username} />
              </label>

              <label className="relative block">
                <span className="sr-only">邮箱地址</span>
                <span className="pointer-events-none absolute left-3 top-3 text-slate-400"><MailIcon /></span>
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
                  disabled={submitting}
                />
                <FieldError message={errors.email} />
              </label>

              <label className="relative block">
                <span className="sr-only">密码</span>
                <span className="pointer-events-none absolute left-3 top-3 text-slate-400"><LockIcon /></span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="请输入密码"
                  className={inputClassName}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="auth-password-toggle absolute right-3 top-3 text-slate-500 transition hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                  aria-pressed={passwordVisible}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  tabIndex={-1}
                  disabled={submitting}
                >
                  {passwordVisible ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <FieldError message={errors.password} />
              </label>

              <label className="relative block">
                <span className="sr-only">确认密码</span>
                <span className="pointer-events-none absolute left-3 top-3 text-slate-400"><LockIcon /></span>
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type={confirmPasswordVisible ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="请再次输入密码"
                  className={inputClassName}
                  disabled={submitting}
                />
                <button
                  type="button"
                  className="auth-password-toggle absolute right-3 top-3 text-slate-500 transition hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={confirmPasswordVisible ? '隐藏密码' : '显示密码'}
                  aria-pressed={confirmPasswordVisible}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => setConfirmPasswordVisible((visible) => !visible)}
                  tabIndex={-1}
                  disabled={submitting}
                >
                  {confirmPasswordVisible ? <EyeIcon /> : <EyeOffIcon />}
                </button>
                <FieldError message={errors.confirmPassword} />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className={submitButtonClassName}
              >
                {submitting && <ButtonSpinner />}
                <span>{submitting ? '注册中...' : '注册'}</span>
              </button>

              <div className="auth-login-register mt-7 flex justify-center text-[12px] text-slate-400">
                <span>
                  已有账户？
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="ml-1 rounded-md font-medium text-blue-400 outline-none transition hover:text-blue-300 focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={submitting}
                  >
                    立即登录
                  </button>
                </span>
              </div>
            </form>
          )}

        </section>
      </div>
    </main>
  )
}
