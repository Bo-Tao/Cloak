import { useEffect } from 'react'
import { useSettingsStore } from '../../stores/settings-store'
import Sidebar from './Sidebar'
import ChatArea from '../chat/ChatArea'
import SettingsOverlay from '../settings/SettingsOverlay'

export default function MainLayout() {
  const { setSidebarCollapsed, settingsOpen, setSettingsOpen } = useSettingsStore()

  // Auto-collapse sidebar when window becomes narrow
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 900 && !useSettingsStore.getState().sidebarCollapsed) {
        setSidebarCollapsed(true)
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [setSidebarCollapsed])

  // Cmd+, to open settings, Cmd+B to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault()
        useSettingsStore.getState().toggleSettings()
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault()
        useSettingsStore.getState().toggleSidebar()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="flex h-screen bg-pampas">
      <Sidebar />
      <ChatArea />
      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
