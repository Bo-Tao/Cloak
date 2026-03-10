import { PanelLeftDashed } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ChatMessage, Project } from '../../../../shared/types'
import { useChatStore } from '../../stores/chat-store'
import { useProjectStore } from '../../stores/project-store'
import { useSessionStore } from '../../stores/session-store'
import { useSettingsStore } from '../../stores/settings-store'
import Tooltip from '../ui/tooltip'

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, sidebarWidth, setSidebarWidth } = useSettingsStore()
  const [isResizing, setIsResizing] = useState(false)
  const { sessions, activeSessionId, setSessions, setActive, removeSession } = useSessionStore()
  const { projects, activeProject, setProjects, setActive: setActiveProject } = useProjectStore()
  const { clearMessages } = useChatStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [showProjectMenu, setShowProjectMenu] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<{ version: string; downloaded: boolean } | null>(
    null,
  )

  // Listen for update events
  useEffect(() => {
    const cleanupAvailable = window.electronAPI.app.onUpdateAvailable(info => {
      setUpdateInfo({ version: info.version, downloaded: false })
    })
    const cleanupDownloaded = window.electronAPI.app.onUpdateDownloaded(info => {
      setUpdateInfo({ version: info.version, downloaded: true })
    })
    return () => {
      cleanupAvailable()
      cleanupDownloaded()
    }
  }, [])

  // Load projects on mount
  useEffect(() => {
    window.electronAPI.project.list().then(list => {
      setProjects(list as Project[])
      if (list.length > 0 && !activeProject) {
        setActiveProject(list[0] as Project)
      }
    })
  }, [])

  // Load sessions when active project changes
  useEffect(() => {
    if (!activeProject) return
    window.electronAPI.session.list(activeProject.path).then(list => {
      setSessions(list as typeof sessions)
    })
  }, [activeProject?.path])

  const handleSelectSession = useCallback(
    async (sessionId: string) => {
      setActive(sessionId)
      const messages = await window.electronAPI.session.load(sessionId)
      // Messages will be loaded into chat store via the load mechanism
      clearMessages()
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          useChatStore.getState().appendMessage(msg as ChatMessage)
        }
      }
    },
    [setActive, clearMessages],
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!confirm('Delete this session?')) return
      await window.electronAPI.session.delete(sessionId)
      removeSession(sessionId)
    },
    [removeSession],
  )

  const handleAddProject = useCallback(async () => {
    const path = await window.electronAPI.app.selectFolder()
    if (!path) return
    try {
      await window.electronAPI.project.add(path)
      const list = await window.electronAPI.project.list()
      setProjects(list as Project[])
      const added = (list as Project[]).find(p => p.path === path)
      if (added) setActiveProject(added)
    } catch {
      // Failed to add project
    }
  }, [setProjects, setActiveProject])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = sidebarWidth

      setIsResizing(true)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onMouseMove = (ev: MouseEvent) => {
        const newWidth = startWidth + (ev.clientX - startX)
        setSidebarWidth(newWidth)
      }

      const onMouseUp = () => {
        setIsResizing(false)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [sidebarWidth, setSidebarWidth],
  )

  const handleDoubleClick = useCallback(() => {
    setSidebarWidth(280)
  }, [setSidebarWidth])

  const filteredSessions = searchQuery
    ? sessions.filter(s => s.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : sessions

  return (
    <>
      {/* Drag region for title bar with toggle button as no-drag child */}
      <div className="h-12 fixed z-50 w-full shrink-0 drag-region flex items-center pl-24">
        <div className="no-drag mt-1.5">
          <Tooltip label="切换边栏" shortcut="⌘B">
            <button
              className="p-1.5 cursor-pointer text-text-secondary hover:text-text-primary transition-colors rounded-md hover:bg-black/5"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
            >
              <PanelLeftDashed
                size={16}
                className="transition-transform duration-300"
                style={{ transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>
          </Tooltip>
        </div>
      </div>
      <div
        className={`shrink-0 h-full overflow-hidden relative ${isResizing ? '' : 'transition-[width] duration-300'}`}
        style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
      >
        <aside
          className="flex flex-col bg-surface rounded-xl overflow-hidden pt-12"
          style={{
            width: sidebarWidth - 8,
            height: 'calc(100% - 16px)',
            margin: 8,
            marginRight: 0,
          }}
        >
          {/* Project selector */}
          <div className="px-3 pb-2 space-y-2">
            <div className="relative">
              <button
                onClick={() => setShowProjectMenu(!showProjectMenu)}
                className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-md border border-border text-gray-700 hover:bg-gray-50 transition-colors truncate"
              >
                <span className="truncate">{activeProject?.name || 'Select project'}</span>
                <span className="text-gray-400 ml-1">▼</span>
              </button>
              {showProjectMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
                  {projects.map(p => (
                    <button
                      key={p.path}
                      onClick={() => {
                        setActiveProject(p)
                        setShowProjectMenu(false)
                        window.electronAPI.config.set('lastProjectId', p.path)
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 truncate ${
                        activeProject?.path === p.path
                          ? 'bg-gray-50 text-terracotta'
                          : 'text-gray-700'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setShowProjectMenu(false)
                      handleAddProject()
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-cloudy hover:bg-gray-50 border-t border-gray-100"
                  >
                    + Add Project
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Session search */}
          {sessions.length > 5 && (
            <div className="px-3 pb-2">
              <input
                type="text"
                placeholder="Search sessions..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-border focus:outline-none focus:border-terracotta"
              />
            </div>
          )}

          {/* Session list */}
          <div className="flex-1 overflow-y-auto px-3">
            {filteredSessions.length === 0 ? (
              <p className="text-xs text-cloudy px-2 py-4">No sessions yet</p>
            ) : (
              <div className="space-y-0.5">
                {filteredSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    onContextMenu={e => {
                      e.preventDefault()
                      handleDeleteSession(session.id)
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors group ${
                      activeSessionId === session.id
                        ? 'bg-terracotta/10 text-terracotta'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="truncate font-medium text-xs">{session.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-cloudy">{session.messageCount} msgs</span>
                      {session.lastActive && (
                        <span className="text-[10px] text-cloudy">
                          {formatRelativeTime(session.lastActive)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom controls */}
          {updateInfo && (
            <div className="border-t border-border p-3 shrink-0">
              <button
                onClick={() => {
                  if (updateInfo.downloaded) {
                    window.electronAPI.app.installUpdate()
                  }
                }}
                className="w-full text-left px-2 py-1.5 text-[11px] rounded-md bg-terracotta/10 text-terracotta hover:bg-terracotta/20 transition-colors"
              >
                {updateInfo.downloaded
                  ? `v${updateInfo.version} ready — click to restart`
                  : `v${updateInfo.version} available — downloading...`}
              </button>
            </div>
          )}
        </aside>

        {/* Drag handle */}
        {!sidebarCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize group z-10 flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onDoubleClick={handleDoubleClick}
          >
            <div
              className={`w-0.5 h-full transition-colors ${isResizing ? 'bg-terracotta' : 'bg-transparent group-hover:bg-border'}`}
            />
          </div>
        )}
      </div>
    </>
  )
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(iso).toLocaleDateString()
  } catch {
    return ''
  }
}
