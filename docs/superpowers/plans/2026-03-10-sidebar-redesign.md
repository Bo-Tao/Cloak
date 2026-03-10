# Sidebar Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the sidebar from a single-project dropdown + flat session list into a multi-project tree with collapsible sessions per project.

**Architecture:** Rewrite `Sidebar.tsx` in place, extracting `ProjectItem` and `SessionItem` as inline sub-components. Add `collapsedProjects` to settings store. Add missing IPC APIs for project remove/rename and shell.openPath. Lift settings overlay trigger to settings store.

**Tech Stack:** React 19, TypeScript, Zustand, Tailwind CSS, lucide-react, Electron IPC

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/renderer/src/stores/settings-store.ts` | Modify | Add `collapsedProjects`, `settingsOpen` |
| `src/renderer/src/stores/session-store.ts` | Modify | Change to per-project session map |
| `src/renderer/src/components/layout/MainLayout.tsx` | Modify | Use settings store for settingsOpen |
| `src/renderer/src/components/layout/Sidebar.tsx` | Rewrite | New tree structure with ProjectItem/SessionItem |
| `src/renderer/src/components/chat/InputArea.tsx` | Modify | Update session store usage |
| `src/renderer/src/__tests__/stores.test.ts` | Modify | Update session store tests |
| `src/shared/types.ts` | Modify | Add IPC channel names |
| `src/renderer/src/types/electron.d.ts` | Modify | Add project.remove/rename, app.openPath |
| `src/preload/index.ts` | Modify | Add preload bridges |
| `src/main/ipc/handlers.ts` | Modify | Add project remove/rename/shell handlers |

---

## Chunk 1: Store & API Foundation

### Task 1: Add collapsedProjects to settings store

**Files:**
- Modify: `src/renderer/src/stores/settings-store.ts`

- [ ] **Step 1: Add collapsedProjects state and actions**

Add to `SettingsState` interface:
```typescript
collapsedProjects: Record<string, boolean>
toggleProjectCollapsed: (projectPath: string) => void
```

Add to store initial state:
```typescript
collapsedProjects: {},
```

Add action:
```typescript
toggleProjectCollapsed: (projectPath) =>
  set((state) => {
    const collapsed = { ...state.collapsedProjects }
    collapsed[projectPath] = !collapsed[projectPath]
    window.electronAPI.config.set('collapsedProjects', collapsed)
    return { collapsedProjects: collapsed }
  }),
```

- [ ] **Step 2: Hydrate collapsedProjects from config on init**

Add a hydration effect. In the store file, after store creation, add an IIFE or call `window.electronAPI.config.get('collapsedProjects')` to load persisted state. Pattern to follow (same as how `sidebarWidth` is likely loaded):

```typescript
// At the bottom of the file, hydrate persisted values
window.electronAPI.config.get('collapsedProjects').then((val) => {
  if (val && typeof val === 'object') {
    useSettingsStore.setState({ collapsedProjects: val as Record<string, boolean> })
  }
})
```

Check if there's an existing hydration pattern in the codebase and follow it.

- [ ] **Step 3: Verify store compiles**

Run: `cd /Users/botao/SP/Cloak && pnpm build`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/stores/settings-store.ts
git commit -m "feat(store): add collapsedProjects to settings store"
```

### Task 2: Lift settingsOpen state to settings store

Currently `settingsOpen` lives as local state in `MainLayout.tsx`. The new sidebar footer "设置" button needs to toggle it. Lift to Zustand.

**Files:**
- Modify: `src/renderer/src/stores/settings-store.ts`
- Modify: `src/renderer/src/components/layout/MainLayout.tsx`

- [ ] **Step 1: Add settingsOpen to settings store**

Add to `SettingsState` interface:
```typescript
settingsOpen: boolean
toggleSettings: () => void
setSettingsOpen: (open: boolean) => void
```

Add to store:
```typescript
settingsOpen: false,
toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
setSettingsOpen: (open) => set({ settingsOpen: open }),
```

- [ ] **Step 2: Update MainLayout to use store**

In `MainLayout.tsx`:
- Remove `const [settingsOpen, setSettingsOpen] = useState(false)`
- Replace with `const { settingsOpen, setSettingsOpen, toggleSettings } = useSettingsStore()`
- Update Cmd+, handler to call `useSettingsStore.getState().toggleSettings()`
- Keep `<SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />`
- Remove `useState` import if no longer needed

