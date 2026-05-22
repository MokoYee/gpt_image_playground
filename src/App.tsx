import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { initStore, resetAuthenticatedDraft, scopeTasksToAuthenticatedUser, syncServerHistory, useStore } from './store'
import { buildSettingsFromUrlParams, clearUrlSettingParams, hasUrlSettingParams } from './lib/urlSettings'
import { useDockerApiUrlMigrationNotice } from './hooks/useDockerApiUrlMigrationNotice'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import SettingsModal from './components/SettingsModal'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import MaskEditorModal from './components/MaskEditorModal'
import ImageContextMenu from './components/ImageContextMenu'
import SupportPromptModal from './components/SupportPromptModal'
import CreateShell from './components/CreateShell'
import type { CreateNavKey } from './components/CreateShell'
import AuthPage from './pages/AuthPage'
import ConsolePage from './pages/ConsolePage'
import AccountPage from './pages/AccountPage'
import CreatePage from './pages/CreatePage'
import FavoritePage from './pages/FavoritePage'
import HistoryPage from './pages/HistoryPage'
import { clearAuthSession, DEFAULT_APP_NAME, fetchCurrentUser, readAuthSession, readPublicSettings } from './lib/auth'
import type { AppUser } from './lib/auth'

const CREATE_NAV_PATHS: Record<CreateNavKey, string> = {
  create: '/create',
  favorite: '/favorites',
  history: '/history',
}

const LEGACY_HASH_PATHS: Record<string, string> = {
  account: '/account',
  console: '/console',
  create: '/create',
  favorite: '/favorites',
  favorites: '/favorites',
  history: '/history',
}

function getActiveCreateNavKey(pathname: string): CreateNavKey {
  if (pathname.startsWith('/favorites') || pathname.startsWith('/favorite')) return 'favorite'
  if (pathname.startsWith('/history')) return 'history'
  return 'create'
}

function CreateRouteFrame({
  appName,
  user,
  onLogout,
  children,
}: {
  appName: string
  user: AppUser
  onLogout: () => void
  children: ReactNode
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const activeNavKey = getActiveCreateNavKey(location.pathname)

  return (
    <>
      <CreateShell
        appName={appName}
        user={user}
        activeNavKey={activeNavKey}
        onNavigate={(key) => navigate(CREATE_NAV_PATHS[key])}
        onLogout={onLogout}
        onOpenConsole={user.role === 'admin' ? () => navigate('/console') : undefined}
        showSettings={activeNavKey === 'create'}
      >
        {children}
      </CreateShell>
      <DetailModal />
      <Lightbox />
      <SettingsModal />
      <ConfirmDialog />
      <SupportPromptModal />
      <Toast />
      <MaskEditorModal />
      <ImageContextMenu />
    </>
  )
}

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const setSettings = useStore((s) => s.setSettings)
  const [authSession, setAuthSession] = useState<AppUser | null>(() => readAuthSession()?.user ?? null)
  const [appName, setAppName] = useState(DEFAULT_APP_NAME)
  useDockerApiUrlMigrationNotice()

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const nextSettings = buildSettingsFromUrlParams(useStore.getState().settings, searchParams)

    setSettings(nextSettings)

    if (hasUrlSettingParams(searchParams)) {
      clearUrlSettingParams(searchParams)

      const nextSearch = searchParams.toString()
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`
      window.history.replaceState(null, '', nextUrl)
    }

    initStore()
  }, [setSettings])

  useEffect(() => {
    const legacyRoute = window.location.hash.replace(/^#\/?/, '')
    const nextPath = LEGACY_HASH_PATHS[legacyRoute]
    if (!nextPath) return
    window.history.replaceState(null, '', `${nextPath}${window.location.search}`)
    navigate({ pathname: nextPath, search: window.location.search }, { replace: true })
  }, [navigate])

  useEffect(() => {
    const preventPageImageDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('img')) {
        e.preventDefault()
      }
    }

    document.addEventListener('dragstart', preventPageImageDrag)
    return () => document.removeEventListener('dragstart', preventPageImageDrag)
  }, [])

  useEffect(() => {
    void fetchCurrentUser().then((user) => {
      setAuthSession(user)
      if (user) {
        scopeTasksToAuthenticatedUser(user.id)
        void syncServerHistory().catch((error) => {
          useStore.getState().showToast(error instanceof Error ? error.message : '历史记录同步失败', 'error')
        })
      }
    })
    void readPublicSettings().then((settings) => {
      setAppName(settings.site?.appName || DEFAULT_APP_NAME)
    }).catch(() => {
      setAppName(DEFAULT_APP_NAME)
    })
  }, [])

  useEffect(() => {
    document.title = appName.trim() || DEFAULT_APP_NAME
  }, [appName])

  const handleAuthenticated = (user: AppUser) => {
    setAuthSession(user)
    scopeTasksToAuthenticatedUser(user.id)
    resetAuthenticatedDraft()
    void syncServerHistory()
    navigate(location.pathname === '/' ? '/create' : location.pathname, { replace: true })
  }

  const handleLogout = () => {
    clearAuthSession()
    setAuthSession(null)
    navigate('/create', { replace: true })
  }

  const goCreate = () => navigate('/create')

  if (!authSession) {
    return (
      <>
        <AuthPage appName={appName} onAppNameChange={setAppName} onAuthenticated={handleAuthenticated} />
        <Toast />
      </>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/create" replace />} />
      <Route
        path="/create"
        element={(
          <CreateRouteFrame appName={appName} user={authSession} onLogout={handleLogout}>
            <CreatePage />
          </CreateRouteFrame>
        )}
      />
      <Route path="/favorite" element={<Navigate to="/favorites" replace />} />
      <Route
        path="/favorites"
        element={(
          <CreateRouteFrame appName={appName} user={authSession} onLogout={handleLogout}>
            <FavoritePage />
          </CreateRouteFrame>
        )}
      />
      <Route
        path="/history"
        element={(
          <CreateRouteFrame appName={appName} user={authSession} onLogout={handleLogout}>
            <HistoryPage onGoCreate={goCreate} />
          </CreateRouteFrame>
        )}
      />
      <Route
        path="/console"
        element={authSession.role === 'admin'
          ? <ConsolePage currentUser={authSession} appName={appName} onAppNameChange={setAppName} onLogout={handleLogout} onClose={() => navigate('/create', { replace: true })} />
          : <Navigate to="/create" replace />}
      />
      <Route
        path="/account"
        element={<AccountPage user={authSession} onClose={() => navigate('/create', { replace: true })} onUserChange={setAuthSession} />}
      />
      <Route path="*" element={<Navigate to="/create" replace />} />
    </Routes>
  )
}
