import { useEffect, useRef, useState } from 'react'
import type { AppUser } from '../lib/auth'

interface SidebarUserMenuAction {
  label: string
  onClick: () => void
}

interface SidebarUserMenuProps {
  user: AppUser
  actions?: SidebarUserMenuAction[]
  className?: string
  onLogout: () => void
}

function UserAvatar({ user }: { user: AppUser }) {
  return (
    <span className="create-user-avatar" aria-hidden="true">
      {(user.username || user.email || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function SidebarUserMenu({ user, actions = [], className = '', onLogout }: SidebarUserMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const openMenu = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    setMenuOpen(true)
  }

  const closeSoon = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setMenuOpen(false), 160)
  }

  const runMenuAction = (action: () => void) => {
    setMenuOpen(false)
    action()
  }

  return (
    <div
      className={`create-user-menu-wrap ${className}`.trim()}
      onMouseEnter={openMenu}
      onMouseLeave={closeSoon}
      onFocus={openMenu}
      onBlur={(event) => {
        const next = event.relatedTarget
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) setMenuOpen(false)
      }}
    >
      <button
        type="button"
        className="create-user-trigger"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <UserAvatar user={user} />
        <span>{user.username}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {menuOpen && (
        <div className="create-user-menu" role="menu">
          <div className="create-user-menu-credits" role="presentation">
            <span>Credits</span>
            <strong>{Number.isFinite(user.credits) ? user.credits.toFixed(0) : '-'}</strong>
          </div>
          {actions.map((action) => (
            <button key={action.label} type="button" onClick={() => runMenuAction(action.onClick)}>
              {action.label}
            </button>
          ))}
          <button type="button" onClick={() => runMenuAction(onLogout)}>退出</button>
        </div>
      )}
    </div>
  )
}
