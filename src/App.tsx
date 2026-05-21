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

const CREATE_MODEL_META: Record<CreateModelOption, {
  badges: string[]
  summary: string
  menuLabel: string
  theme: 'classic' | 'balanced' | 'pro'
  preview: string
}> = {
  'image-1': {
    badges: ['兼容', '稳定'],
    summary: '基础生成 · 适合旧版接口与稳定配置',
    menuLabel: '兼容模式',
    theme: 'classic',
    preview: '/model-preview-image-1.png',
  },
  'image-1.5': {
    badges: ['推荐', '均衡'],
    summary: '均衡质量 · 速度与画面表现更平衡',
    menuLabel: '平衡质量',
    theme: 'balanced',
    preview: '/model-preview-image-1-5.png',
  },
  'image-2': {
    badges: ['默认', '高质量'],
    summary: '默认推荐 · 更强细节与复杂提示词理解',
    menuLabel: '默认推荐',
    theme: 'pro',
    preview: '/model-preview-image-2.png',
  },
}

function getCreateModelOption(model: string): CreateModelOption {
  return CREATE_MODEL_OPTIONS.find((option) => CREATE_MODEL_ALIASES[option].includes(model)) ?? 'image-2'
}

function getCreateModelRequestId(model: CreateModelOption) {
  return model === 'image-2' ? 'gpt-image-2' : model
}

function CreateModelIcon({ model }: { model: CreateModelOption }) {
  const meta = CREATE_MODEL_META[model]

  return (
    <div className={`create-model-artwork is-${meta.theme}`} aria-hidden="true">
      <img src={meta.preview} alt="" draggable={false} />
      <i className="create-model-artwork-shine" />
      <b className="create-model-quality-meter"><i /><i /><i /></b>
    </div>
  )
}

function formatQueueTime(task: TaskRecord) {
  if (task.elapsed != null && task.elapsed > 0) return `${Math.max(1, Math.round(task.elapsed / 1000))}秒`
  return '00:18'
}

function formatTaskRuntime(task: TaskRecord) {
  const elapsed = task.elapsed ?? Math.max(0, Date.now() - task.createdAt)
  const seconds = Math.max(1, Math.floor(elapsed / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function formatQueueMeta(task: TaskRecord) {
  const model = task.apiModel || 'image'
  return `${model} · ${formatQueueTime(task)}`
}

function CreateSectionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-15.5 6.2" />
      <path d="M3 12A9 9 0 0 1 18.5 5.8" />
      <path d="M18 2v4h4" />
      <path d="M6 22v-4H2" />
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
  const visibleReferenceImages = inputImages.slice(0, 4)
  const referenceLimitReached = inputImages.length >= 4
  const activeModel = getCreateModelOption(activeProfile.model)
  const activeModelMeta = CREATE_MODEL_META[activeModel]

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
        <div className={`create-reference-body${visibleReferenceImages.length ? ' has-images' : ' is-empty'}`}>
          {visibleReferenceImages.map((image, index) => (
            <div className="create-reference-image" key={image.id}>
              <img src={image.dataUrl} alt="" />
              <button type="button" onClick={() => removeInputImage(index)} aria-label={`删除参考图 ${index + 1}`}>×</button>
            </div>
          ))}
          {!referenceLimitReached && (
            <button
              type="button"
              className="create-reference-empty"
              onClick={() => referenceFileInputRef.current?.click()}
              disabled={uploadingReference}
            >
              <strong>＋ 添加参考图</strong>
              <span>{uploadingReference ? '正在添加...' : '支持 JPG / PNG，最多 4 张'}</span>
            </button>
          )}
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
            <CreateModelIcon model={activeModel} />
            <div className="create-model-select-copy">
              <strong>
                {activeModel}
                {activeModelMeta.badges.map((badge) => <em key={badge}>{badge}</em>)}
              </strong>
              <span>{activeModelMeta.summary}</span>
            </div>
            <svg className="create-model-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {modelMenuOpen && (
            <div className="create-model-dropdown-menu" role="listbox" aria-label="模型">
              {CREATE_MODEL_OPTIONS.map((model) => {
                const meta = CREATE_MODEL_META[model]
                return (
                  <button
                    key={model}
                    type="button"
                    role="option"
                    aria-selected={activeModel === model}
                    className={activeModel === model ? 'is-active' : ''}
                    onClick={() => {
                      setSettings({ model: getCreateModelRequestId(model) })
                      setModelMenuOpen(false)
                    }}
                  >
                    <CreateModelIcon model={model} />
                    <div className="create-model-menu-copy">
                      <span>{model}</span>
                      <em>{meta.menuLabel}</em>
                    </div>
                    {activeModel === model && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="m5 12 4 4 10-10" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </article>
    </section>
  )
}

function CreateResultsPanel() {
  const showToast = useStore((state) => state.showToast)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await syncServerHistory()
      showToast('生成结果已刷新', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '生成结果刷新失败', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="create-results-panel">
      <div className="create-section-header" data-no-drag-select>
        <h2>生成结果</h2>
        <div className="create-section-tools">
          <button
            type="button"
            className={refreshing ? 'is-refreshing' : ''}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            aria-label="刷新生成结果"
            title="刷新生成结果"
          >
            <CreateSectionIcon />
          </button>
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
