import { useEffect, useMemo, useState } from 'react'
import ConfigProvider from 'antd/es/config-provider'
import DatePicker from 'antd/es/date-picker'
import zhCN from 'antd/es/locale/zh_CN'
import antdTheme from 'antd/es/theme'
import dayjs, { type Dayjs } from 'dayjs'
import { fetchProtectedImageDataUrl, readMyImageTaskPage, type ImageTaskListParams, type ServerImageTask } from '../lib/api'
import type { ResolvedTheme } from '../lib/theme'
import { deleteServerHistoryTasks, loadServerTaskToStore, openServerTaskDetail, reuseConfig, setServerTaskFavoriteState, syncServerTaskList, useStore } from '../store'
import Select from '../components/Select'

interface HistoryPageProps {
  onGoCreate: () => void
}

type HistoryFilters = {
  keyword: string
  model: string
  status: ImageTaskListParams['status']
  quality: ImageTaskListParams['quality']
  from: number | null
  to: number | null
}

type FilterAction = 'query' | 'reset'

const EMPTY_FILTERS: HistoryFilters = {
  keyword: '',
  model: '',
  status: '',
  quality: '',
  from: null,
  to: null,
}

const STATUS_LABELS: Record<ServerImageTask['status'], string> = {
  queued: '排队中',
  running: '生成中',
  done: '已完成',
  error: '失败',
  cancelled: '已取消',
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]
const { RangePicker } = DatePicker

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '生成中' },
  { value: 'done', label: '已完成' },
  { value: 'error', label: '失败' },
  { value: 'cancelled', label: '已取消' },
]

const QUALITY_OPTIONS = [
  { value: '', label: '全部质量' },
  { value: 'auto', label: 'auto' },
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
]

const PAGE_SIZE_SELECT_OPTIONS = PAGE_SIZE_OPTIONS.map((value) => ({ value, label: `${value} 条/页` }))

function toServerImageId(fileId: string) {
  return `server:${fileId}`
}

function canDeleteTask(task: ServerImageTask) {
  return task.status === 'done' || task.status === 'error' || task.status === 'cancelled'
}

function formatDateTime(value?: number | null) {
  if (!value) return '-'
  return new Date(value).toLocaleString()
}

function getResolvedThemeFromDocument(): ResolvedTheme {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
}

function getDateRangeValue(filters: HistoryFilters): [Dayjs, Dayjs] | null {
  return filters.from && filters.to ? [dayjs(filters.from), dayjs(filters.to)] : null
}

function cloneFilters(filters: HistoryFilters): HistoryFilters {
  return { ...filters }
}

function formatShortDateTime(value?: number | null) {
  if (!value) return ['-', '']
  const date = new Date(value)
  return [date.toISOString().slice(0, 10), date.toTimeString().slice(0, 5)]
}

function ButtonSpinner() {
  return <span className="history-button-spinner" aria-hidden="true" />
}

function SearchIcon() {
  return (
    <svg className="history-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </svg>
  )
}

function ResetIcon() {
  return (
    <svg className="history-button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 0 1-15.5 6.2" />
      <path d="M3 12A9 9 0 0 1 18.5 5.8" />
      <path d="M18 2v4h4" />
      <path d="M6 22v-4H2" />
    </svg>
  )
}

function HistoryButtonGlyph({ loading, type }: { loading: boolean; type: FilterAction }) {
  return (
    <span className="history-button-icon-slot">
      {loading ? <ButtonSpinner /> : type === 'query' ? <SearchIcon /> : <ResetIcon />}
    </span>
  )
}

function ProtectedThumb({ fileId }: { fileId?: string }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    setSrc('')
    if (!fileId) return () => {
      cancelled = true
    }
    fetchProtectedImageDataUrl(fileId)
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setSrc('')
      })
    return () => {
      cancelled = true
    }
  }, [fileId])

  if (!fileId || !src) {
    return (
      <span className="history-thumb is-empty" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16m-2-2 1.6-1.6a2 2 0 0 1 2.8 0L20 14" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
        </svg>
      </span>
    )
  }

  return <img className="history-thumb" src={src} alt="" loading="lazy" />
}

