import { getActiveApiProfile, getCustomProviderDefinition } from './apiProfiles'
import { callOpenAICompatibleImageApi } from './openaiCompatibleImageApi'
import type { CallApiOptions, CallApiResult } from './imageApiShared'
import { getAuthToken } from './auth'

export type { CallApiOptions, CallApiResult } from './imageApiShared'
export { normalizeBaseUrl } from './devProxy'

export async function callImageApi(opts: CallApiOptions): Promise<CallApiResult> {
  if (getAuthToken()) {
    const response = await fetch('/api/images/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getAuthToken()}`,
      },
      body: JSON.stringify({
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
