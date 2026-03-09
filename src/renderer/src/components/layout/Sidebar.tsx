import { useSettingsStore } from '../../stores/settings-store'

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useSettingsStore()

  return (
    <aside
      className="flex flex-col border-r border-gray-200 bg-white transition-[width] duration-200 overflow-hidden shrink-0"
      style={{ width: sidebarCollapsed ? 0 : 240 }}
    >
      {/* Drag region for title bar */}
      <div className="h-12 flex items-center px-4 shrink-0 drag-region">
        <span className="font-serif text-lg text-gray-800 no-drag">Cloak</span>
      </div>

      {/* New session button */}
      <div className="px-3 pb-2">
        <button
          className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          onClick={() => {
            // Will be wired in M4
          }}
        >
          + New Session
        </button>
      </div>

      {/* Session list placeholder */}
      <div className="flex-1 overflow-y-auto px-3">
        <p className="text-xs text-cloudy px-2 py-4">No sessions yet</p>
      </div>

      {/* Bottom controls */}
      <div className="border-t border-gray-200 p-3 shrink-0">
        <button
          className="text-xs text-cloudy hover:text-gray-600 transition-colors"
          onClick={toggleSidebar}
        >
          Collapse
        </button>
      </div>
    </aside>
  )
}
