import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import type { ProxyOptions } from 'vite'
import { normalizeDevProxyConfig, type DevProxyConfig } from './src/lib/devProxy'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

function loadDevProxyConfig() {
  try {
    return normalizeDevProxyConfig(
      JSON.parse(readFileSync('./dev-proxy.config.json', 'utf-8')) as unknown,
    )
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return null
    throw error
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function ensureLeadingSlash(pathname: string): string {
  return pathname.startsWith('/') ? pathname : `/${pathname}`
}

function joinProxyPath(basePath: string, pathname: string): string {
  const cleanBasePath = basePath.replace(/\/+$/, '')
  const cleanPathname = ensureLeadingSlash(pathname || '/')
  if (!cleanBasePath || cleanBasePath === '/') return cleanPathname
  if (cleanPathname === cleanBasePath || cleanPathname.startsWith(`${cleanBasePath}/`)) {
    return cleanPathname
  }
  return `${cleanBasePath}${cleanPathname}`
}

function createDevApiProxy(config: DevProxyConfig): ProxyOptions {
  const targetUrl = new URL(config.target)
  const targetBasePath = targetUrl.pathname.replace(/\/+$/, '')
  const prefixPattern = new RegExp(`^${escapeRegExp(config.prefix)}`)

  return {
    target: targetUrl.origin,
    changeOrigin: config.changeOrigin,
    secure: config.secure,
    rewrite: (pathname) => joinProxyPath(targetBasePath, pathname.replace(prefixPattern, '')),
  }
}

function resolveLocalBackendTarget(mode: string): string {
  const env = loadEnv(mode, process.cwd(), '')
  const explicitTarget = env.LOCAL_API_PROXY_TARGET || env.VITE_LOCAL_API_PROXY_TARGET
  if (explicitTarget) return explicitTarget

  const host = env.SERVER_HOST && env.SERVER_HOST !== '0.0.0.0'
    ? env.SERVER_HOST
    : '127.0.0.1'
  const port = env.SERVER_PORT || '8080'
  return `http://${host}:${port}`
}

export default defineConfig(({ command, mode }) => {
  const devProxyConfig = command === 'serve' ? loadDevProxyConfig() : null
  const localBackendTarget = command === 'serve' ? resolveLocalBackendTarget(mode) : null

  return {
    plugins: [react()],
    base: './',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __DEV_PROXY_CONFIG__: JSON.stringify(devProxyConfig),
    },
    server: {
      host: true,
      proxy:
        command === 'serve'
          ? {
              ...(devProxyConfig?.enabled
                ? { [devProxyConfig.prefix]: createDevApiProxy(devProxyConfig) }
                : {}),
              '^/api(?:/|$)': {
                target: localBackendTarget!,
                changeOrigin: true,
                secure: false,
              },
            }
          : undefined,
    },
  }
})
