import { PanelRightDashed } from 'lucide-react'
import { useSettingsStore } from '../../stores/settings-store'
import MessageList from './MessageList'
import InputArea from './InputArea'
import PermissionBar from './PermissionBar'

export default function ChatArea() {
  const { sidebarCollapsed, toggleSidebar } = useSettingsStore()

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Drag region for title bar */}
      <div className="h-12 shrink-0 drag-region">
        {sidebarCollapsed && (
          <button
            className="fixed top-[14px] left-[104px] no-drag p-1.5 text-text-secondary hover:text-text-primary transition-colors rounded-md hover:bg-black/5"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
          >
            <PanelRightDashed size={16} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList />
      </div>

      {/* Permission bar (appears when tool needs approval) */}
      <PermissionBar />

      {/* Input */}
      <InputArea />
    </div>
  )
}
