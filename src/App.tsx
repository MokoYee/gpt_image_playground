import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { addImageFromFile, cancelQueuedTask, initStore, resetAuthenticatedDraft, syncServerHistory, useStore } from './store'
import { buildSettingsFromUrlParams, clearUrlSettingParams, hasUrlSettingParams } from './lib/urlSettings'
import { useDockerApiUrlMigrationNotice } from './hooks/useDockerApiUrlMigrationNotice'
import TaskGrid from './components/TaskGrid'
import InputBar from './components/InputBar'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import SettingsModal from './components/SettingsModal'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import MaskEditorModal from './components/MaskEditorModal'
import ImageContextMenu from './components/ImageContextMenu'
import SupportPromptModal from './components/SupportPromptModal'
import AuthPage from './components/AuthPage'
import ConsolePage from './components/ConsolePage'
import AccountPage from './components/AccountPage'
import CreateShell from './components/CreateShell'
import { clearAuthSession, DEFAULT_APP_NAME, fetchCurrentUser, readAuthSession, readPublicSettings } from './lib/auth'
import type { AppUser } from './lib/auth'
import type { TaskRecord } from './types'
import { getActiveApiProfile } from './lib/apiProfiles'

type AppView = 'app' | 'console' | 'account'

const CREATE_MODEL_OPTIONS = ['image-1', 'image-1.5', 'image-2'] as const
type CreateModelOption = typeof CREATE_MODEL_OPTIONS[number]
const CREATE_MODEL_ALIASES: Record<CreateModelOption, string[]> = {
  'image-1': ['image-1', 'gpt-image-1'],
  'image-1.5': ['image-1.5', 'gpt-image-1.5'],
  'image-2': ['image-2', 'gpt-image-2'],
}

function getCreateModelOption(model: string): CreateModelOption {
  return CREATE_MODEL_OPTIONS.find((option) => CREATE_MODEL_ALIASES[option].includes(model)) ?? 'image-2'
}

function formatTaskRuntime(task: TaskRecord) {
  const startedAt = task.createdAt || Date.now()
  const elapsedMs = task.elapsed ?? Math.max(0, Date.now() - startedAt)
  const seconds = Math.max(1, Math.round(elapsedMs / 1000))
  if (seconds < 60) return `${seconds}秒`
  return `${Math.floor(seconds / 60)}分${seconds % 60}秒`
}

function formatQueueMeta(task: TaskRecord) {
  const quality = task.params.quality === 'high' ? '高质量' : '标准'
  const size = task.params.size || '默认尺寸'
  return [task.apiModel || task.apiProfileName || '当前配置', size, quality].join(' · ')
}

function CreateSectionIcon({ type }: { type: 'grid' | 'download' | 'rerun' | 'delete' }) {
  if (type === 'grid') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="4" y="4" width="6" height="6" rx="1.4" />
        <rect x="14" y="4" width="6" height="6" rx="1.4" />
        <rect x="4" y="14" width="6" height="6" rx="1.4" />
        <rect x="14" y="14" width="6" height="6" rx="1.4" />
      </svg>
    )
  }
  if (type === 'download') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 4v10" />
        <path d="m7 10 5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
    )
  }
  if (type === 'rerun') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 0 1-15.5 6.2" />
        <path d="M3 12A9 9 0 0 1 18.5 5.8" />
        <path d="M18 2v4h4" />
        <path d="M6 22v-4H2" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m6 6 1 15h10l1-15" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  )
}

