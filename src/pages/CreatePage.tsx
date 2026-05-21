import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Progress from 'antd/es/progress'
import { addImageFromFile, cancelQueuedTask, syncServerHistory, useStore } from '../store'
import TaskGrid from '../components/TaskGrid'
import InputBar from '../components/InputBar'
import type { TaskRecord } from '../types'
import { getActiveApiProfile } from '../lib/apiProfiles'

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

function formatQueueRuntime(task: TaskRecord, now: number) {
  const elapsed = task.elapsed ?? Math.max(0, now - task.createdAt)
  const seconds = Math.max(0, Math.floor(elapsed / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function getQueueProgressPercent(task: TaskRecord, now: number) {
  if (task.status === 'queued') return task.queuePosition ? 12 : 8
  const elapsed = task.elapsed ?? Math.max(0, now - task.createdAt)
  return Math.min(86, Math.max(28, Math.round(elapsed / 1400)))
}

function QueueLoadingThumb({ status }: { status: TaskRecord['status'] }) {
  return (
    <div className={`create-queue-thumb is-${status}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="5" width="16" height="14" rx="3" />
        <path d="m6.5 16 4.2-4.2a1.8 1.8 0 0 1 2.6 0L17 15.5" />
        <path d="m15 14 1-1a1.6 1.6 0 0 1 2.3 0l1.2 1.2" />
        <circle cx="16.5" cy="8.7" r="1.2" />
      </svg>
      <span />
    </div>
  )
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
  const [now, setNow] = useState(Date.now())
  const queueListRef = useRef<HTMLDivElement>(null)
  const previousActiveCountRef = useRef(0)
  const activeTasks = tasks
    .filter((task) => task.status === 'queued' || task.status === 'running')
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'running' ? -1 : 1
      return a.createdAt - b.createdAt
    })

  useEffect(() => {
    if (activeTasks.length === 0) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [activeTasks.length])

  useEffect(() => {
    const previousCount = previousActiveCountRef.current
    previousActiveCountRef.current = activeTasks.length
    if (activeTasks.length <= 2 || activeTasks.length <= previousCount) return

    const list = queueListRef.current
    if (!list) return
    const frame = window.requestAnimationFrame(() => {
      list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeTasks.length])

  if (activeTasks.length === 0) return null

  return (
    <section className="create-queue-panel" data-no-drag-select>
      <div className="create-section-header">
        <h2>生成队列（{activeTasks.length}）</h2>
        <span className="create-queue-summary">
          {activeTasks.filter((task) => task.status === 'running').length} 个生成中
        </span>
      </div>
      <div className="create-queue-list" ref={queueListRef}>
        {activeTasks.map((task) => {
          const queueLabel = task.status === 'queued'
            ? task.queuePosition ? `排队中 · 第 ${task.queuePosition} 位` : '排队中'
            : '生成中'
          return (
            <article key={task.id} className="create-queue-item">
              <QueueLoadingThumb status={task.status} />
              <div className="create-queue-meta">
                <strong>{task.prompt || '未命名任务'}</strong>
                <span>{task.apiModel || 'image'}</span>
              </div>
              <div className="create-queue-progress">
                <div className="create-queue-progress-head">
                  <span>{queueLabel}</span>
                  {task.status === 'running' ? <em>运行 {formatQueueRuntime(task, now)}</em> : null}
                </div>
                <Progress
                  className="create-queue-progress-bar"
                  percent={getQueueProgressPercent(task, now)}
                  showInfo={false}
                  size="small"
                  status={task.status === 'running' ? 'active' : 'normal'}
                />
              </div>
              {task.status === 'queued' && task.serverTaskId ? (
                <button type="button" onClick={() => cancelQueuedTask(task)}>取消</button>
              ) : (
                <span className="create-queue-state">{task.status === 'queued' ? '待处理' : '运行中'}</span>
              )}
            </article>
          )
        })}
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

export default function CreatePage() {
  return (
    <>
      <InputBar variant="create" />
      <CreateReferenceModelRow />
      <CreateQueuePanel />
      <CreateResultsPanel />
    </>
  )
}
