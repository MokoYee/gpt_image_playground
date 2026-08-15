import { useEffect, useRef, useState } from 'react'
import { useTooltip } from '../hooks/useTooltip'
import { dismissAllTooltips } from '../lib/tooltipDismiss'
import ViewportTooltip from './ViewportTooltip'
import HelpModal from './HelpModal'
import type { UserRole } from '../lib/auth'

interface HeaderProps {
  appName: string
  user?: {
    username: string
    email: string
    credits?: number
    role?: UserRole
  }
  onLogout?: () => void
  onOpenConsole?: () => void
  onOpenAccount?: () => void
}

function formatCredits(value?: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '-'
}

function DefaultAvatar({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <span className={`${className} inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-500 via-cyan-400 to-emerald-400 text-white shadow-sm ring-1 ring-black/5 dark:ring-white/10`}>
      <svg className="h-[62%] w-[62%]" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
      </svg>
    </span>
  )
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M21 5v14" />
    </svg>
  )
}

export default function Header({ appName, user, onLogout, onOpenConsole, onOpenAccount }: HeaderProps) {
  const [showHelp, setShowHelp] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const closeUserMenuTimer = useRef<number | null>(null)

  const consoleTooltip = useTooltip()
  const accountTooltip = useTooltip()
  const helpTooltip = useTooltip()
  const settingsTooltip = useTooltip()

  useEffect(() => () => {
    if (closeUserMenuTimer.current !== null) window.clearTimeout(closeUserMenuTimer.current)
  }, [])

  const openUserMenu = () => {
    if (closeUserMenuTimer.current !== null) {
      window.clearTimeout(closeUserMenuTimer.current)
      closeUserMenuTimer.current = null
    }
    setShowUserMenu(true)
  }

  const closeUserMenuSoon = () => {
    if (closeUserMenuTimer.current !== null) window.clearTimeout(closeUserMenuTimer.current)
    closeUserMenuTimer.current = window.setTimeout(() => {
      setShowUserMenu(false)
      closeUserMenuTimer.current = null
    }, 180)
  }

  return (
    <>
      <header data-no-drag-select className="image-pro-header safe-area-top fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-white/[0.08]">
        <div className="safe-area-x safe-header-inner max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <h1 className="inline-flex items-start relative">
              <span className="text-[17px] sm:text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100">
                {appName}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {onOpenConsole && (
              <div
                className="relative"
                {...consoleTooltip.handlers}
              >
                <button
                  onClick={() => {
                    dismissAllTooltips()
                    onOpenConsole()
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                  aria-label="控制台"
                >
                  <svg
                    className="w-5 h-5 text-gray-600 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <rect x="3" y="4" width="18" height="14" rx="2" />
                    <path d="M7 8h4M7 12h2M14 12h3M14 8h3M9 21h6" />
                  </svg>
                </button>
                <ViewportTooltip visible={consoleTooltip.visible} className="whitespace-nowrap">
                  控制台
                </ViewportTooltip>
              </div>
            )}
            {!onOpenConsole && onOpenAccount && (
              <div className="relative" {...accountTooltip.handlers}>
                <button
                  onClick={() => {
                    dismissAllTooltips()
                    onOpenAccount()
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                  aria-label="我的账户"
                >
                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M20 21a8 8 0 10-16 0" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </button>
                <ViewportTooltip visible={accountTooltip.visible} className="whitespace-nowrap">
                  我的账户
                </ViewportTooltip>
              </div>
            )}
            <div
              className="relative"
              {...helpTooltip.handlers}
            >
              <button
                onClick={() => {
                  dismissAllTooltips()
                  setShowHelp(true)
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                aria-label="操作指南"
              >
                <svg
                  className="w-5 h-5 text-gray-600 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <path d="M12 17h.01" />
                </svg>
              </button>
              <ViewportTooltip visible={helpTooltip.visible} className="whitespace-nowrap">
                操作指南
              </ViewportTooltip>
            </div>
            {user?.role === 'admin' && <div
              className="relative"
              {...settingsTooltip.handlers}
            >
              <button
                onClick={() => {
                  dismissAllTooltips()
                  onOpenConsole?.()
                }}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                aria-label="系统设置"
              >
                <svg
                  className="w-5 h-5 text-gray-600 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
              <ViewportTooltip visible={settingsTooltip.visible} className="whitespace-nowrap">
                系统设置
              </ViewportTooltip>
            </div>}
            {user && (
              <div
                className="relative ml-1"
                onMouseEnter={openUserMenu}
                onMouseLeave={closeUserMenuSoon}
                onFocus={openUserMenu}
                onBlur={(event) => {
                  const nextTarget = event.relatedTarget
                  if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                    setShowUserMenu(false)
                  }
                }}
              >
                <button
                  type="button"
                  className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:hover:bg-gray-900"
                  aria-label="用户菜单"
                  aria-haspopup="menu"
                  aria-expanded={showUserMenu}
                  onClick={() => {
                    dismissAllTooltips()
                    setShowUserMenu((open) => !open)
                  }}
                >
                  <DefaultAvatar />
                </button>
                {showUserMenu && (
                  <div className="absolute right-0 top-full z-50 pt-2">
                    <div
                      role="menu"
                      className="w-64 overflow-hidden rounded-2xl border border-gray-200/70 bg-white/95 p-1.5 text-sm shadow-xl ring-1 ring-black/5 backdrop-blur-xl animate-dropdown-down dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10"
                    >
                      <div className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
                        <DefaultAvatar className="h-10 w-10" />
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-gray-900 dark:text-gray-100" title={user.username}>
                            {user.username}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400" title={user.email}>
                            {user.email}
                          </div>
                        </div>
                      </div>
                      <div className="mx-2 border-t border-gray-100 dark:border-white/[0.08]" />
                      <div className="flex items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-xs">
                        <span className="text-gray-500 dark:text-gray-400">余额</span>
                        <span className="font-semibold text-blue-600 dark:text-blue-300">{formatCredits(user.credits)} Credits</span>
                      </div>
                      {onLogout && (
                        <>
                          <div className="mx-2 border-t border-gray-100 dark:border-white/[0.08]" />
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setShowUserMenu(false)
                              dismissAllTooltips()
                              onLogout()
                            }}
                            className="mt-1 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-500/10"
                          >
                            <LogoutIcon />
                            退出
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="safe-area-top invisible pointer-events-none" aria-hidden="true">
        <div className="safe-header-inner" />
      </div>
      {showHelp && <HelpModal appName={appName} onClose={() => setShowHelp(false)} />}
    </>
  )
}
