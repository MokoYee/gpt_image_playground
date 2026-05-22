import { useEffect, useMemo, useState } from 'react'
import Masonry from 'react-masonry-css'
import type { TaskRecord } from '../types'
import {
  ensureImageThumbnailCached,
  isTaskVisibleToCurrentUser,
  removeTask,
  subscribeImageThumbnail,
  syncServerTaskList,
  toggleTaskFavorite,
  useStore,
} from '../store'

interface FavoriteImageItem {
  task: TaskRecord
  imageId: string
  imageIndex: number
}

interface FavoriteThumbnailState {
  dataUrl: string
  width?: number
  height?: number
}

const FAVORITE_MASONRY_BREAKPOINTS = {
  default: 4,
  1600: 3,
  1080: 2,
  620: 1,
}

function getAspectRatioFromSize(size?: string) {
  const match = size?.match(/^(\d+)\s*x\s*(\d+)$/i)
  if (!match) return '1 / 1'
  const width = Number(match[1])
  const height = Number(match[2])
  if (!width || !height) return '1 / 1'
  return `${width} / ${height}`
}

function EmptyFavoriteState() {
  return (
    <div className="favorite-empty-state">
      <div className="favorite-empty-visual" aria-hidden="true">
        <svg viewBox="0 0 120 120" fill="none">
          <rect x="26" y="30" width="68" height="60" rx="14" />
          <path d="M40 71.5 52.6 59 64 70.4l6.8-6.8L82 74.8" />
          <circle cx="74" cy="48" r="6" />
          <path d="M42 22h36" />
          <path d="M34 38h52" />
        </svg>
      </div>
      <strong>暂无收藏图片</strong>
    </div>
  )
}

function FavoriteImageTile({ item }: { item: FavoriteImageItem }) {
  const [thumb, setThumb] = useState<FavoriteThumbnailState | null>(null)
  const setDetailTaskId = useStore((state) => state.setDetailTaskId)
  const setConfirmDialog = useStore((state) => state.setConfirmDialog)
  const imageCount = item.task.outputImages?.length ?? 0
  const aspectRatio = thumb?.width && thumb.height ? `${thumb.width} / ${thumb.height}` : getAspectRatioFromSize(item.task.params.size)
  const openDetail = () => setDetailTaskId(item.task.id)

  useEffect(() => {
    let cancelled = false
    setThumb(null)
    const applyThumbnail = (thumbnail: FavoriteThumbnailState) => {
      if (!cancelled) setThumb(thumbnail)
    }
    const unsubscribe = subscribeImageThumbnail(item.imageId, applyThumbnail)
    ensureImageThumbnailCached(item.imageId)
      .then((thumbnail) => {
        if (thumbnail) applyThumbnail(thumbnail)
      })
      .catch(() => {
        if (!cancelled) setThumb(null)
      })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [item.imageId])

  const handleDelete = () => {
    setConfirmDialog({
      title: '删除记录',
      message: '确定要删除这条收藏记录吗？关联的图片资源也会被清理（如果没有其他任务引用）。',
      action: () => removeTask(item.task),
    })
  }

  return (
    <article className="favorite-image-tile">
      <div className="favorite-image-media" style={{ aspectRatio }}>
        <button type="button" className="favorite-image-button" onClick={openDetail} aria-label="查看详情" title="查看详情">
          {thumb?.dataUrl ? (
            <img className="saveable-image" src={thumb.dataUrl} alt="" loading="lazy" />
          ) : (
            <span className="favorite-image-placeholder" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.6-4.6a2 2 0 0 1 2.8 0L16 16m-2-2 1.6-1.6a2 2 0 0 1 2.8 0L20 14" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                <circle cx="15.5" cy="8.5" r="1.5" />
              </svg>
            </span>
          )}
        </button>
        {imageCount > 1 && <span className="favorite-image-count">{item.imageIndex + 1}/{imageCount}</span>}
      </div>
      <div className="favorite-image-actions" data-no-drag-select onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={openDetail} title="详情" aria-label="详情">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h9" />
          </svg>
          <span>查看详情</span>
        </button>
        <button type="button" onClick={() => void toggleTaskFavorite(item.task)} title="取消收藏" aria-label="取消收藏" className="is-active">
          <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3Z" />
          </svg>
          <span>取消收藏</span>
        </button>
        <button type="button" onClick={handleDelete} title="删除记录" aria-label="删除记录" className="is-danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M8 6V4h8v2m-10 0 1 15h10l1-15M10 11v6m4-6v6" />
          </svg>
          <span>删除记录</span>
        </button>
      </div>
    </article>
  )
}

export default function FavoritePage() {
  const tasks = useStore((state) => state.tasks)
  const showToast = useStore((state) => state.showToast)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    void syncServerTaskList({ favorite: true, pageSize: 100 }).catch((error) => {
      showToast(error instanceof Error ? error.message : '收藏列表同步失败', 'error')
    })
  }, [showToast])

  const favoriteImages = useMemo(() => {
    return tasks
      .filter((task) => isTaskVisibleToCurrentUser(task) && task.isFavorite && task.status === 'done' && task.outputImages.length > 0)
      .sort((a, b) => b.createdAt - a.createdAt)
      .flatMap((task) => task.outputImages.map((imageId, imageIndex) => ({ task, imageId, imageIndex })))
  }, [tasks])

  const handleRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await syncServerTaskList({ favorite: true, pageSize: 100 })
      showToast('收藏列表已刷新', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : '收藏列表刷新失败', 'error')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <section className="favorite-page-panel">
      <div className="create-section-header" data-no-drag-select>
        <h2>收藏</h2>
        <div className="create-section-tools">
          <button
            type="button"
            className={refreshing ? 'is-refreshing' : ''}
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            aria-label="刷新收藏"
            title="刷新收藏"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 12a9 9 0 0 1-15.5 6.2" />
              <path d="M3 12A9 9 0 0 1 18.5 5.8" />
              <path d="M18 2v4h4" />
              <path d="M6 22v-4H2" />
            </svg>
          </button>
        </div>
      </div>
      {favoriteImages.length ? (
        <Masonry
          breakpointCols={FAVORITE_MASONRY_BREAKPOINTS}
          className="favorite-gallery-grid favorite-masonry-grid"
          columnClassName="favorite-masonry-column"
        >
          {favoriteImages.map((item) => (
            <FavoriteImageTile key={`${item.task.id}:${item.imageId}:${item.imageIndex}`} item={item} />
          ))}
        </Masonry>
      ) : (
        <EmptyFavoriteState />
      )}
    </section>
  )
}