export default function HistoryPage({ onGoCreate }: HistoryPageProps) {
  const setLightboxImageId = useStore((state) => state.setLightboxImageId)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)
  const showToast = useStore((state) => state.showToast)
  const [items, setItems] = useState<ServerImageTask[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [draftFilters, setDraftFilters] = useState<HistoryFilters>(EMPTY_FILTERS)
  const [filters, setFilters] = useState<HistoryFilters>(EMPTY_FILTERS)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [filterAction, setFilterAction] = useState<FilterAction | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => getResolvedThemeFromDocument())

  const queryParams = useMemo<ImageTaskListParams>(() => ({
    page,
    pageSize,
    keyword: filters.keyword,
    model: filters.model,
    status: filters.status,
    quality: filters.quality,
    from: filters.from,
    to: filters.to,
  }), [filters, page, pageSize])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const deletableItems = useMemo(() => items.filter(canDeleteTask), [items])
  const allDeletableSelected = deletableItems.length > 0 && deletableItems.every((item) => selectedSet.has(item.id))
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const loadTasks = async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    try {
      const result = await readMyImageTaskPage(queryParams)
      setItems(result.items)
      setTotal(result.total)
      setSelectedIds((prev) => prev.filter((id) => result.items.some((item) => item.id === id)))
      void syncServerTaskList({ page: 1, pageSize: 100 }).catch(() => undefined)
      if (filterAction === 'query') {
        showToast(`查询完成，共 ${result.total} 条记录`, 'success')
      } else if (filterAction === 'reset') {
        showToast('筛选条件已重置', 'success')
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : '历史记录加载失败', 'error')
    } finally {
      if (showSpinner) setLoading(false)
      if (filterAction) setFilterAction(null)
    }
  }

  useEffect(() => {
    void loadTasks()
  }, [queryParams, reloadKey])

  useEffect(() => {
    const observer = new MutationObserver(() => setResolvedTheme(getResolvedThemeFromDocument()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const applyFilters = () => {
    setFilterAction('query')
    setPage(1)
    setFilters(cloneFilters(draftFilters))
    setReloadKey((value) => value + 1)
  }

  const resetFilters = () => {
    setFilterAction('reset')
    setDraftFilters(cloneFilters(EMPTY_FILTERS))
    setFilters(cloneFilters(EMPTY_FILTERS))
    setPage(1)
    setReloadKey((value) => value + 1)
  }

  const toggleSelect = (taskId: string, checked: boolean) => {
    setSelectedIds((prev) => checked ? Array.from(new Set([...prev, taskId])) : prev.filter((id) => id !== taskId))
  }

  const toggleSelectPage = () => {
    if (allDeletableSelected) {
      const pageIds = new Set(deletableItems.map((item) => item.id))
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)))
      return
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...deletableItems.map((item) => item.id)])))
  }

  const deleteTasks = (taskIds: string[]) => {
    const ids = Array.from(new Set(taskIds))
    if (!ids.length) return
    setConfirmDialog({
      title: ids.length > 1 ? '批量删除历史' : '删除历史记录',
      message: ids.length > 1 ? `确定要删除选中的 ${ids.length} 条历史记录吗？` : '确定要删除这条历史记录吗？',
      action: async () => {
        const result = await deleteServerHistoryTasks(ids)
        setSelectedIds((prev) => prev.filter((id) => !result.deletedTaskIds.includes(id)))
        await loadTasks(false)
        if (result.deletedTaskIds.length && result.skippedTaskIds.length) {
          showToast(`已删除 ${result.deletedTaskIds.length} 条，${result.skippedTaskIds.length} 条暂不能删除`, 'error')
        } else if (result.deletedTaskIds.length) {
          showToast(ids.length > 1 ? `已删除 ${result.deletedTaskIds.length} 条历史记录` : '历史记录已删除', 'success')
        } else {
          showToast('当前状态暂不能删除', 'error')
          throw new Error('当前状态暂不能删除')
        }
      },
    })
  }

  const handleFavorite = async (task: ServerImageTask) => {
    const nextFavorite = !task.isFavorite
    await setServerTaskFavoriteState(task.id, nextFavorite)
    setItems((prev) => prev.map((item) => item.id === task.id ? { ...item, isFavorite: nextFavorite, favoriteAt: nextFavorite ? Date.now() : null } : item))
    showToast(nextFavorite ? '已收藏' : '已取消收藏', 'success')
  }

  const handleReuse = async (serverTaskId: string) => {
    const localTask = await loadServerTaskToStore(serverTaskId)
    await reuseConfig(localTask)
    onGoCreate()
  }

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: resolvedTheme === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          borderRadius: 8,
          colorPrimary: '#3b82f6',
          colorBgContainer: resolvedTheme === 'dark' ? '#0b111c' : '#ffffff',
          colorBgElevated: resolvedTheme === 'dark' ? '#111827' : '#ffffff',
          colorBorder: resolvedTheme === 'dark' ? 'rgba(148,163,184,0.22)' : 'rgba(15,23,42,0.12)',
          colorText: resolvedTheme === 'dark' ? '#dbe6f4' : '#142033',
          colorTextPlaceholder: resolvedTheme === 'dark' ? '#7d8ba0' : '#94a3b8',
          colorTextSecondary: resolvedTheme === 'dark' ? '#9aa8ba' : '#667085',
          fontFamily: 'var(--font-ui-sans)',
        },
      }}
    >
    <section className="history-page-panel">
      <div className="history-filter-bar" data-no-drag-select>
        <label className="history-filter-field">
          <span>关键词</span>
          <input value={draftFilters.keyword} onChange={(event) => setDraftFilters((prev) => ({ ...prev, keyword: event.target.value }))} placeholder="提示词" />
        </label>
        <label className="history-filter-field">
          <span>模型</span>
          <input value={draftFilters.model} onChange={(event) => setDraftFilters((prev) => ({ ...prev, model: event.target.value }))} placeholder="模型名称" />
        </label>
        <div className="history-filter-field">
          <span>状态</span>
          <Select
            value={draftFilters.status || ''}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, status: value as HistoryFilters['status'] }))}
            options={STATUS_OPTIONS}
            className="history-filter-select"
          />
        </div>
        <div className="history-filter-field">
          <span>质量</span>
          <Select
            value={draftFilters.quality || ''}
            onChange={(value) => setDraftFilters((prev) => ({ ...prev, quality: value as HistoryFilters['quality'] }))}
            options={QUALITY_OPTIONS}
            className="history-filter-select"
          />
        </div>
        <div className="history-filter-field history-filter-time-field">
          <span>生成时间</span>
          <RangePicker
            showTime
            allowClear
            value={getDateRangeValue(draftFilters)}
            onChange={(value) => setDraftFilters((prev) => ({
              ...prev,
              from: value?.[0] ? value[0].valueOf() : null,
              to: value?.[1] ? value[1].valueOf() : null,
            }))}
            format="YYYY-MM-DD HH:mm"
            placeholder={['开始时间', '结束时间']}
            className="history-date-range"
          />
        </div>
        <div className="history-filter-actions">
          <button type="button" onClick={applyFilters} disabled={loading || filterAction !== null} className={filterAction === 'query' ? 'is-loading' : ''} aria-busy={filterAction === 'query'}>
            <HistoryButtonGlyph loading={filterAction === 'query'} type="query" />
            <span className="history-button-label">查询</span>
          </button>
          <button type="button" onClick={resetFilters} disabled={loading || filterAction !== null} className={filterAction === 'reset' ? 'is-loading' : ''} aria-busy={filterAction === 'reset'}>
            <HistoryButtonGlyph loading={filterAction === 'reset'} type="reset" />
            <span className="history-button-label">重置</span>
          </button>
        </div>
      </div>

      <div className="history-bulk-bar" data-no-drag-select>
        <span>已选 {selectedIds.length} 条</span>
        <button type="button" disabled={!selectedIds.length} onClick={() => deleteTasks(selectedIds)}>删除选中</button>
      </div>

      <div className="history-table-wrap">
        <table className="history-table">
          <thead>
            <tr>
              <th className="is-checkbox">
                <input type="checkbox" checked={allDeletableSelected} disabled={!deletableItems.length} onChange={toggleSelectPage} aria-label="选择当前页可删除记录" />
              </th>
              <th>图片</th>
              <th>提示词</th>
              <th>模型</th>
              <th>参数</th>
              <th>Credits</th>
              <th>状态</th>
              <th>生成时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((task) => {
              const firstImage = task.outputImages?.[0]
              const imageList = task.outputImages?.map((image) => toServerImageId(image.id)) ?? []
              const [date, time] = formatShortDateTime(task.createdAt)
              return (
                <tr key={task.id}>
                  <td className="is-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(task.id)}
                      disabled={!canDeleteTask(task)}
                      onChange={(event) => toggleSelect(task.id, event.target.checked)}
                      aria-label="选择历史记录"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="history-thumb-button"
                      onClick={() => firstImage && setLightboxImageId(toServerImageId(firstImage.id), imageList)}
                      disabled={!firstImage}
                      title={firstImage ? '预览图片' : undefined}
                    >
                      <ProtectedThumb fileId={firstImage?.id} />
                    </button>
                  </td>
                  <td>
                    <span className="history-prompt-cell" title={task.prompt}>{task.prompt || '-'}</span>
                  </td>
                  <td>
                    <span className="history-model-cell" title={task.apiModel || ''}>{task.apiModel || '-'}</span>
                  </td>
                  <td>
                    <div className="history-param-tags">
                      <span>{task.params?.size || '-'}</span>
                      <span>{task.params?.quality || 'auto'}</span>
                      <span>{task.params?.output_format || 'png'}</span>
                    </div>
                  </td>
                  <td className="history-credit-cell">{task.creditsCharged ?? task.creditsEstimated ?? '-'}</td>
                  <td><span className={`history-status is-${task.status}`}>{STATUS_LABELS[task.status]}</span></td>
                  <td><span className="history-time-cell" title={formatDateTime(task.createdAt)}>{date}<br />{time}</span></td>
                  <td>
                    <div className="history-row-actions" data-no-drag-select>
                      <button type="button" onClick={() => void handleFavorite(task)} title={task.isFavorite ? '取消收藏' : '收藏'} aria-label={task.isFavorite ? '取消收藏' : '收藏'} className={task.isFavorite ? 'is-favorite' : ''}>
                        <svg viewBox="0 0 24 24" fill={task.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => void openServerTaskDetail(task.id)} title="详情" aria-label="详情">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h9" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => void handleReuse(task.id)} title="复用配置" aria-label="复用配置">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 0 1 8 8v2" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="m3 10 6 6m-6-6 6-6" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => deleteTasks([task.id])} disabled={!canDeleteTask(task)} title={canDeleteTask(task) ? '删除' : '当前状态暂不能删除'} aria-label="删除" className="is-danger">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-10 0 1 15h10l1-15M10 11v6m4-6v6" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!items.length && (
              <tr>
                <td colSpan={9}>
                  <div className="history-empty-state">{loading ? '加载中...' : '暂无历史记录'}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="history-pagination" data-no-drag-select>
        <span>第 {page} / {totalPages} 页</span>
        <div className="history-page-size-control">
          <Select
            value={pageSize}
            onChange={(value) => {
              setPageSize(Number(value))
              setPage(1)
            }}
            options={PAGE_SIZE_SELECT_OPTIONS}
            className="history-filter-select"
          />
        </div>
        <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>上一页</button>
        <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}>下一页</button>
      </div>
    </section>
    </ConfigProvider>
  )
}
