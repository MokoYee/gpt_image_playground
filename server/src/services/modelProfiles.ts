import type { ModelProfile } from './settings.js'

export type RuntimeEnvironment = 'development' | 'production'

export function normalizeRuntimeEnvironment(nodeEnv: string): RuntimeEnvironment {
  return nodeEnv === 'production' ? 'production' : 'development'
}

export function isModelProfileAvailable(profile: ModelProfile, nodeEnv: string): boolean {
  const runtimeEnvironment = normalizeRuntimeEnvironment(nodeEnv)
  return profile.environment === 'all' || profile.environment === runtimeEnvironment
}
