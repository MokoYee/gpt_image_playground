import { useEffect, useState } from 'react'
import { initStore } from './store'
import { useStore } from './store'
import { buildSettingsFromUrlParams, clearUrlSettingParams, hasUrlSettingParams } from './lib/urlSettings'
import { useDockerApiUrlMigrationNotice } from './hooks/useDockerApiUrlMigrationNotice'
import Header from './components/Header'
import SearchBar from './components/SearchBar'
import TaskGrid from './components/TaskGrid'
import InputBar from './components/InputBar'
import DetailModal from './components/DetailModal'
import Lightbox from './components/Lightbox'
import SettingsModal from './components/SettingsModal'
import ConfirmDialog from './components/ConfirmDialog'
import Toast from './components/Toast'
import MaskEditorModal from './components/MaskEditorModal'
import ImageContextMenu from './components/ImageContextMenu'
import SupportPromptModal from './components/SupportPromptModal'
import AuthPage from './components/AuthPage'
import ConsolePage from './components/ConsolePage'
import AccountPage from './components/AccountPage'
import { clearAuthSession, fetchCurrentUser, readAuthSession } from './lib/auth'
import type { AppUser } from './lib/auth'

type AppView = 'app' | 'console' | 'account'

function readRouteView(): AppView {
  const route = window.location.hash.replace(/^#\/?/, '')
  if (route === 'console' || route === 'account') return route
  return 'app'
}

export default function App() {
  const setSettings = useStore((s) => s.setSettings)
  const [authSession, setAuthSession] = useState<AppUser | null>(() => readAuthSession()?.user ?? null)
  const [view, setView] = useState<AppView>(() => readRouteView())
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
    const preventPageImageDrag = (e: DragEvent) => {
      if ((e.target as HTMLElement | null)?.closest('img')) {
        e.preventDefault()
      }
    }

    document.addEventListener('dragstart', preventPageImageDrag)
    return () => document.removeEventListener('dragstart', preventPageImageDrag)
  }, [])

  useEffect(() => {
    const syncRoute = () => setView(readRouteView())
    window.addEventListener('hashchange', syncRoute)
    window.addEventListener('popstate', syncRoute)
    return () => {
      window.removeEventListener('hashchange', syncRoute)
      window.removeEventListener('popstate', syncRoute)
    }
  }, [])

  useEffect(() => {
    void fetchCurrentUser().then((user) => setAuthSession(user))
  }, [])

  const navigateView = (nextView: AppView, replace = false) => {
    const nextHash = nextView === 'app' ? '' : `#/${nextView}`
    const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`
    if (replace) {
      window.history.replaceState(null, '', nextUrl)
    } else {
      window.history.pushState(null, '', nextUrl)
    }
    setView(nextView)
  }

  const handleAuthenticated = (user: AppUser) => {
    setAuthSession(user)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setView('app')
  }

  const handleLogout = () => {
    clearAuthSession()
    setAuthSession(null)
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
    setView('app')
  }

  if (!authSession) {
    return <AuthPage onAuthenticated={handleAuthenticated} />
  }

  if (view === 'console' && authSession.role === 'admin') {
    return <ConsolePage currentUser={authSession} onClose={() => navigateView('app', true)} />
  }

  if (view === 'account') {
    return <AccountPage user={authSession} onClose={() => navigateView('app', true)} onUserChange={handleAuthenticated} />
  }

  return (
    <>
      <Header
        user={authSession}
        onLogout={handleLogout}
        onOpenConsole={authSession.role === 'admin' ? () => navigateView('console') : undefined}
        onOpenAccount={() => navigateView('account')}
      />
      <main data-home-main data-drag-select-surface className="pb-48">
        <div className="safe-area-x max-w-7xl mx-auto">
          <SearchBar />
          <TaskGrid />
        </div>
      </main>
      <InputBar />
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
