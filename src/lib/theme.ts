export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'gpt-image-playground.theme'
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark'

const DARK_THEME_QUERY = '(prefers-color-scheme: dark)'

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark'
}

export function readThemePreference(): ThemePreference {
  try {
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(saved) ? saved : DEFAULT_THEME_PREFERENCE
  } catch {
    return DEFAULT_THEME_PREFERENCE
  }
}

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_THEME_QUERY).matches ? 'dark' : 'light'
}

export function resolveThemePreference(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference
}

export function applyThemePreference(preference = readThemePreference()): ResolvedTheme {
  const resolvedTheme = resolveThemePreference(preference)
  const root = document.documentElement

  root.classList.toggle('dark', resolvedTheme === 'dark')
  root.dataset.themePreference = preference
  root.dataset.theme = resolvedTheme
  root.style.colorScheme = resolvedTheme

  return resolvedTheme
}

export function writeThemePreference(preference: ThemePreference): ResolvedTheme {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Ignore storage failures; the UI can still apply the preference for this session.
  }

  return applyThemePreference(preference)
}

export function subscribeSystemThemeChange(onChange: (resolvedTheme: ResolvedTheme) => void) {
  const mediaQuery = window.matchMedia(DARK_THEME_QUERY)
  const handleChange = () => {
    if (readThemePreference() !== 'system') return
    onChange(applyThemePreference('system'))
  }

  mediaQuery.addEventListener('change', handleChange)
  return () => mediaQuery.removeEventListener('change', handleChange)
}
