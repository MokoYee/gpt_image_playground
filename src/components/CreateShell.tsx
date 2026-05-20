import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { getActiveApiProfile } from '../lib/apiProfiles'
import type { AppUser } from '../lib/auth'

interface CreateShellProps {
  appName: string
  user: AppUser
  onLogout: () => void
  onOpenAccount: () => void
  onOpenConsole?: () => void
  children: ReactNode
}

function CreateIcon({ type }: { type: 'create' | 'gallery' | 'favorite' | 'model' | 'history' | 'assets' | 'settings' }) {
  if (type === 'create') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    )
  }
  if (type === 'gallery') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="m4 16 4.2-4.2a2 2 0 0 1 2.8 0L16 17" />
        <path d="m14 15 1.2-1.2a2 2 0 0 1 2.8 0L20 16" />
        <circle cx="15.5" cy="8.5" r="1.5" />
      </svg>
    )
  }
  if (type === 'model') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
        <path d="M12 12 4.5 7.8M12 12l7.5-4.2M12 12v8.4" />
      </svg>
    )
  }
  if (type === 'favorite') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
      </svg>
    )
  }
  if (type === 'history') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    )
  }
  if (type === 'assets') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H10l2 2h5.5A2.5 2.5 0 0 1 20 10.5v6A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.04.04a2 2 0 0 1-2.83 2.83l-.04-.04A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 0 1-4 0v-.06A1.7 1.7 0 0 0 8.9 19.36a1.7 1.7 0 0 0-1.88.34l-.04.04a2 2 0 0 1-2.83-2.83l.04-.04A1.7 1.7 0 0 0 4.53 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 0 1 0-4h.06A1.7 1.7 0 0 0 4.64 8.9a1.7 1.7 0 0 0-.34-1.88l-.04-.04a2 2 0 1 1 2.83-2.83l.04.04A1.7 1.7 0 0 0 9 4.53a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 0 1 4 0v.06A1.7 1.7 0 0 0 15.1 4.64a1.7 1.7 0 0 0 1.88-.34l.04-.04a2 2 0 0 1 2.83 2.83l-.04.04A1.7 1.7 0 0 0 19.47 9a1.7 1.7 0 0 0 1.56 1.03H21a2 2 0 0 1 0 4h-.06A1.7 1.7 0 0 0 19.4 15Z" />
    </svg>
  )
}

function UserAvatar({ user }: { user: AppUser }) {
  return (
    <span className="create-user-avatar" aria-hidden="true">
      {(user.username || user.email || '?').slice(0, 1).toUpperCase()}
    </span>
  )
}

