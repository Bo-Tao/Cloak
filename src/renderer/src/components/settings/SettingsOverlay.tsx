import { useEffect } from 'react'
import { useSettingsStore } from '../../stores/settings-store'

interface Props {
  open: boolean
  onClose: () => void
}

export default function SettingsOverlay({ open, onClose }: Props) {
  const { theme, fontSize, autoAccept, setTheme, setFontSize, setAutoAccept } =
    useSettingsStore()

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-lg font-serif text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Appearance */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Appearance</h3>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">Theme</label>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                      theme === t
                        ? 'bg-white shadow-sm text-gray-800'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-600">
                Font Size: {fontSize}px
              </label>
              <input
                type="range"
                min={12}
                max={20}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-32 accent-terracotta"
              />
            </div>
          </section>

          {/* Claude Code */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Claude Code</h3>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-600">Binary Path</label>
                <p className="text-[10px] text-cloudy">
                  Leave empty to auto-detect from PATH
                </p>
              </div>
              <input
                type="text"
                placeholder="claude"
                className="w-40 px-3 py-1.5 text-xs rounded-md border border-border focus:outline-none focus:border-terracotta"
                defaultValue=""
                onBlur={(e) => {
                  window.electronAPI.config.set(
                    'claudeBinaryPath',
                    e.target.value,
                  )
                }}
              />
            </div>
          </section>

          {/* Auto-Accept */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Auto-Accept</h3>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm text-gray-600">
                  Auto-accept all tool operations
                </label>
                <p className="text-[10px] text-cloudy">
                  Claude will execute file edits, shell commands, etc. without
                  asking
                </p>
              </div>
              <button
                onClick={() => setAutoAccept(!autoAccept)}
                className={`w-10 h-5 rounded-full transition-colors relative ${
                  autoAccept ? 'bg-terracotta' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                    autoAccept ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">
              Keyboard Shortcuts
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Send message</span>
                <kbd className="px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                  Enter
                </kbd>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>New line</span>
                <kbd className="px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                  Shift+Enter
                </kbd>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Allow permission</span>
                <kbd className="px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                  Y
                </kbd>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Deny permission</span>
                <kbd className="px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                  N
                </kbd>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Settings</span>
                <kbd className="px-2 py-0.5 rounded bg-gray-100 text-gray-500">
                  Cmd+,
                </kbd>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