- [ ] **Step 3: Verify it compiles and settings still open/close**

Run: `pnpm build`

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/stores/settings-store.ts src/renderer/src/components/layout/MainLayout.tsx
git commit -m "refactor: lift settingsOpen state to settings store"
```

### Task 3: Add missing IPC APIs (project remove/rename, shell open)

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/src/types/electron.d.ts`
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc/handlers.ts`

- [ ] **Step 1: Add IPC channel names to shared types**

In `src/shared/types.ts`, add to the `IPC` object:
```typescript
PROJECT_REMOVE: 'project:remove',
PROJECT_RENAME: 'project:rename',
SHELL_OPEN_PATH: 'shell:open-path',
```

- [ ] **Step 2: Add type declarations**

In `src/renderer/src/types/electron.d.ts`, extend the `project` section:
```typescript
project: {
  list: () => Promise<unknown[]>
  add: (path: string) => Promise<void>
  remove: (path: string) => Promise<void>
  rename: (path: string, newName: string) => Promise<void>
  getClaudeMd: (path: string) => Promise<string | null>
}
```

Add to `app` section:
```typescript
openPath: (path: string) => Promise<void>
```

- [ ] **Step 3: Add preload bridge**

In `src/preload/index.ts`, add the corresponding `ipcRenderer.invoke` calls for:
- `project.remove` → invokes `'project:remove'` with path arg
- `project.rename` → invokes `'project:rename'` with path and newName args
- `app.openPath` → invokes `'shell:open-path'` with path arg

Follow the existing pattern in this file for how other methods are exposed.

- [ ] **Step 4: Add main process handlers in `src/main/ipc/handlers.ts`**

Add three new handlers following the existing pattern in this file:

For `project:remove` (`IPC.PROJECT_REMOVE`):
- Read projects from config store, filter out the matching path, save back
- Follow the same pattern as `project:add`

For `project:rename` (`IPC.PROJECT_RENAME`):
- Read projects config, update the `name` field for the matching path, save back

For `shell:open-path` (`IPC.SHELL_OPEN_PATH`):
- `import { shell } from 'electron'`
- Call `shell.openPath(path)`

- [ ] **Step 5: Verify build**

Run: `pnpm build`

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/renderer/src/types/electron.d.ts src/preload/index.ts src/main/ipc/handlers.ts
git commit -m "feat(ipc): add project remove/rename and shell openPath APIs"
```

### Task 4: Change session store to per-project map

Currently sessions are only loaded for `activeProject`. The new tree view needs sessions per project.

**Files:**
- Modify: `src/renderer/src/stores/session-store.ts`
- Modify: `src/renderer/src/components/chat/InputArea.tsx`
- Modify: `src/renderer/src/components/layout/Sidebar.tsx` (temporary compat, rewritten in Task 5)
- Modify: `src/renderer/src/__tests__/stores.test.ts`

- [ ] **Step 1: Change sessions to per-project map**

Replace the flat `sessions` array with a map keyed by project path:

```typescript
interface SessionState {
  sessionsByProject: Record<string, SessionMeta[]>
  activeSessionId: string | null

  setSessionsForProject: (projectPath: string, sessions: SessionMeta[]) => void
  setActive: (id: string | null) => void
  addSession: (session: SessionMeta) => void
  removeSession: (id: string) => void
}
```

Update store implementation:
```typescript
sessionsByProject: {},

setSessionsForProject: (projectPath, sessions) =>
  set((state) => ({
    sessionsByProject: { ...state.sessionsByProject, [projectPath]: sessions },
  })),
```

Update `addSession` to prepend to the correct project:
```typescript
addSession: (session) =>
  set((state) => {
    const existing = state.sessionsByProject[session.projectPath] || []
    return {
      sessionsByProject: {
        ...state.sessionsByProject,
        [session.projectPath]: [session, ...existing],
      },
    }
  }),
```

Update `removeSession` to search across all projects:
```typescript
removeSession: (id) =>
  set((state) => {
    const updated: Record<string, SessionMeta[]> = {}
    for (const [path, sessions] of Object.entries(state.sessionsByProject)) {
      updated[path] = sessions.filter((s) => s.id !== id)
    }
    return {
      sessionsByProject: updated,
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
    }
  }),
```

- [ ] **Step 2: Update all consumers of session store**

The consumers that need updating (found via grep):

