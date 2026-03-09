# M2-M5 Implementation Decisions & Open Questions

## Decisions Made (without user confirmation)

### M4 Task 27: AuthGate
- **Decision:** Skipped `@xterm/xterm` + `node-pty` embedded terminal for the login flow
- **Reason:** `node-pty` is a native module that causes frequent build issues in Electron, especially with universal builds. Instead, implemented instruction-based guides that tell users to run `claude auth login` in their terminal
- **Impact:** Users authenticate outside the app, then click "Check Again"
- **Recommendation:** If embedded terminal is desired later, consider `@nicepkg/electron-pty` or WebSocket-based approach

### M5 Task 33: UpdateService
- **Decision:** Skipped this optional task
- **Reason:** Without code signing, auto-update won't work on macOS anyway. The infrastructure (electron-updater) is already in dependencies and can be wired later
- **Impact:** No in-app update notifications

### Dark Theme
- **Decision:** Implemented via CSS custom properties on `.dark` class rather than Tailwind's `dark:` prefix
- **Reason:** More efficient — single class toggle changes all theme variables instead of per-component dark variants
- **Impact:** Most structural components use theme-aware colors (`bg-surface`, `border-border`, etc). Some inner elements still use fixed `gray-*` colors

### Build Configuration
- **Decision:** Built for `arm64` only (not `universal`) to speed up development builds
- **Reason:** Universal builds require lipo and double the build time. Can switch to universal for release
- **To fix:** Change `electron-builder.yml` arch to `universal` for release builds

## What Was Implemented

### M2: Chat UI ✅
- Zustand stores (chat, session, project, settings)
- MainLayout with collapsible sidebar
- InputArea with auto-resize, Enter/Shift+Enter
- MessageList with React Virtuoso virtual scrolling
- MarkdownRenderer with react-markdown + Shiki (DOMPurify sanitized)
- Stream events wired to chat store

### M3: Permission System ✅
- ThinkingBlock (collapsible)
- ToolCard with risk-level badges, icons, expandable details
- PermissionBar with Y/N keyboard shortcuts
- DiffView with react-diff-viewer-continued
- Auto-accept mode with confirmation dialog

### M4: Sidebar + Sessions ✅
- SessionManager scanning ~/.claude/projects/
- ProjectManager with electron-store registry
- Full Sidebar with project selector, session list, search
- AuthGate with install/login guides
- SettingsOverlay with theme, font size, shortcuts display

### M5: Packaging + Polish ✅
- Window state persistence (debounced resize/move)
- Dark theme with CSS custom properties
- electron-builder configured for macOS dmg
- ARIA labels and focus rings on key elements

## Test Results
- **42 unit tests passing** across 6 test suites
- **Build compiles** successfully with electron-vite
- **DMG produced** at `dist/cloak-0.0.1.dmg` (~117MB)

## Known Limitations
1. Session loading from sidebar may need refinement — the ChatMessage type import in Sidebar.tsx uses `any`
2. Permission flow with Claude CLI stream-json isn't fully tested with real permission events
3. Dark theme only applied to structural components; some inner elements still use light-only colors
4. No project folder picker dialog (uses `prompt()` currently) — needs IPC for `dialog.showOpenDialog`
