import { useEffect } from 'react'
import { useSettingsStore } from '../../stores/settings-store'
import Sidebar from './Sidebar'
import ChatArea from '../chat/ChatArea'

export default function MainLayout() {
  const { sidebarCollapsed, setSidebarCollapsed, toggleSidebar } = useSettingsStore()

  // Auto-collapse sidebar when window is narrow
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 900 && !sidebarCollapsed) {
        setSidebarCollapsed(true)
      }
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [sidebarCollapsed, setSidebarCollapsed])

  return (
    <div className="flex h-screen bg-pampas">
      <Sidebar />
      {/* Expand button when sidebar is collapsed */}
      {sidebarCollapsed && (
        <button
          className="fixed top-3 left-3 z-10 p-1.5 rounded-md bg-white/80 hover:bg-white border border-gray-200 text-gray-500 text-xs transition-colors no-drag"
          onClick={toggleSidebar}
          aria-label="Expand sidebar"
        >
          ☰
        </button>
      )}
      <ChatArea />
    </div>
  )
}
