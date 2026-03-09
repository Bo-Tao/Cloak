import MessageList from './MessageList'
import InputArea from './InputArea'
import PermissionBar from './PermissionBar'

export default function ChatArea() {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Drag region for title bar */}
      <div className="h-12 shrink-0 drag-region" />

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
