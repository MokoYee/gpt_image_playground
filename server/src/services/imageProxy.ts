import { dataUrlFromBytes } from './imageStorage.js'
import type { ImageApiSettings } from './settings.js'

export interface TaskParams {
  size: string
  quality: 'auto' | 'low' | 'medium' | 'high'
  output_format: 'png' | 'jpeg' | 'webp'
  output_compression: number | null
  moderation: 'auto' | 'low'
  n: number
}

export interface ImageProxyRequest {
  prompt: string
  params: TaskParams
  inputImageDataUrls: string[]
  maskDataUrl?: string
}

export interface ImageProxyResult {
  images: string[]
  actualParams?: Partial<TaskParams>
  actualParamsList?: Array<Partial<TaskParams> | undefined>
  revisedPrompts?: Array<string | undefined>
  rawImageUrls?: string[]
}

const MIME_MAP: Record<TaskParams['output_format'], string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

function buildApiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as any
    return payload.error?.message || payload.detail || payload.message || `HTTP ${response.status}`
  } catch {
    return response.text().catch(() => `HTTP ${response.status}`)
  }
}

function normalizeBase64Image(value: string, fallbackMime: string): string {
  return value.startsWith('data:') ? value : `data:${fallbackMime};base64,${value}`
}

async function fetchImageAsDataUrl(url: string, fallbackMime: string, signal: AbortSignal): Promise<string> {
  if (url.startsWith('data:')) return url
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`图片下载失败：HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') || fallbackMime
  return dataUrlFromBytes(await response.arrayBuffer(), contentType)
}

function pickActualParams(source: any): Partial<TaskParams> {
  const actual: Partial<TaskParams> = {}
  if (typeof source?.size === 'string') actual.size = source.size
  if (['auto', 'low', 'medium', 'high'].includes(source?.quality)) actual.quality = source.quality
  if (['png', 'jpeg', 'webp'].includes(source?.output_format)) actual.output_format = source.output_format
  if (typeof source?.output_compression === 'number') actual.output_compression = source.output_compression
  if (['auto', 'low'].includes(source?.moderation)) actual.moderation = source.moderation
  if (typeof source?.n === 'number') actual.n = source.n
  return actual
}

async function parseImagesApiResponse(payload: any, mime: string, signal: AbortSignal): Promise<ImageProxyResult> {
  const data = Array.isArray(payload?.data) ? payload.data : []
  if (!data.length) throw new Error('接口没有返回图片数据')
  const images: string[] = []
  const revisedPrompts: Array<string | undefined> = []
  const rawImageUrls: string[] = []
  for (const item of data) {
    if (typeof item.b64_json === 'string') {
      images.push(normalizeBase64Image(item.b64_json, mime))
    } else if (typeof item.url === 'string') {
      if (/^https?:\/\//i.test(item.url)) rawImageUrls.push(item.url)
      images.push(await fetchImageAsDataUrl(item.url, mime, signal))
    }
    revisedPrompts.push(typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined)
  }
  if (!images.length) throw new Error('接口没有返回可识别的图片数据')
  const actualParams = pickActualParams(payload)
  return {
    images,
    actualParams,
    actualParamsList: images.map(() => actualParams),
    revisedPrompts,
    ...(rawImageUrls.length ? { rawImageUrls } : {}),
  }
}

async function parseResponsesApiResponse(payload: any, mime: string): Promise<ImageProxyResult> {
  const output = Array.isArray(payload?.output) ? payload.output : []
  const results = output.filter((item: any) => item?.type === 'image_generation_call' && typeof item.result === 'string' && item.result.trim())
  if (!results.length) throw new Error('接口未返回图片数据')
  const images = results.map((item: any) => normalizeBase64Image(item.result, mime))
  const actualParamsList = results.map((item: any) => pickActualParams(item))
  return {
    images,
    actualParams: actualParamsList[0],
    actualParamsList,
    revisedPrompts: results.map((item: any) => typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined),
  }
}

export async function callImageProvider(settings: ImageApiSettings, request: ImageProxyRequest): Promise<ImageProxyResult> {
  if (!settings.apiKey) throw new Error('管理员尚未配置上游 API Key')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), settings.timeoutSeconds * 1000)
  const mime = MIME_MAP[request.params.output_format] || 'image/png'
  try {
    if (settings.apiMode === 'responses') {
      const response = await fetch(buildApiUrl(settings.baseUrl, 'responses'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.model,
          input: request.inputImageDataUrls.length
            ? [{
                role: 'user',
                content: [
                  { type: 'input_text', text: `Use the following text as the complete prompt. Do not rewrite it:\n${request.prompt}` },
                  ...request.inputImageDataUrls.map((image_url) => ({ type: 'input_image', image_url })),
                ],
              }]
            : `Use the following text as the complete prompt. Do not rewrite it:\n${request.prompt}`,
          tools: [{
            type: 'image_generation',
            action: request.inputImageDataUrls.length ? 'edit' : 'generate',
            size: request.params.size,
            quality: request.params.quality,
            output_format: request.params.output_format,
            ...(request.maskDataUrl ? { input_image_mask: { image_url: request.maskDataUrl } } : {}),
          }],
        }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))
      return parseResponsesApiResponse(await response.json(), mime)
    }

    if (request.inputImageDataUrls.length) {
      const form = new FormData()
      form.append('model', settings.model)
      form.append('prompt', request.prompt)
      form.append('size', request.params.size)
      form.append('quality', request.params.quality)
      form.append('output_format', request.params.output_format)
      form.append('moderation', request.params.moderation)
      if (request.params.output_format !== 'png' && request.params.output_compression != null) {
        form.append('output_compression', String(request.params.output_compression))
      }
      if (request.params.n > 1) form.append('n', String(request.params.n))
      form.append('response_format', 'b64_json')
      for (let i = 0; i < request.inputImageDataUrls.length; i++) {
        const response = await fetch(request.inputImageDataUrls[i], { signal: controller.signal })
        const blob = await response.blob()
        form.append('image[]', blob, `input-${i + 1}.png`)
      }
      if (request.maskDataUrl) {
        const response = await fetch(request.maskDataUrl, { signal: controller.signal })
        form.append('mask', await response.blob(), 'mask.png')
      }
      const response = await fetch(buildApiUrl(settings.baseUrl, 'images/edits'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.apiKey}` },
        body: form,
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))
      return parseImagesApiResponse(await response.json(), mime, controller.signal)
    }

    const response = await fetch(buildApiUrl(settings.baseUrl, 'images/generations'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        prompt: request.prompt,
        size: request.params.size,
        quality: request.params.quality,
        output_format: request.params.output_format,
        moderation: request.params.moderation,
        ...(request.params.output_format !== 'png' && request.params.output_compression != null ? { output_compression: request.params.output_compression } : {}),
        ...(request.params.n > 1 ? { n: request.params.n } : {}),
        response_format: 'b64_json',
      }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(await getErrorMessage(response))
    return parseImagesApiResponse(await response.json(), mime, controller.signal)
  } finally {
    clearTimeout(timeout)
  }
}
