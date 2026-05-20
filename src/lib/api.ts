import { getActiveApiProfile, getCustomProviderDefinition } from './apiProfiles'
import { callOpenAICompatibleImageApi } from './openaiCompatibleImageApi'
import type { CallApiOptions, CallApiResult } from './imageApiShared'
import { getAuthToken } from './auth'
import type { TaskParams } from '../types'

export type { CallApiOptions, CallApiResult } from './imageApiShared'
export { normalizeBaseUrl } from './devProxy'

export interface ServerImageFile {
  id: string
  mimeType?: string
  width?: number | null
  height?: number | null
  source?: string
}

export interface ServerImageTask {
  id: string
  localTaskId?: string
  userId: string
  username?: string
  prompt: string
  params: TaskParams
  apiProvider?: string
  apiModel?: string
  status: 'queued' | 'running' | 'done' | 'error' | 'cancelled'
  error?: string | null
  elapsed?: number | null
  createdAt: number
  queuedAt?: number | null
  startedAt?: number | null
  finishedAt?: number | null
  queuePosition?: number | null
  creditsEstimated?: number | null
  creditsReserved?: number | null
  creditsCharged?: number | null
  imageCount?: number | null
  rawImageUrls?: string[]
  actualParams?: Partial<TaskParams>
  actualParamsByImage?: Record<string, Partial<TaskParams>>
  revisedPromptByImage?: Record<string, string>
  isFavorite?: boolean
  outputImages: ServerImageFile[]
}

async function authedJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken()
  const hasBody = init.body !== undefined && init.body !== null
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(hasBody && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })
  if (!response.ok) {
    let message = `HTTP ${response.status}`
    try {
      const payload = await response.json()
      message = payload.error?.message ?? payload.message ?? message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return response.json() as Promise<T>
}

export function getProtectedImageUrl(fileId: string): string {
  return `/api/images/files/${fileId}`
}

export async function fetchProtectedImageDataUrl(fileId: string): Promise<string> {
  const token = getAuthToken()
  const response = await fetch(getProtectedImageUrl(fileId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new Error(`图片读取失败：HTTP ${response.status}`)
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

export async function createProtectedImageLink(fileId: string): Promise<string> {
  const result = await authedJson<{ url: string }>(`/api/images/files/${fileId}/link`)
  return `${window.location.origin}${result.url}`
}

export async function createImageTask(opts: CallApiOptions & { localTaskId: string }) {
  const profile = getActiveApiProfile(opts.settings)
  return authedJson<{ taskId: string; status: ServerImageTask['status']; queue: { queued: number; running: number } }>('/api/images/tasks', {
    method: 'POST',
    body: JSON.stringify({
      localTaskId: opts.localTaskId,
      model: profile.model,
      prompt: opts.prompt,
      params: opts.params,
      inputImageDataUrls: opts.inputImageDataUrls,
      maskDataUrl: opts.maskDataUrl,
    }),
  })
}

export async function readImageTask(taskId: string): Promise<ServerImageTask> {
  const result = await authedJson<{ task: ServerImageTask }>(`/api/images/tasks/${taskId}`)
  return result.task
}

export async function readMyImageTasks(): Promise<ServerImageTask[]> {
  const result = await authedJson<{ items: ServerImageTask[] }>('/api/me/image-tasks?pageSize=100')
  return result.items
}

export async function readActiveImageTasks(): Promise<{ items: ServerImageTask[]; queue: { queued: number; running: number } }> {
  return authedJson('/api/me/image-tasks/active')
}

export async function cancelImageTask(taskId: string): Promise<void> {
  await authedJson(`/api/images/tasks/${taskId}/cancel`, { method: 'POST' })
}

export async function favoriteImageTask(taskId: string, favorite: boolean): Promise<void> {
  await authedJson(`/api/images/tasks/${taskId}/favorite`, {
    method: 'PATCH',
    body: JSON.stringify({ favorite }),
  })
}

export async function deleteImageTask(taskId: string): Promise<void> {
  await authedJson(`/api/images/tasks/${taskId}`, { method: 'DELETE' })
}

export async function readAdminImageTasks(params: URLSearchParams = new URLSearchParams()): Promise<ServerImageTask[]> {
  if (!params.has('pageSize')) params.set('pageSize', '100')
  const result = await authedJson<{ items: ServerImageTask[] }>(`/api/admin/image-tasks?${params.toString()}`)
  return result.items
}

export async function callImageApi(opts: CallApiOptions): Promise<CallApiResult> {
  if (getAuthToken()) {
    const profile = getActiveApiProfile(opts.settings)
    const response = await fetch('/api/images/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
        model: profile.model,
        prompt: opts.prompt,
        params: opts.params,
        inputImageDataUrls: opts.inputImageDataUrls,
        maskDataUrl: opts.maskDataUrl,
      }),
    })
    if (!response.ok) {
      let message = `HTTP ${response.status}`
      try {
        const payload = await response.json()
        message = payload.error?.message ?? payload.message ?? message
      } catch {
        /* ignore */
      }
      throw new Error(message)
    }
    return await response.json() as CallApiResult
  }

  const profile = getActiveApiProfile(opts.settings)
  return callOpenAICompatibleImageApi(opts, profile, getCustomProviderDefinition(opts.settings, profile.provider))
}
