import { useEffect, useCallback } from 'react'
import { useChatStore } from '../../stores/chat-store'
import { useSessionStore } from '../../stores/session-store'
import type { RiskLevel } from '../../../../shared/types'

const RISK_STYLES: Record<RiskLevel, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-700',
}

export default function PermissionBar() {
  const { pendingPermission, setPendingPermission } = useChatStore()
  const { activeSessionId } = useSessionStore()

  const handleAllow = useCallback(() => {
    if (!pendingPermission) return
    window.electronAPI.claude.confirmPermission(pendingPermission.toolUseId, true)
    setPendingPermission(null)
  }, [pendingPermission, setPendingPermission])

  const handleDeny = useCallback(() => {
    if (!pendingPermission) return
    window.electronAPI.claude.confirmPermission(pendingPermission.toolUseId, false)
    setPendingPermission(null)
  }, [pendingPermission, setPendingPermission])

  // Keyboard shortcuts: Y to allow, N to deny
  useEffect(() => {
    if (!pendingPermission) return

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault()
        handleAllow()
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handleDeny()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pendingPermission, handleAllow, handleDeny])

  if (!pendingPermission) return null

  const { toolName, riskLevel, input } = pendingPermission
  const summary = input.file_path
    ? String(input.file_path)
    : input.command
      ? String(input.command).slice(0, 80)
      : ''

  return (
    <div className="border-t border-border bg-surface px-4 py-3 animate-in slide-in-from-bottom">
      <div className="max-w-3xl mx-auto flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-700">{toolName}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${RISK_STYLES[riskLevel]}`}
            >
              {riskLevel}
            </span>
          </div>
          {summary && (
            <p className="text-xs text-cloudy truncate mt-0.5">{summary}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDeny}
            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Deny <kbd className="ml-1 text-[10px] text-cloudy">N</kbd>
          </button>
          <button
            onClick={handleAllow}
            className="px-3 py-1.5 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Allow <kbd className="ml-1 text-[10px] text-green-200">Y</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
