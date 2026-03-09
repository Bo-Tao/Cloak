import { useRef } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { useChatStore } from '../../stores/chat-store'
import UserMessage from './UserMessage'
import AssistantMessage from './AssistantMessage'

export default function MessageList() {
  const { messages } = useChatStore()
  const virtuosoRef = useRef<VirtuosoHandle>(null)

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-serif text-gray-700">Start a conversation</h2>
          <p className="text-sm text-cloudy">Send a message to Claude Code</p>
        </div>
      </div>
    )
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={messages}
      followOutput="smooth"
      initialTopMostItemIndex={messages.length - 1}
      itemContent={(_, msg) => {
        if (msg.role === 'user') return <UserMessage message={msg} />
        return <AssistantMessage message={msg} />
      }}
      className="h-full"
    />
  )
}
