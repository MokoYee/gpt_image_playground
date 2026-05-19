import { useEffect, useMemo, useState } from 'react'
import { cancelQueuedTask, useStore } from '../store'
import { readActiveImageTasks } from '../lib/api'
import { readAuthSession } from '../lib/auth'

export default function QueueButton() {
  const tasks = useStore((state) => state.tasks)
  const [open, setOpen] = useState(false)
  const [serverCount, setServerCount] = useState(0)
  const activeTasks = useMemo(
    () => tasks.filter((task) => task.status === 'queued' || task.status === 'running').sort((a, b) => a.createdAt - b.createdAt),
    [tasks],
  )
  const count = Math.max(serverCount, activeTasks.filter((task) => task.status === 'queued').length)

  useEffect(() => {
    if (!readAuthSession()) return
    let cancelled = false
    let timer: number | null = null
    const load = async () => {
      let nextDelay = document.hidden ? 15000 : 6000
      try {
        const result = await readActiveImageTasks()
        if (!cancelled) setServerCount(result.queue.queued)
        nextDelay = document.hidden ? 15000 : result.items.some((item) => item.status === 'running') ? 3000 : 6000
      } catch {
        if (!cancelled) setServerCount(0)
        nextDelay = document.hidden ? 20000 : 10000
      } finally {
        if (!cancelled) timer = window.setTimeout(load, nextDelay)
      }
    }
    void load()
    return () => {
      cancelled = true
      if (timer != null) window.clearTimeout(timer)
    }
  }, [])

  if (!readAuthSession()) return null

  return (
    <div className="relative z-20">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-white/[0.08] dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-white/[0.06]"
        title="任务队列"
      >
        <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h12M4 17h8" />
        </svg>
        队列 {count}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-white/[0.08] dark:bg-gray-900">
          <div className="border-b border-gray-100 px-3 py-2 text-sm font-semibold dark:border-white/[0.06]">任务队列</div>
          <div className="max-h-80 overflow-auto p-2">
            {activeTasks.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-gray-500">暂无排队任务</div>
            ) : activeTasks.map((task) => (
              <div key={task.id} className="rounded-lg px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-white/[0.04]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-800 dark:text-gray-100">{task.status === 'queued' ? '排队中' : '生成中'}</span>
                  {task.status === 'queued' && task.serverTaskId && (
                    <button onClick={() => cancelQueuedTask(task)} className="text-xs font-medium text-red-500 hover:text-red-600">取消</button>
                  )}
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-gray-500">{task.prompt}</div>
                {task.status === 'queued' && task.queuePosition ? <div className="mt-1 text-xs text-gray-400">第 {task.queuePosition} 位</div> : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
