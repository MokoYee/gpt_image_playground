import { useEffect, useState } from 'react'
import Tooltip from 'antd/es/tooltip'
import {
  applyThemePreference,
  readThemePreference,
  resolveThemePreference,
  subscribeSystemThemeChange,
  writeThemePreference,
} from '../lib/theme'
import type { ResolvedTheme, ThemePreference } from '../lib/theme'

const THEME_ORDER: ThemePreference[] = ['system', 'light', 'dark']
const THEME_LABELS: Record<ThemePreference, string> = {
  system: '跟随系统',
  light: '明亮模式',
  dark: '夜晚模式',
}

interface ThemeToggleProps {
  className?: string
  onResolvedThemeChange?: (theme: ResolvedTheme) => void
  tooltipPlacement?: 'top' | 'bottom' | 'left' | 'right' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'leftTop' | 'leftBottom' | 'rightTop' | 'rightBottom'
}

function SunIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.58 4.58 6 6M18 18l1.42 1.42M2.5 12h2M19.5 12h2M4.58 19.42 6 18M18 6l1.42-1.42" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20.2 14.2A7.6 7.6 0 0 1 9.8 3.8 8.6 8.6 0 1 0 20.2 14.2Z" />
    </svg>
  )
}

function SystemThemeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="11" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  )
}

function ThemeIcon({ preference, resolvedTheme }: { preference: ThemePreference; resolvedTheme: ResolvedTheme }) {
  if (preference === 'system') return <SystemThemeIcon />
  if (resolvedTheme === 'dark') return <MoonIcon />
  return <SunIcon />
}

function getNextThemePreference(preference: ThemePreference): ThemePreference {
  return THEME_ORDER[(THEME_ORDER.indexOf(preference) + 1) % THEME_ORDER.length]
}

export default function ThemeToggle({ className = '', onResolvedThemeChange, tooltipPlacement = 'bottomRight' }: ThemeToggleProps) {
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => readThemePreference())
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveThemePreference(readThemePreference()))

  useEffect(() => {
    const nextResolvedTheme = applyThemePreference(themePreference)
    setResolvedTheme(nextResolvedTheme)
    onResolvedThemeChange?.(nextResolvedTheme)

    return subscribeSystemThemeChange((systemResolvedTheme) => {
      setResolvedTheme(systemResolvedTheme)
      onResolvedThemeChange?.(systemResolvedTheme)
    })
  }, [onResolvedThemeChange, themePreference])

  const handleToggle = () => {
    const nextPreference = getNextThemePreference(themePreference)
    const nextResolvedTheme = writeThemePreference(nextPreference)
    setThemePreference(nextPreference)
    setResolvedTheme(nextResolvedTheme)
    onResolvedThemeChange?.(nextResolvedTheme)
  }

  const nextPreference = getNextThemePreference(themePreference)
  const currentLabel = THEME_LABELS[themePreference]
  const nextLabel = THEME_LABELS[nextPreference]
  const resolvedLabel = resolvedTheme === 'dark' ? THEME_LABELS.dark : THEME_LABELS.light
  const tooltipTitle = `当前：${currentLabel}${themePreference === 'system' ? `（${resolvedLabel}）` : ''}`

  return (
    <div className={`theme-toggle-wrap ${className}`.trim()}>
      <Tooltip
        title={tooltipTitle}
        placement={tooltipPlacement}
        trigger={['hover', 'focus']}
        rootClassName="theme-toggle-antd-tooltip"
      >
        <button
          type="button"
          className="theme-toggle"
          aria-label={`主题切换，当前${currentLabel}，点击切换到${nextLabel}`}
          onClick={handleToggle}
        >
          <ThemeIcon preference={themePreference} resolvedTheme={resolvedTheme} />
        </button>
      </Tooltip>
    </div>
  )
}