function CreateSidebar({ appName, user, onLogout, onOpenAccount, onOpenConsole }: Omit<CreateShellProps, 'children'>) {
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

  const items = [
    { key: 'create', label: '创作', type: 'create' as const, active: true },
    { key: 'gallery', label: '画廊', type: 'gallery' as const },
    { key: 'favorite', label: '收藏', type: 'favorite' as const },
    { key: 'history', label: '历史', type: 'history' as const },
  ]

  return (
    <aside className="create-sidebar" data-no-drag-select>
      <div className="create-brand-mark" title={appName}>
        <CreateIcon type="gallery" />
      </div>
      <nav className="create-nav-list" aria-label="创作导航">
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`create-nav-item${item.active ? ' is-active' : ''}`}
            onClick={(item as { onClick?: () => void }).onClick}
            title={item.label}
          >
            <span><CreateIcon type={item.type} /></span>
            <em>{item.label}</em>
          </button>
        ))}
      </nav>
      <div className="create-sidebar-footer">
        <div className="create-credit-card">
          <span>Credits</span>
          <strong>{Number.isFinite(user.credits) ? user.credits.toFixed(0) : '-'}</strong>
        </div>
        <div
          className="create-user-menu-wrap"
          onMouseEnter={openMenu}
          onMouseLeave={closeSoon}
          onFocus={openMenu}
          onBlur={(event) => {
            const next = event.relatedTarget
            if (!(next instanceof Node) || !event.currentTarget.contains(next)) setMenuOpen(false)
          }}
        >
          <button type="button" className="create-user-trigger" onClick={() => setMenuOpen((open) => !open)}>
            <UserAvatar user={user} />
            <span>{user.username}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {menuOpen && (
            <div className="create-user-menu" role="menu">
              <button type="button" onClick={onOpenAccount}>账户信息</button>
              {onOpenConsole && <button type="button" onClick={onOpenConsole}>控制台</button>}
              <button type="button" onClick={onLogout}>退出</button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

function RatioButton({ label, value }: { label: string; value: string }) {
  const params = useStore((state) => state.params)
  const setParams = useStore((state) => state.setParams)
  const active = params.size === value

  return (
    <button
      type="button"
      className={`create-ratio-button${active ? ' is-active' : ''}`}
      onClick={() => setParams({ size: value })}
    >
      {label}
    </button>
  )
}

function NumberChoice({ value }: { value: number }) {
  const params = useStore((state) => state.params)
  const setParams = useStore((state) => state.setParams)
  return (
    <button
      type="button"
      className={`create-number-choice${params.n === value ? ' is-active' : ''}`}
      onClick={() => setParams({ n: value })}
    >
      {value}
    </button>
  )
}

function CreateContactBlock() {
  return (
    <div className="create-contact-block">
      <button type="button" className="create-contact-trigger" aria-describedby="create-contact-popover">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
          <path d="M8 10h8" />
          <path d="M8 14h5" />
        </svg>
        <span>联系我们</span>
      </button>
      <div className="create-contact-popover" id="create-contact-popover" role="tooltip">
        <div className="create-contact-row" aria-label="QQ 414898891">
          <span className="create-contact-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 16.4c-1 .5-2 .8-3 .7.9-.8 1.5-1.8 1.8-3A6.6 6.6 0 0 1 5.5 12a6.5 6.5 0 0 1 13 0 6.6 6.6 0 0 1-.3 2.1c.3 1.2.9 2.2 1.8 3-1 .1-2-.2-3-.7a6.8 6.8 0 0 1-10 0Z" />
              <path d="M9.2 11.2h.01M14.8 11.2h.01" />
              <path d="M9.5 14.3c1.5.9 3.5.9 5 0" />
            </svg>
          </span>
          <span className="create-contact-value">414898891</span>
        </div>
        <div className="create-contact-row" aria-label="邮箱 414898891@qq.com">
          <span className="create-contact-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="6" width="16" height="12" rx="2.5" />
              <path d="m5 8 7 5 7-5" />
            </svg>
          </span>
          <span className="create-contact-value">414898891@qq.com</span>
        </div>
      </div>
    </div>
  )
}

function CreateSettingsPanel() {
  const params = useStore((state) => state.params)
  const setParams = useStore((state) => state.setParams)
  const settings = useStore((state) => state.settings)
  const activeProfile = getActiveApiProfile(settings)
  const activeModel = ['image-1', 'image-1.5', 'image-2'].includes(activeProfile.model) ? activeProfile.model : 'image-2'
  const isHigh = params.quality === 'high'

  return (
    <aside className="create-settings-panel" data-no-drag-select>
      <h2>参数设置</h2>
      <div className="create-setting-group">
        <span className="create-setting-label">画面比例</span>
        <div className="create-ratio-grid">
          <RatioButton label="1:1" value="1024x1024" />
          <RatioButton label="14:9" value="1536x1024" />
          <RatioButton label="9:16" value="1024x1536" />
          <RatioButton label="4:3" value="1024x768" />
          <RatioButton label="3:4" value="768x1024" />
        </div>
      </div>
      <div className="create-setting-group">
        <span className="create-setting-label">生成数量</span>
        <div className="create-number-grid">
          {[1, 2, 4, 8].map((value) => <NumberChoice key={value} value={value} />)}
        </div>
      </div>
      <div className="create-setting-group">
        <span className="create-setting-label">图像质量</span>
        <div className="create-quality-toggle">
          <button type="button" className={!isHigh ? 'is-active' : ''} onClick={() => setParams({ quality: 'auto' })}>标准</button>
          <button type="button" className={isHigh ? 'is-active' : ''} onClick={() => setParams({ quality: 'high' })}>高质量</button>
        </div>
      </div>
      <div className="create-model-card">
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" />
            <path d="M12 12 4.5 7.8M12 12l7.5-4.2M12 12v8.4" />
          </svg>
          当前模型
        </span>
        <strong>{activeModel}</strong>
      </div>
      <CreateContactBlock />
    </aside>
  )
}

export default function CreateShell({ appName, user, onLogout, onOpenAccount, onOpenConsole, children }: CreateShellProps) {
  return (
    <main className="create-reference-page" data-drag-select-surface>
      <div className="create-reference-frame">
        <CreateSidebar appName={appName} user={user} onLogout={onLogout} onOpenAccount={onOpenAccount} onOpenConsole={onOpenConsole} />
        <section className="create-workspace">
          <div className="create-content-grid">
            <div className="create-main-column">{children}</div>
            <CreateSettingsPanel />
          </div>
        </section>
      </div>
    </main>
  )
}