function CreateQueuePanel() {
  const tasks = useStore((state) => state.tasks)
  const activeTasks = tasks
    .filter((task) => task.status === 'queued' || task.status === 'running')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'running' ? -1 : 1
      return a.createdAt - b.createdAt
    })

  if (activeTasks.length === 0) return null

  return (
    <section className="create-queue-panel" data-no-drag-select>
      <div className="create-section-header">
        <h2>生成队列（{activeTasks.length}）</h2>
        <span className="create-queue-summary">
          {activeTasks.filter((task) => task.status === 'running').length} 个生成中
        </span>
      </div>
      <div className="create-queue-list">
        {activeTasks.map((task) => (
          <article key={task.id} className="create-queue-item">
            <div className={`create-queue-status-dot is-${task.status}`} aria-hidden="true" />
            <div className="create-queue-meta">
              <strong>{task.prompt || '未命名任务'}</strong>
              <span>{formatQueueMeta(task)}</span>
            </div>
            <div className="create-queue-progress">
              <span>{task.status === 'queued' ? '排队中' : `生成中 · ${formatTaskRuntime(task)}`}</span>
              <i><b style={{ width: task.status === 'queued' ? '18%' : '62%' }} /></i>
              <em>{task.status === 'queued' && task.queuePosition ? `第 ${task.queuePosition} 位` : task.status === 'queued' ? '等待调度' : '处理中'}</em>
            </div>
            {task.status === 'queued' && task.serverTaskId ? (
              <button type="button" onClick={() => cancelQueuedTask(task)}>取消</button>
            ) : (
              <span className="create-queue-state">{task.status === 'queued' ? '本地任务' : '运行中'}</span>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

function CreateReferenceModelRow() {
  const inputImages = useStore((state) => state.inputImages)
  const settings = useStore((state) => state.settings)
  const setSettings = useStore((state) => state.setSettings)
  const removeInputImage = useStore((state) => state.removeInputImage)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [uploadingReference, setUploadingReference] = useState(false)
  const modelMenuRef = useRef<HTMLDivElement>(null)
  const referenceFileInputRef = useRef<HTMLInputElement>(null)
  const activeProfile = getActiveApiProfile(settings)
  const firstImage = inputImages[0]
  const referenceLimitReached = inputImages.length >= 4
  const activeModel = getCreateModelOption(activeProfile.model)

  const handleReferenceFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? [])
    const remainingSlots = Math.max(0, 4 - inputImages.length)
    const files = selectedFiles.slice(0, remainingSlots)

    if (!files.length) {
      event.currentTarget.value = ''
      return
    }

    setUploadingReference(true)
    try {
      for (const file of files) {
        await addImageFromFile(file)
      }
      if (selectedFiles.length > files.length) {
        useStore.getState().showToast(`最多添加 4 张参考图，已忽略 ${selectedFiles.length - files.length} 张`, 'info')
      }
    } catch (error) {
      useStore.getState().showToast(error instanceof Error ? error.message : '参考图添加失败', 'error')
    } finally {
      setUploadingReference(false)
      event.currentTarget.value = ''
    }
  }

  useEffect(() => {
    if (!modelMenuOpen) return

    const closeModelMenu = (event: MouseEvent) => {
      if (!modelMenuRef.current?.contains(event.target as Node)) {
        setModelMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', closeModelMenu)
    return () => document.removeEventListener('mousedown', closeModelMenu)
  }, [modelMenuOpen])

  return (
    <section className="create-reference-model-row" data-no-drag-select>
      <article className="create-reference-card">
        <h2>参考图</h2>
        <div className={`create-reference-body${firstImage ? '' : ' is-empty'}`}>
          {firstImage && (
            <div className="create-reference-image">
              <img src={firstImage.dataUrl} alt="" />
              <button type="button" onClick={() => removeInputImage(0)} aria-label="删除参考图">×</button>
            </div>
          )}
          <button
            type="button"
            className="create-reference-empty"
            onClick={() => !referenceLimitReached && referenceFileInputRef.current?.click()}
            disabled={referenceLimitReached || uploadingReference}
          >
            <strong>{referenceLimitReached ? '参考图已满' : '＋ 添加参考图'}</strong>
            <span>{uploadingReference ? '正在添加...' : '支持 JPG / PNG，最多 4 张'}</span>
          </button>
          <input
            ref={referenceFileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleReferenceFileChange}
          />
        </div>
      </article>
      <article className="create-model-select-card">
        <h2>模型</h2>
        <div className={`create-model-dropdown${modelMenuOpen ? ' is-open' : ''}`} ref={modelMenuRef}>
          <button
            type="button"
            className="create-model-select-body"
            aria-haspopup="listbox"
            aria-expanded={modelMenuOpen}
            onClick={() => setModelMenuOpen((open) => !open)}
          >
            <img src="/auth-portal-pro.png" alt="" />
            <div>
              <strong>
                {activeModel}
                <em>推荐</em>
                <em>高质量</em>
              </strong>
              <span>{activeProfile.name || '默认模型'} · 兼容当前接口配置</span>
            </div>
            <svg className="create-model-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {modelMenuOpen && (
            <div className="create-model-dropdown-menu" role="listbox" aria-label="模型">
              {CREATE_MODEL_OPTIONS.map((model) => (
                <button
                  key={model}
                  type="button"
                  role="option"
                  aria-selected={activeModel === model}
                  className={activeModel === model ? 'is-active' : ''}
                  onClick={() => {
                    setSettings({ model: model === 'image-2' ? 'gpt-image-2' : model })
                    setModelMenuOpen(false)
                  }}
                >
                  <span>{model}</span>
                  <em>{model === 'image-2' ? '默认推荐' : model === 'image-1.5' ? '平衡质量' : '兼容模式'}</em>
                  {activeModel === model && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m5 12 4 4 10-10" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </article>
    </section>
  )
}

function CreateResultsPanel() {
  return (
    <section className="create-results-panel">
      <div className="create-section-header" data-no-drag-select>
        <h2>生成结果</h2>
        <div className="create-section-tools" aria-hidden="true">
          <span><CreateSectionIcon type="grid" /></span>
          <span><CreateSectionIcon type="rerun" /></span>
          <span><CreateSectionIcon type="download" /></span>
          <span><CreateSectionIcon type="delete" /></span>
        </div>
      </div>
      <TaskGrid />
    </section>
  )
}

function readRouteView(): AppView {
  const route = window.location.hash.replace(/^#\/?/, '')
  if (route === 'console' || route === 'account') return route
  return 'app'
}

export default function App() {
  const setSettings = useStore((s) => s.setSettings)
  const [authSession, setAuthSession] = useState<AppUser | null>(() => readAuthSession()?.user ?? null)
  const [view, setView] = useState<AppView>(() => readRouteView())
  const [appName, setAppName] = useState(DEFAULT_APP_NAME)
  useDockerApiUrlMigrationNotice()

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const nextSettings = buildSettingsFromUrlParams(useStore.getState().settings, searchParams)

    setSettings(nextSettings)

    if (hasUrlSettingParams(searchParams)) {
      clearUrlSettingParams(searchParams)

      const nextSearch = searchParams.toString()
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
      window.history.replaceState(null, '', nextUrl)
    }

    initStore()
  }, [setSettings])

  useEffect(() => {
    const preventPageImageDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('img')) {
        e.preventDefault()
      }
    }

    document.addEventListener('dragstart', preventPageImageDrag)
    return () => document.removeEventListener('dragstart', preventPageImageDrag)
  }, [])

  useEffect(() => {
    const syncRoute = () => setView(readRouteView())
    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  useEffect(() => {
    void fetchCurrentUser().then((user) => {
      setAuthSession(user)
      if (user) {
        void syncServerHistory().catch((error) => {
          useStore.getState().showToast(error instanceof Error ? error.message : '历史记录同步失败', 'error')
        })
      }
    })
    void readPublicSettings().then((settings) => {
      setAppName(settings.site?.appName || DEFAULT_APP_NAME)
    }).catch(() => {
      setAppName(DEFAULT_APP_NAME)
    })
  }, [])

  useEffect(() => {
    document.title = appName.trim() || DEFAULT_APP_NAME
  }, [appName])

  const navigateView = (nextView: AppView, replace = false) => {
    const nextHash = nextView === 'app' ? '' : `#/${nextView}`
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`
    if (replace) {
      window.history.replaceState(null, '', nextUrl)
    } else {
      window.history.pushState(null, '', nextUrl)
    }
    setView(nextView)
  }

  const handleAuthenticated = (user: AppUser) => {
    setAuthSession(user)
    resetAuthenticatedDraft()
    void syncServerHistory()
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setView('app')
  }

  const handleLogout = () => {
    clearAuthSession()
    setAuthSession(null)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setView('app')
  }

  if (!authSession) {
    return (
      <>
        <AuthPage appName={appName} onAppNameChange={setAppName} onAuthenticated={handleAuthenticated} />
        <Toast />
      </>
    )
  }

  if (view === 'console' && authSession.role === 'admin') {
    return <ConsolePage currentUser={authSession} appName={appName} onAppNameChange={setAppName} onClose={() => navigateView('app', true)} />
  }

  if (view === 'account') {
    return <AccountPage user={authSession} onClose={() => navigateView('app', true)} onUserChange={handleAuthenticated} />
  }

  return (
    <>
      <CreateShell
        appName={appName}
        user={authSession}
        onLogout={handleLogout}
        onOpenConsole={authSession.role === 'admin' ? () => navigateView('console') : undefined}
        onOpenAccount={() => navigateView('account')}
      >
        <InputBar variant="create" />
        <CreateReferenceModelRow />
        <CreateQueuePanel />
        <CreateResultsPanel />
      </CreateShell>
      <DetailModal />
      <Lightbox />
      <SettingsModal />
      <ConfirmDialog />
      <SupportPromptModal />
      <Toast />
      <MaskEditorModal />
      <ImageContextMenu />
    </>
  )
}
