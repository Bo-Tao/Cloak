import { useRef, useCallback, useState } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { useSessionStore } from '../../stores/session-store'
import { useSettingsStore } from '../../stores/settings-store'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'

export default function InputArea() {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [text, setText] = useState('')
  const [showAutoAcceptDialog, setShowAutoAcceptDialog] = useState(false)
  const { isStreaming, pendingPermission } = useChatStore()
  const { activeSessionId } = useSessionStore()
  const { autoAccept, autoAcceptConfirmed, setAutoAccept, confirmAutoAccept } = useSettingsStore()

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 24
    const minHeight = lineHeight * 2
    const maxHeight = lineHeight * 10
    ta.style.height = `${Math.min(Math.max(ta.scrollHeight, minHeight), maxHeight)}px`
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming || pendingPermission) return

    const sessionId = activeSessionId || crypto.randomUUID()
    if (!activeSessionId) {
      useSessionStore.getState().setActive(sessionId)
    }

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
  }, [text, isStreaming, pendingPermission, activeSessionId])

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

  const handleAutoAcceptToggle = useCallback(() => {
    if (!autoAccept && !autoAcceptConfirmed) {
      setShowAutoAcceptDialog(true)
    } else {
      setAutoAccept(!autoAccept)
    }
  }, [autoAccept, autoAcceptConfirmed, setAutoAccept])

  return (
    <div className="border-t border-border bg-surface">
      {/* Auto-accept warning banner */}
      {autoAccept && (
        <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200 flex items-center justify-between">
          <p className="text-xs text-yellow-700">
            Auto-accept mode enabled — Claude will execute all operations automatically
          </p>
          <button
            onClick={() => setAutoAccept(false)}
            className="text-[10px] text-yellow-600 hover:text-yellow-800 underline"
          >
            Disable
          </button>
        </div>
      )}

      <div className="p-4">
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
            disabled={isStreaming || !!pendingPermission}
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
              disabled={!text.trim() || !!pendingPermission}
              className="shrink-0 px-4 py-3 rounded-lg bg-terracotta hover:bg-terracotta-dark text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          )}
        </div>
      </div>

      {/* First-time auto-accept confirmation dialog */}
      <AlertDialog open={showAutoAcceptDialog} onOpenChange={setShowAutoAcceptDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Auto-Accept Mode?</AlertDialogTitle>
            <AlertDialogDescription>
              When auto-accept is enabled, Claude will automatically execute all tool operations
              including file writes, shell commands, and other potentially destructive actions
              without asking for permission. Only enable this if you trust the current context.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                confirmAutoAccept()
                setAutoAccept(true)
              }}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              Enable Auto-Accept
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
