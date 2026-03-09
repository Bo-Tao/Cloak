import { useRef, useCallback, useState } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { useSessionStore } from '../../stores/session-store'

export default function InputArea() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const { isStreaming } = useChatStore()
  const { activeSessionId } = useSessionStore()

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 24
    const minHeight = lineHeight * 2 // 2 rows
    const maxHeight = lineHeight * 10 // 10 rows
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, minHeight), maxHeight)}px`
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    const sessionId = activeSessionId || crypto.randomUUID()
    if (!activeSessionId) {
      useSessionStore.getState().setActive(sessionId)
    }

    // Add user message to chat store immediately
    useChatStore.getState().appendMessage({
      id: crypto.randomUUID(),
      role: 'user',
      timestamp: new Date().toISOString(),
      blocks: [{ type: 'text', content: trimmed }],
    })
    useChatStore.getState().setStreaming(true)

    window.electronAPI.claude.sendMessage(sessionId, trimmed)

    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, isStreaming, activeSessionId])

  const handleStop = useCallback(() => {
    if (activeSessionId) {
      window.electronAPI.claude.abort(activeSessionId)
    }
    useChatStore.getState().setStreaming(false)
  }, [activeSessionId])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            adjustHeight()
          }}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          className="flex-1 resize-none rounded-lg border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-terracotta transition-colors"
          rows={2}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button
            onClick={handleStop}
            className="shrink-0 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="shrink-0 px-4 py-3 rounded-lg bg-terracotta hover:bg-terracotta-dark text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        )}
      </div>
    </div>
  )
}
