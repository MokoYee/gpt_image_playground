import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { getActiveApiProfile } from '../lib/apiProfiles'
import { getOutputImageLimitForSettings } from '../lib/paramCompatibility'
import { normalizeImageSize } from '../lib/size'
import { DEFAULT_PARAMS } from '../types'
import type { AppUser } from '../lib/auth'
import Select from './Select'
import SizePickerModal from './SizePickerModal'
import SidebarUserMenu from './SidebarUserMenu'
import ThemeToggle from './ThemeToggle'
import AppLogoMark from './AppLogoMark'

export type CreateNavKey = 'create' | 'favorite' | 'history'

interface CreateShellProps {
  appName: string
  user: AppUser
  activeNavKey: CreateNavKey
  onNavigate: (key: CreateNavKey) => void
  onLogout: () => void
  onOpenConsole?: () => void
  showSettings?: boolean
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

type CreateNavIconType = Parameters<typeof CreateIcon>[0]['type']

const CREATE_NAV_ITEMS: Array<{ key: CreateNavKey; label: string; type: CreateNavIconType }> = [
  { key: 'create', label: '创作', type: 'create' },
  // 画廊入口先隐藏，后续画廊模块开发完成后再恢复。
  // { key: 'gallery', label: '画廊', type: 'gallery' },
  { key: 'favorite', label: '收藏', type: 'favorite' },
  { key: 'history', label: '历史', type: 'history' },
]

function CreateSidebar({ appName, user, activeNavKey, onNavigate, onLogout, onOpenConsole }: Omit<CreateShellProps, 'children' | 'showSettings'>) {
  return (
    <aside className="create-sidebar" data-no-drag-select>
      <div className="create-brand-mark" title={appName}>
        <AppLogoMark />
      </div>
      <nav className="create-nav-list justify-center" aria-label="创作导航">
        {CREATE_NAV_ITEMS.map((item) => {
          const isActive = activeNavKey === item.key
          return (
            <button
              key={item.key}
              type="button"
              className={`create-nav-item${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavigate(item.key)}
              title={item.label}
            >
              <span><CreateIcon type={item.type} /></span>
              <em>{item.label}</em>
            </button>
          )
        })}
      </nav>
      <div className="create-sidebar-footer">
        <ThemeToggle className="create-sidebar-theme-toggle" tooltipPlacement="right" />
        <SidebarUserMenu
          user={user}
          actions={onOpenConsole ? [{ label: '控制台', onClick: onOpenConsole }] : []}
          onLogout={onLogout}
        />
      </div>
    </aside>
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
  const [showSizePicker, setShowSizePicker] = useState(false)
  const [compressionInput, setCompressionInput] = useState(
    params.output_compression == null ? '' : String(params.output_compression),
  )
  const [nInput, setNInput] = useState(String(params.n))
  const activeProfile = getActiveApiProfile(settings)
  const activeModel = ['image-1', 'image-1.5', 'image-2'].includes(activeProfile.model) ? activeProfile.model : 'image-2'
  const outputImageLimit = getOutputImageLimitForSettings(settings)
  const displaySize = normalizeImageSize(params.size) || DEFAULT_PARAMS.size
  const compressionDisabled = params.output_format === 'png'
  const moderationDisabled = activeProfile.apiMode === 'responses'

  useEffect(() => {
    setCompressionInput(params.output_compression == null ? '' : String(params.output_compression))
  }, [params.output_compression])

  useEffect(() => {
    setNInput(String(params.n))
  }, [params.n])

  useEffect(() => {
    if (params.quality !== DEFAULT_PARAMS.quality) {
      setParams({ quality: DEFAULT_PARAMS.quality })
    }
  }, [params.quality, setParams])

  const commitCompression = () => {
    if (compressionDisabled) {
      setCompressionInput('')
      setParams({ output_compression: null })
      return
    }

    const rawValue = compressionInput.trim()
    if (!rawValue) {
      setCompressionInput('')
      setParams({ output_compression: null })
      return
    }

    const parsedValue = Number(rawValue)
    if (!Number.isFinite(parsedValue)) {
      setCompressionInput(params.output_compression == null ? '' : String(params.output_compression))
      return
    }

    const nextValue = Math.min(100, Math.max(0, Math.round(parsedValue)))
    setCompressionInput(String(nextValue))
    setParams({ output_compression: nextValue })
  }

  const commitQuantity = () => {
    const parsedValue = Number(nInput)
    const fallbackValue = Number.isFinite(parsedValue) ? parsedValue : params.n
    const nextValue = Math.min(outputImageLimit, Math.max(1, Math.round(fallbackValue || DEFAULT_PARAMS.n)))
    setNInput(String(nextValue))
    setParams({ n: nextValue })
  }

  return (
    <>
      {showSizePicker && (
        <SizePickerModal
          currentSize={params.size}
          onSelect={(size) => setParams({ size })}
          onClose={() => setShowSizePicker(false)}
          allowAuto
        />
      )}
      <aside className="create-settings-panel" data-no-drag-select>
        <h2>参数设置</h2>
        <div className="create-setting-group">
          <span className="create-setting-label">尺寸</span>
          <button type="button" className="create-param-trigger" onClick={() => setShowSizePicker(true)}>
            <span>{displaySize}</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="create-setting-group">
          <span className="create-setting-label">格式</span>
          <Select
            value={params.output_format}
            onChange={(value) => {
              const outputFormat = value as 'png' | 'jpeg' | 'webp'
              setParams(outputFormat === 'png'
                ? { output_format: outputFormat, output_compression: null }
                : { output_format: outputFormat })
            }}
            options={[
              { label: 'PNG', value: 'png' },
              { label: 'JPEG', value: 'jpeg' },
              { label: 'WebP', value: 'webp' },
            ]}
            className="create-param-select"
          />
        </div>

        <div className="create-setting-group">
          <span className="create-setting-label">压缩率</span>
          <input
            value={compressionInput}
            onChange={(event) => setCompressionInput(event.target.value)}
            onBlur={commitCompression}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            disabled={compressionDisabled}
            type="number"
            min={0}
            max={100}
            placeholder={compressionDisabled ? 'PNG 不适用' : '0-100'}
            className="create-param-input"
          />
          <span className="create-param-hint">仅 JPEG / WebP 生效</span>
        </div>

        <div className="create-setting-group">
          <span className="create-setting-label">审核</span>
          <Select
            value={moderationDisabled ? 'auto' : params.moderation}
            onChange={(value) => {
              if (!moderationDisabled) setParams({ moderation: value as 'auto' | 'low' })
            }}
            options={[
              { label: 'auto', value: 'auto' },
              { label: 'low', value: 'low' },
            ]}
            disabled={moderationDisabled}
            className="create-param-select"
          />
          {moderationDisabled && <span className="create-param-hint">Responses API 固定为 auto</span>}
        </div>

        <div className="create-setting-group">
          <span className="create-setting-label">生成数量</span>
          <input
            value={nInput}
            onChange={(event) => setNInput(event.target.value)}
            onBlur={commitQuantity}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur()
            }}
            type="number"
            min={1}
            max={outputImageLimit}
            className="create-param-input"
          />
          <span className="create-param-hint">最多 {outputImageLimit} 张</span>
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
    </>
  )
}

export default function CreateShell({ appName, user, activeNavKey, onNavigate, onLogout, onOpenConsole, showSettings = true, children }: CreateShellProps) {
  return (
    <main className="create-reference-page" data-drag-select-surface>
      <div className="create-reference-frame">
        <CreateSidebar appName={appName} user={user} activeNavKey={activeNavKey} onNavigate={onNavigate} onLogout={onLogout} onOpenConsole={onOpenConsole} />
        <section className="create-workspace">
          <div className={`create-content-grid${showSettings ? '' : ' is-full-width'}`}>
            <div className="create-main-column">{children}</div>
            {showSettings && <CreateSettingsPanel />}
          </div>
        </section>
      </div>
    </main>
  )
}
