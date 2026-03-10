import InputArea from './InputArea'
import MessageList from './MessageList'
import PermissionBar from './PermissionBar'

export default function ChatArea() {
  return (
    <div className="flex flex-col flex-1 min-w-0 pt-12">
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
