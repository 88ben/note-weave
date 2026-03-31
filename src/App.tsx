import { useEffect } from 'react'
import { useAppStore } from './store/appStore'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { MainPanel } from './components/layout/MainPanel'
import { SettingsDialog } from './components/settings/SettingsDialog'

function useTheme() {
  const theme = useAppStore((s) => s.settings.theme)

  useEffect(() => {
    const root = document.documentElement

    function apply(dark: boolean) {
      root.classList.toggle('dark', dark)
    }

    if (theme === 'dark') {
      apply(true)
      return
    }
    if (theme === 'light') {
      apply(false)
      return
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    apply(mq.matches)
    const handler = (e: MediaQueryListEvent) => apply(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])
}

export default function App() {
  const { loadProjects, loadSettings } = useAppStore()

  useTheme()

  useEffect(() => {
    loadProjects()
    loadSettings()
  }, [loadProjects, loadSettings])

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <MainPanel />
      </div>
      <SettingsDialog />
    </div>
  )
}
