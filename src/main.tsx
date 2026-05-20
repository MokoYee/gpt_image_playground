import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { applyThemePreference } from './lib/theme'
import { installMobileViewportGuards } from './lib/viewport'

installMobileViewportGuards()
applyThemePreference()

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister())
  })
}

if ('caches' in window) {
  window.caches.keys().then((keys) => {
    keys
      .filter((key) => key.startsWith('gpt-image-playground-') || key.startsWith('hua-image-playground-'))
      .forEach((key) => window.caches.delete(key))
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
