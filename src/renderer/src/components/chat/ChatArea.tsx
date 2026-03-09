import MessageList from './MessageList'
import InputArea from './InputArea'

export default function ChatArea() {
  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Drag region for title bar */}
      <div className="h-12 shrink-0 drag-region" />

      {/* Messages */}
      <div className="flex-1 overflow-hidden">
        <MessageList />
      </div>

      {/* Input */}
      <InputArea />
    </div>
  )
}
