import { useRef, useCallback, useState } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { useSessionStore } from '../../stores/session-store'
import { useSettingsStore } from '../../stores/settings-store'
import InputToolbar from './InputToolbar'
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
  const { autoAccept, setAutoAccept, confirmAutoAccept } = useSettingsStore()

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

  return (
    <div className="bg-pampas px-4 pb-4">
      {/* Auto-accept warning banner */}
      {autoAccept && (
        <div className="px-4 py-2 mb-2 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
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

      {/* Card container */}
      <div className="max-w-3xl mx-auto rounded-2xl border border-border bg-surface shadow-sm">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => {
            setText(e.target.value)
            adjustHeight()
          }}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          aria-label="Message input"
          className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-sm placeholder:text-text-secondary/60 focus:outline-none"
          rows={2}
          disabled={isStreaming || !!pendingPermission}
        />
        <InputToolbar
          isStreaming={isStreaming}
          canSend={!!text.trim() && !pendingPermission}
          onSend={handleSend}
          onStop={handleStop}
        />
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
