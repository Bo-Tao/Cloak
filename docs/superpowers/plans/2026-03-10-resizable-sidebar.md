# Resizable Sidebar Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-to-resize functionality to the sidebar with width range 240-520px, persisted across sessions.

**Architecture:** Pure React + native mouse events. Add `sidebarWidth` state to the existing zustand settings store, add a drag handle div to the Sidebar component, and wire up mousedown/mousemove/mouseup for real-time resizing.

**Tech Stack:** React, Zustand, Tailwind CSS v4, Electron IPC (config persistence)

**Spec:** `docs/superpowers/specs/2026-03-10-resizable-sidebar-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/renderer/src/stores/settings-store.ts` | Modify | Add `sidebarWidth` state + `setSidebarWidth` action |
| `src/renderer/src/components/layout/Sidebar.tsx` | Modify | Add drag handle, resize logic, dynamic width |

---

## Task 1: Add `sidebarWidth` to Settings Store

**Files:**
- Modify: `src/renderer/src/stores/settings-store.ts`

- [ ] **Step 1: Add `sidebarWidth` and `setSidebarWidth` to the store interface and implementation**

Add these to `SettingsState` interface:

```typescript
sidebarWidth: number
setSidebarWidth: (width: number) => void
```

Add to the store's initial state:

```typescript
sidebarWidth: 280,
```

Add the setter (clamp + persist):

```typescript
setSidebarWidth: (width) => {
  const clamped = Math.max(240, Math.min(520, width))
  set({ sidebarWidth: clamped })
  window.electronAPI.config.set('sidebarWidth', clamped)
},
```

- [ ] **Step 2: Verify no type errors**

Run: `cd /Users/botao/SP/Cloak && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`
Expected: No errors related to settings-store

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/stores/settings-store.ts
git commit -m "feat: add sidebarWidth state to settings store"
```

---

## Task 2: Make Sidebar Width Dynamic

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Read `sidebarWidth` from store and use it for layout**

In the Sidebar component, destructure `sidebarWidth` from `useSettingsStore()`.

Change the outer div style from:
```typescript
style={{ width: sidebarCollapsed ? 0 : 256 }}
```
to:
```typescript
style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
```

Change the inner aside style from:
```typescript
style={{ width: 240, margin: 8, marginRight: 0 }}
```
to:
```typescript
style={{ width: sidebarWidth - 8, margin: 8, marginRight: 0 }}
```

- [ ] **Step 2: Verify app renders correctly with new dynamic width**

Run: `cd /Users/botao/SP/Cloak && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/components/layout/Sidebar.tsx
git commit -m "feat: use dynamic sidebarWidth for sidebar layout"
```

---

## Task 3: Add Drag Handle and Resize Logic

**Files:**
- Modify: `src/renderer/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add `isResizing` local state and disable transition during drag**

Add a local state:
```typescript
const [isResizing, setIsResizing] = useState(false)
```

On the outer div, conditionally apply transition:
```tsx
<div
  className={`shrink-0 overflow-hidden ${isResizing ? '' : 'transition-[width] duration-200'}`}
  style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
>
```

- [ ] **Step 2: Add the drag handle div inside the outer wrapper**

The outer wrapper needs `relative` positioning. Add a drag handle as a sibling of `<aside>`, positioned at the right edge:

```tsx
<div
  className={`shrink-0 overflow-hidden relative ${isResizing ? '' : 'transition-[width] duration-200'}`}
  style={{ width: sidebarCollapsed ? 0 : sidebarWidth }}
>
  <aside ...>
    {/* existing content */}
  </aside>

  {/* Drag handle */}
  {!sidebarCollapsed && (
    <div
      className="absolute top-0 right-0 w-1 h-full cursor-col-resize group z-10 flex items-center justify-center"
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
    >
      <div className={`w-0.5 h-full transition-colors ${isResizing ? 'bg-terracotta' : 'bg-transparent group-hover:bg-border'}`} />
    </div>
  )}
</div>
```

- [ ] **Step 3: Implement drag handlers**

Add `setSidebarWidth` to the store destructure. Add these handlers:

```typescript
const { sidebarCollapsed, toggleSidebar, sidebarWidth, setSidebarWidth } = useSettingsStore()

const handleMouseDown = useCallback(
  (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    setIsResizing(true)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (e.clientX - startX)
      setSidebarWidth(newWidth) // clamping done in store
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
```

- [ ] **Step 4: Verify no type errors**

Run: `cd /Users/botao/SP/Cloak && npx tsc --noEmit --project src/renderer/tsconfig.json 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/layout/Sidebar.tsx
git commit -m "feat: add drag-to-resize sidebar with handle"
```

---

## Task 4: Manual Verification

- [ ] **Step 1: Start dev server and verify**

Run: `cd /Users/botao/SP/Cloak && pnpm dev`

Verify:
1. Sidebar renders at default 280px width
2. Hover on right edge shows subtle line
3. Drag right edge — sidebar width follows mouse in real-time
4. Width is clamped at 240px (min) and 520px (max)
5. Double-click handle resets to 280px
6. Collapse/expand sidebar still works with smooth transition
7. Content (session list, search, project selector) auto-fills width
8. Restart app — sidebar remembers last width

- [ ] **Step 2: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: polish resizable sidebar behavior"
```
