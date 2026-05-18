import { useState } from 'react'
import { useVersionCheck } from '../hooks/useVersionCheck'
import { useTooltip } from '../hooks/useTooltip'
import { dismissAllTooltips } from '../lib/tooltipDismiss'
import ViewportTooltip from './ViewportTooltip'
import HelpModal from './HelpModal'
import type { UserRole } from '../lib/auth'

interface HeaderProps {
  user?: {
    username: string
    email: string
    role?: UserRole
  }
  onLogout?: () => void
  onOpenConsole?: () => void
  onOpenAccount?: () => void
}

export default function Header({ user, onLogout, onOpenConsole, onOpenAccount }: HeaderProps) {
  const { hasUpdate, latestRelease, dismiss } = useVersionCheck()
  const [showHelp, setShowHelp] = useState(false)

  const consoleTooltip = useTooltip()
  const accountTooltip = useTooltip()
  const helpTooltip = useTooltip()
  const settingsTooltip = useTooltip()

  return (
    <>
      <header data-no-drag-select className="safe-area-top fixed top-0 left-0 right-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-white/[0.08]">
        <div className="safe-area-x safe-header-inner max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <h1 className="inline-flex items-start relative">
              <span className="text-[17px] sm:text-lg font-bold tracking-tight text-gray-800 dark:text-gray-100">
                Hua Image Playground
              </span>
              {hasUpdate && latestRelease && (
                <button
                  type="button"
                  onClick={dismiss}
                  className="absolute -right-1 -top-1 translate-x-full -translate-y-1/4 px-1 py-0.5 rounded-[4px] border border-red-500/30 text-[9px] font-black bg-red-500 text-white hover:bg-red-600 transition-all animate-fade-in leading-none shadow-sm"
                  title={`新版本 ${latestRelease.tag}`}
                >
                  NEW
                </button>
              )}
            </h1>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {user && (
              <div className="hidden items-center gap-2 rounded-xl border border-gray-200/70 bg-white/60 px-2.5 py-1.5 text-xs text-gray-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300 sm:flex">
                <span className="max-w-28 truncate font-medium">{user.username}</span>
              </div>
            )}
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
            {onLogout && (
              <button
                onClick={onLogout}
                className="rounded-lg px-2.5 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-200"
              >
                退出
              </button>
            )}
          </div>
        </div>
      </header>
      <div className="safe-area-top invisible pointer-events-none" aria-hidden="true">
        <div className="safe-header-inner" />
      </div>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </>
  )
}