1. **`src/renderer/src/components/chat/InputArea.tsx`** (line 21, 40):
   - Line 21: `const { activeSessionId } = useSessionStore()` — no change needed (activeSessionId still exists)
   - Line 40: `useSessionStore.getState().setActive(sessionId)` — no change needed

2. **`src/renderer/src/components/layout/Sidebar.tsx`** (lines 13, 50, 126, 206):
   - This file is being rewritten in Task 5. To keep the build passing between Task 4 and Task 5, temporarily update Sidebar.tsx to compile with the new interface:
     - Replace `sessions` with a flattened view: `const allSessions = Object.values(sessionsByProject).flat()`
     - Replace `setSessions` with `setSessionsForProject`
     - Update the `useEffect` that loads sessions to use `setSessionsForProject(activeProject.path, list)`
   - These changes are throwaway — Task 5 rewrites the entire file.

3. **`src/renderer/src/__tests__/stores.test.ts`** (lines 78-104):
   - Update tests to use new `sessionsByProject` / `setSessionsForProject` interface
   - Change `setState({ sessions: [] })` → `setState({ sessionsByProject: {} })`
   - Change `setSessions(sessions)` → `setSessionsForProject('test-path', sessions)`
   - Change assertions from `sessions` to `sessionsByProject['test-path']`

- [ ] **Step 3: Verify build**

Run: `pnpm build`
Fix any TypeScript errors from the interface change.

- [ ] **Step 4: Run tests**

Run: `pnpm test`
Ensure session store tests pass with updated interface.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/stores/session-store.ts src/renderer/src/components/layout/Sidebar.tsx src/renderer/src/components/chat/InputArea.tsx src/renderer/src/__tests__/stores.test.ts
git commit -m "refactor(store): change sessions to per-project map"
```

---

## Chunk 2: Sidebar UI Rewrite

### Task 5: Rewrite Sidebar.tsx with new tree structure

This is the main UI task. Rewrite the entire `Sidebar.tsx` component.

**Files:**
- Rewrite: `src/renderer/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Write the new Sidebar component shell**

Replace entire `Sidebar.tsx` with the new structure:

**Imports:**
```typescript
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
```

**Main Sidebar component** — define these handler functions inside the component:

`handleAddProject`:
```typescript
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
```

`handleSelectSession` — must also update activeProject:
```typescript
const handleSelectSession = useCallback(
  async (sessionId: string, projectPath: string) => {
    // Update active project if different
    const targetProject = projects.find((p) => p.path === projectPath)
    if (targetProject) {
      setActiveProject(targetProject)
    }
    setActive(sessionId)
    clearMessages()
    const messages = await window.electronAPI.session.load(sessionId)
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        useChatStore.getState().appendMessage(msg as ChatMessage)
      }
    }
  },
  [projects, setActiveProject, setActive, clearMessages],
)
```

`handleDeleteSession` — with confirmation:
```typescript
const handleDeleteSession = useCallback(
  async (sessionId: string) => {
    if (!confirm('确认删除此会话？')) return
    await window.electronAPI.session.delete(sessionId)
    removeSession(sessionId)
  },
  [removeSession],
)
```

**JSX structure:**
```tsx
return (
  <>
    {/* Title bar toggle button — KEEP EXACTLY AS CURRENT */}
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

    {/* Sidebar container */}
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
        {/* Header: "项目" + FolderPlus */}
        <div className="flex items-center justify-between px-4 py-2">
          <span className="text-sm font-medium text-text-secondary">项目</span>
          <button
            onClick={handleAddProject}
            className="p-1 rounded-md text-text-secondary hover:text-text-primary hover:bg-black/5 transition-colors"
          >
            <FolderPlus size={16} />
          </button>
        </div>

        {/* Project tree list */}
        <div className="flex-1 overflow-y-auto">
          {projects.map((project) => (
            <ProjectItem
              key={project.path}
              project={project}
              sessions={sessionsByProject[project.path] || []}
              isCollapsed={!!collapsedProjects[project.path]}
              onToggleCollapse={() => toggleProjectCollapsed(project.path)}
              activeSessionId={activeSessionId}
              onSelectSession={(id) => handleSelectSession(id, project.path)}
              onDeleteSession={handleDeleteSession}
            />
          ))}
        </div>

        {/* Footer: Settings */}
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

      {/* Drag handle — KEEP EXACTLY AS CURRENT */}
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
```

- [ ] **Step 2: Write the ProjectItem sub-component**

Define inline in the same file, above `Sidebar`:

