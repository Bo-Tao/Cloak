import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Folder,
  FolderOpen,
  FolderPlus,
  PanelLeftDashed,
  Pencil,
  Settings,
  SquarePen,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChatMessage, Project, SessionMeta } from '../../../../shared/types'
import { useChatStore } from '../../stores/chat-store'
import { useProjectStore } from '../../stores/project-store'
import { useSessionStore } from '../../stores/session-store'
import { useSettingsStore } from '../../stores/settings-store'
import Tooltip from '../ui/tooltip'

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '刚刚'
    if (mins < 60) return `${mins} 分钟`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours} 小时`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days} 天`
    const weeks = Math.floor(days / 7)
    if (weeks < 5) return `${weeks} 周`
    return new Date(iso).toLocaleDateString()
  } catch {
    return ''
  }
}

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
}: {
  session: SessionMeta
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
}) {
  return (
    <button
      onClick={onSelect}
      onContextMenu={(e) => {
        e.preventDefault()
        onDelete()
      }}
      className={`text-left w-[calc(100%-16px)] pl-8 pr-2 py-1.5 text-sm transition-colors flex items-center justify-between mx-2 rounded-lg ${
        isActive
          ? 'text-terracotta bg-black/5 dark:bg-white/5'
          : 'text-text-secondary hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      <span className="truncate text-xs min-w-0 flex-1">{session.title}</span>
      {session.lastActive && (
        <div className="text-[10px] w-10 text-cloudy shrink-0 ml-1 text-right">
          {formatRelativeTime(session.lastActive)}
        </div>
      )}
    </button>
  )
}

function ProjectItem({
  project,
  sessions,
  isCollapsed,
  onToggleCollapse,
  activeSessionId,
  onSelectSession,
  onDeleteSession,
}: {
  project: Project
  sessions: SessionMeta[]
  isCollapsed: boolean
  onToggleCollapse: () => void
  activeSessionId: string | null
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(project.name)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleRename = async () => {
    if (renameValue.trim() && renameValue !== project.name) {
      await window.electronAPI.project.rename(project.path, renameValue.trim())
      const list = await window.electronAPI.project.list()
      useProjectStore.getState().setProjects(list as Project[])
    }
    setIsRenaming(false)
  }

  const handleRemove = async () => {
    if (!confirm(`确认从列表移除项目 "${project.name}"？`)) return
    await window.electronAPI.project.remove(project.path)
    const list = await window.electronAPI.project.list()
    useProjectStore.getState().setProjects(list as Project[])
  }

  const handleOpenFolder = () => {
    window.electronAPI.app.openPath(project.path)
  }

  const handleNewSession = async () => {
    const sessionId = await window.electronAPI.session.create(project.path)
    useSessionStore.getState().setActive(sessionId)
    useChatStore.getState().clearMessages()
    const list = await window.electronAPI.session.list(project.path)
    useSessionStore.getState().setSessionsForProject(project.path, list as SessionMeta[])
  }

  const FolderIcon = isHovered
    ? (isCollapsed ? ChevronRight : ChevronDown)
    : (isCollapsed ? Folder : FolderOpen)

  return (
    <div className="relative">
      <div
        className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer select-none transition-colors mx-2 rounded-lg ${
          isHovered ? 'bg-black/5 dark:bg-white/5' : ''
        }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => { if (!menuOpen) setIsHovered(false) }}
        onClick={onToggleCollapse}
      >
        <FolderIcon size={16} className="shrink-0 text-text-secondary" />
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') setIsRenaming(false)
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm bg-transparent border-b border-terracotta outline-none min-w-0"
          />
        ) : (
          <span className="flex-1 text-sm truncate">{project.name}</span>
        )}
        {!isRenaming && (
          <div className={`flex items-center gap-0.5 shrink-0 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-secondary"
            >
              <Ellipsis size={14} />
            </button>
            <button
              onClick={handleNewSession}
              className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 text-text-secondary"
            >
              <SquarePen size={14} />
            </button>
          </div>
        )}
      </div>

      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute right-2 p-1 top-9 z-30 bg-pampas border border-border rounded-lg shadow-lg min-w-[140px]"
        >
          <button
            onClick={() => { handleOpenFolder(); setMenuOpen(false) }}
            className="w-full rounded-md flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
          >
            <FolderOpen size={14} /> 打开文件夹
          </button>
          <button
            onClick={() => { setIsRenaming(true); setRenameValue(project.name); setMenuOpen(false) }}
            className="w-full rounded-md flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Pencil size={14} /> 重命名
          </button>
          <button
            onClick={() => { handleRemove(); setMenuOpen(false) }}
            className="w-full rounded-md flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Trash2 size={14} /> 删除项目
          </button>
        </div>
      )}

      <div
        className="overflow-hidden transition-all duration-200"
        style={{
          maxHeight: isCollapsed ? 0 : `${Math.max(sessions.length, 1) * 40}px`,
          opacity: isCollapsed ? 0 : 1,
        }}
      >
        {sessions.length === 0 ? (
          <p className="text-xs text-cloudy pl-8 py-1">无线程</p>
        ) : (
          sessions.map((session) => (
            <SessionItem
              key={session.id}
              session={session}
              isActive={activeSessionId === session.id}
              onSelect={() => onSelectSession(session.id)}
              onDelete={() => onDeleteSession(session.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default function Sidebar() {
  const { sidebarCollapsed, toggleSidebar, sidebarWidth, setSidebarWidth, collapsedProjects, toggleProjectCollapsed, toggleSettings } = useSettingsStore()
  const [isResizing, setIsResizing] = useState(false)
  const { sessionsByProject, activeSessionId, setSessionsForProject, setActive, removeSession } = useSessionStore()
  const { projects, setProjects, setActive: setActiveProject } = useProjectStore()
  const { clearMessages } = useChatStore()
  const [updateInfo, setUpdateInfo] = useState<{ version: string; downloaded: boolean } | null>(null)

  // Listen for update events
  useEffect(() => {
    const cleanupAvailable = window.electronAPI.app.onUpdateAvailable((info) => {
      setUpdateInfo({ version: info.version, downloaded: false })
    })
    const cleanupDownloaded = window.electronAPI.app.onUpdateDownloaded((info) => {
      setUpdateInfo({ version: info.version, downloaded: true })
    })
    return () => {
      cleanupAvailable()
      cleanupDownloaded()
    }
  }, [])

  // Load projects on mount
  useEffect(() => {
    window.electronAPI.project.list().then((list) => {
      const projectList = list as Project[]
      setProjects(projectList)
      if (projectList.length > 0) {
        setActiveProject(projectList[0])
      }
    })
  }, [])

  // Load sessions for all projects
  useEffect(() => {
    for (const project of projects) {
      window.electronAPI.session.list(project.path).then((list) => {
        setSessionsForProject(project.path, list as SessionMeta[])
      })
    }
  }, [projects])

  const handleAddProject = useCallback(async () => {
    const path = await window.electronAPI.app.selectFolder()
    if (!path) return
    try {
      await window.electronAPI.project.add(path)
      const list = await window.electronAPI.project.list()
      setProjects(list as Project[])
    } catch {
      // Failed to add project
    }
  }, [setProjects])

  const handleSelectSession = useCallback(
    async (sessionId: string, projectPath: string) => {
      const targetProject = projects.find((p) => p.path === projectPath)
      if (targetProject) {
        setActiveProject(targetProject)
      }
      setActive(sessionId)
      clearMessages()
      const messages = await window.electronAPI.session.load(sessionId, projectPath)
      if (Array.isArray(messages)) {
        for (const msg of messages) {
          useChatStore.getState().appendMessage(msg as ChatMessage)
        }
      }
    },
    [projects, setActiveProject, setActive, clearMessages],
  )

  const handleDeleteSession = useCallback(
    async (sessionId: string) => {
      if (!confirm('确认删除此会话？')) return
      await window.electronAPI.session.delete(sessionId)
      removeSession(sessionId)
    },
    [removeSession],
  )

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

  return (
    <>
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
          className="flex flex-col m-2 bg-pampas border border-[#F0EEE6] rounded-xl overflow-hidden pt-8 shadow-sm"
          style={{
            height: 'calc(100% - 16px)',
          }}
        >
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-sm font-medium text-text-secondary">项目</span>
            <button
              onClick={handleAddProject}
              className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-black/5 transition-colors"
            >
              <FolderPlus size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {projects.map(project => (
              <ProjectItem
                key={project.path}
                project={project}
                sessions={sessionsByProject[project.path] || []}
                isCollapsed={!!collapsedProjects[project.path]}
                onToggleCollapse={() => toggleProjectCollapsed(project.path)}
                activeSessionId={activeSessionId}
                onSelectSession={id => handleSelectSession(id, project.path)}
                onDeleteSession={handleDeleteSession}
              />
            ))}
          </div>

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

          <div className="border-t border-border px-3 py-2 shrink-0">
            <button
              onClick={toggleSettings}
              className="flex items-center gap-2 w-full px-2 py-2 rounded-md text-sm text-text-secondary hover:bg-black/5 hover:text-text-primary transition-colors"
            >
              <Settings size={16} />
              <span>设置</span>
            </button>
          </div>
        </aside>

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
