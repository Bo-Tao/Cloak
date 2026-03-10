# Resizable Sidebar Design

## Overview

Add drag-to-resize functionality to the sidebar. Users can drag the right edge to adjust width between 240px and 520px. Width persists across sessions.

## Requirements

- Min width: 240px, Max width: 520px, Default: 280px
- Drag handle on sidebar right edge
- Double-click handle resets to default width
- Width persisted to config via `electronAPI.config.set`
- Content auto-fills available width
- Existing collapse/expand behavior unchanged

## Approach

Pure React + native mouse events. No third-party dependencies.

## State Management

Add to `settings-store`:
- `sidebarWidth: number` (default: 280)
- `setSidebarWidth: (width: number) => void` — clamps to [240, 520], persists to config

Existing `sidebarCollapsed` unchanged. When collapsed, width is 0. When expanded, uses `sidebarWidth`.

## Layout Changes

**Current:** Outer div fixed 256px → inner aside fixed 240px + margin 8px.

**New:** Outer div uses `sidebarWidth` → inner aside uses `sidebarWidth - 8` (accounting for left margin). All child elements already use relative sizing (`w-full`, `px-3`), so they auto-adapt.

## Drag Handle

- 4px wide div, absolutely positioned at sidebar right edge
- Hover: shows 2px vertical line with `bg-border` color
- Dragging: line becomes `bg-terracotta`
- Cursor: `col-resize`

## Drag Logic

On `mousedown` on handle:
1. Record `initialX` and `initialWidth`
2. Attach `mousemove` on document: `newWidth = initialWidth + (e.clientX - initialX)`, clamped to [240, 520]
3. On `mouseup`: persist final width, remove listeners
4. During drag: add `select-none` + `cursor-col-resize` to body
5. Double-click: reset to default 280px

## Animation

- Non-drag transitions (collapse/expand): keep `transition-[width] duration-200`
- During drag: disable transition via `isResizing` state flag for real-time response

## Responsive

Existing auto-collapse at window < 900px remains unchanged.

## Files to Modify

1. `src/renderer/src/stores/settings-store.ts` — add `sidebarWidth`, `setSidebarWidth`
2. `src/renderer/src/components/layout/Sidebar.tsx` — add drag handle, resize logic, dynamic width
3. `src/renderer/src/styles/globals.css` — add `select-none` utility if needed