```tsx
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

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

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
    const list = await window.electronAPI.session.list(project.path)
    useSessionStore.getState().setSessionsForProject(project.path, list as SessionMeta[])
  }

  const FolderIcon = isHovered
    ? (isCollapsed ? ChevronRight : ChevronDown)
    : (isCollapsed ? Folder : FolderOpen)

  return (
    <div className="relative">
      {/* Project row */}
      <div
        className={`flex items-center gap-2 px-4 py-1.5 cursor-pointer select-none transition-colors ${
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
        {/* Hover action buttons */}
        {isHovered && !isRenaming && (
          <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
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

      {/* Context menu */}
      {menuOpen && (
        <div
          ref={menuRef}
          className="absolute left-8 top-full z-30 bg-surface border border-border rounded-md shadow-lg py-1 min-w-[140px]"
        >
          <button
            onClick={() => { handleOpenFolder(); setMenuOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
          >
            <FolderOpen size={14} /> 打开文件夹
          </button>
          <button
            onClick={() => { setIsRenaming(true); setRenameValue(project.name); setMenuOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-black/5 dark:hover:bg-white/5"
          >
            <Pencil size={14} /> 重命名
          </button>
          <button
            onClick={() => { handleRemove(); setMenuOpen(false) }}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          >
            <Trash2 size={14} /> 删除项目
          </button>
        </div>
      )}

      {/* Session list (collapsible with animation) */}
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
```

- [ ] **Step 3: Write the SessionItem sub-component**

```tsx
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
      className={`w-full text-left pl-8 pr-4 py-1.5 text-sm transition-colors flex items-center justify-between ${
        isActive
          ? 'text-terracotta'
          : 'text-text-secondary hover:bg-black/5 dark:hover:bg-white/5'
      }`}
    >
      <span className="truncate text-xs">{session.title}</span>
      {session.lastActive && (
        <span className="text-[10px] text-cloudy shrink-0 ml-2">
          {formatRelativeTime(session.lastActive)}
        </span>
      )}
    </button>
  )
}
```

Note: Session indentation uses `pl-8` per spec.

- [ ] **Step 4: Write the formatRelativeTime helper**

Chinese-localized relative time:
```typescript
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
```

- [ ] **Step 5: Verify build**

Run: `pnpm build`
Fix any TypeScript errors.

- [ ] **Step 6: Manual visual test**

Run: `pnpm dev`
Verify:
- Projects show as tree with folder icons
- Click project toggles collapse/expand with smooth animation
- Hover shows chevron, ellipsis and new session buttons
- Sessions show title + relative time in Chinese
- Click session loads it and updates active project
- Bottom settings button opens settings overlay
- Drag resize still works
- Cmd+B toggle still works
- Right-click session shows confirmation before deleting

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/layout/Sidebar.tsx
git commit -m "feat(sidebar): rewrite with multi-project tree structure"
```

---

## Chunk 3: Integration Testing & Polish

### Task 6: End-to-end verification of context menu actions

**Files:**
- Already in Sidebar.tsx from Task 5

This task verifies the three context menu actions work end-to-end:

- [ ] **Step 1: Test "打开文件夹"**

Click a project's `...` → "打开文件夹" → should open Finder at project path.

- [ ] **Step 2: Test "重命名"**

Click `...` → "重命名" → inline input appears → type new name → press Enter → project name updates.
Verify it persists after app restart.

- [ ] **Step 3: Test "删除项目"**

Click `...` → "删除项目" → confirm dialog → project removed from list.
Verify it persists after app restart.

- [ ] **Step 4: Test collapse persistence**

Collapse a project → restart app → project should still be collapsed.

- [ ] **Step 5: Fix any issues found and commit**

```bash
git add -u
git commit -m "fix(sidebar): address integration test issues"
```

### Task 7: Final polish and cleanup

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar.tsx` (if needed)

- [ ] **Step 1: Verify dark mode**

Run app in dark mode, check:
- Hover states use `dark:bg-white/5`
- Menu border/shadow appropriate in dark mode
- Text colors readable
- Settings button footer readable

- [ ] **Step 2: Verify window resize auto-collapse**

Resize window below 900px — sidebar should auto-collapse.
Resize back — sidebar stays collapsed (user must Cmd+B to reopen).

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Ensure all tests pass.

- [ ] **Step 4: Final commit**

```bash
git add -u
git commit -m "refactor(sidebar): cleanup and polish"
```
