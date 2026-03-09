# Cloak Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a desktop GUI for Claude Code CLI using Electron, covering M0 through M5 milestones. Each milestone produces a verifiable deliverable.

**Architecture:** Electron dual-process model. Main process manages Claude Code child processes (per-turn `--print --output-format stream-json`), JSONL parsing, and config persistence via electron-store. Renderer process uses React 19 + Zustand for UI. Communication via contextBridge IPC (async only).

**Tech Stack:** electron-vite, Electron 40.8.0, React 19, TypeScript, Tailwind CSS v4, shadcn/ui (Radix UI), Zustand, react-markdown + Shiki, React Virtuoso, electron-store v9, electron-builder

**Key Design Decisions:**
- CLI communication uses `child_process.spawn` with `--print --output-format stream-json --input-format stream-json`
- Session data reads Claude Code's native JSONL files at `~/.claude/projects/`
- Permission handling via stdin JSON write-back
- Virtual scrolling uses React Virtuoso (chat-optimized, bottom-aligned)
- MVP ships without macOS code signing

**Reference Docs:**
- Design: `docs/plans/2026-03-09-cloak-design.md`
- PRD: `Cloak-PRD-v1.0.md`

---

## M0: Scaffolding

**Verification:** `pnpm dev` launches Electron window with default React template. Tailwind v4 classes and shadcn/ui Button render correctly. All placeholder files exist without import errors.

---

### Task 1: Initialize electron-vite Project

**Files:**
- Create: entire project scaffold
- Modify: `package.json`
- Modify: `electron.vite.config.ts`

**Step 1: Scaffold project**

```bash
cd /Users/botao/SP/Cloak
mkdir -p /tmp/cloak-backup && cp -r LICENSE Cloak-PRD-v1.0.md docs .claude /tmp/cloak-backup/
npx create-electron-vite@latest . --template react-ts
cp -r /tmp/cloak-backup/* /tmp/cloak-backup/.claude .
```

Expected: `src/main/`, `src/preload/`, `src/renderer/`, `electron.vite.config.ts`

**Step 2: Install core dependencies**

```bash
pnpm add zustand electron-store@9
pnpm add -D @types/node vitest
```

**Step 3: Verify dev server starts**

```bash
pnpm dev
```

Expected: Electron window opens with default React template.

**Step 4: Commit**

```bash
git add .
git commit -m "feat(m0): initialize electron-vite project with React + TypeScript"
```

---

### Task 2: Configure Tailwind CSS v4 + shadcn/ui

**Files:**
- Create: `src/renderer/styles/globals.css`
- Modify: `electron.vite.config.ts`
- Create: `components.json`

**Step 1: Install Tailwind v4 (Vite plugin)**

```bash
pnpm add -D tailwindcss @tailwindcss/vite
```

**Step 2: Configure Vite plugin**

Add `@tailwindcss/vite` to `electron.vite.config.ts` renderer plugins:
```typescript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // ...
  renderer: {
    plugins: [tailwindcss()],
    // ...existing config
  },
})
```

**Step 3: Create global CSS with Tailwind v4 @theme**

Create `src/renderer/styles/globals.css`:
```css
@import "tailwindcss";

@theme {
  --color-pampas: #F4F3EE;
  --color-terracotta: #C15F3C;
  --color-terracotta-dark: #AE5630;
  --color-cloudy: #B1ADA1;
  --font-serif: Georgia, serif;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;
}
```

Import in renderer entry:
```typescript
import './styles/globals.css'
```

**Step 4: Initialize shadcn/ui**

```bash
npx shadcn@latest init
npx shadcn@latest add button
```

Verify `components.json` and `src/renderer/components/ui/button.tsx` exist.

**Step 5: Verify**

```bash
pnpm dev
```

Expected: Electron window shows styled shadcn Button with Tailwind classes.

**Step 6: Commit**

```bash
git add .
git commit -m "feat(m0): configure Tailwind CSS v4 and shadcn/ui"
```

---

### Task 3: Create Project Directory Structure + Shared Types

**Files:**
- Create: `src/shared/types.ts`
- Create: directory structure under `src/main/`, `src/renderer/`, `src/preload/`

**Step 1: Create shared types**

Create `src/shared/types.ts`:

```typescript
// === Message Types ===

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  timestamp: string
  blocks: ContentBlock[]
  cost?: { inputTokens: number; outputTokens: number; usdCost: number }
  model?: string
}

export type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; toolId: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolId: string; output: string; error?: string }
  | { type: 'thinking'; content: string }

export type RiskLevel = 'low' | 'medium' | 'high'

export interface PermissionRequest {
  toolUseId: string
  toolName: string
  input: Record<string, unknown>
  riskLevel: RiskLevel
}

// === Session Types ===

export interface SessionMeta {
  id: string
  title: string
  projectPath: string
  lastActive: string
  messageCount: number
}

// === Project Types ===

export interface Project {
  path: string
  name: string
  autoAccept: boolean
  claudeArgs: string[]
}

// === Config Types ===

export interface AppConfig {
  theme: 'light' | 'dark' | 'system'
  fontSize: number
  claudeBinaryPath: string
  globalAutoAccept: boolean
  globalClaudeArgs: string[]
  window: { x?: number; y?: number; width: number; height: number }
  sidebarCollapsed: boolean
  lastProjectId: string
  shortcuts: Record<string, string>
  reduceMotion: boolean
  projects: Record<string, { name: string; autoAccept: boolean; claudeArgs: string[] }>
}

// === IPC Channel Names ===

export const IPC = {
  CLAUDE_SEND: 'claude:send-message',
  CLAUDE_STREAM: 'claude:stream-event',
  CLAUDE_ABORT: 'claude:abort',
  CLAUDE_PERMISSION_REQUEST: 'claude:permission-request',
  CLAUDE_CONFIRM: 'claude:confirm-permission',
  SESSION_LIST: 'session:list',
  SESSION_LOAD: 'session:load',
  SESSION_CREATE: 'session:create',
  SESSION_DELETE: 'session:delete',
  PROJECT_LIST: 'project:list',
  PROJECT_ADD: 'project:add',
  PROJECT_CLAUDE_MD: 'project:claude-md',
  CONFIG_GET: 'config:get',
  CONFIG_SET: 'config:set',
  APP_CHECK_CLI: 'app:check-cli',
  APP_AUTH_STATUS: 'app:auth-status',
} as const
```

**Step 2: Create Main Process directory structure**

```
src/main/
├── index.ts              # entry (already exists)
├── services/
│   ├── claude-service.ts
│   ├── session-manager.ts
│   ├── project-manager.ts
│   ├── auth-checker.ts
│   └── config-store.ts
├── ipc/
│   └── handlers.ts
└── parsers/
    └── jsonl-parser.ts
```

Create each file with a minimal placeholder export (e.g., `export {}`) so imports don't break.

**Step 3: Create Renderer directory structure**

```
src/renderer/
├── App.tsx
├── main.tsx
├── styles/globals.css
├── components/
│   ├── ui/                  # shadcn (already exists)
│   ├── layout/
│   │   ├── MainLayout.tsx
│   │   └── Sidebar.tsx
│   ├── chat/
│   │   ├── ChatArea.tsx
│   │   ├── MessageList.tsx
│   │   ├── UserMessage.tsx
│   │   ├── AssistantMessage.tsx
│   │   ├── MarkdownRenderer.tsx
│   │   ├── ThinkingBlock.tsx
│   │   ├── ToolCard.tsx
│   │   ├── DiffView.tsx
│   │   ├── InputArea.tsx
│   │   └── PermissionBar.tsx
│   ├── auth/
│   │   ├── AuthGate.tsx
│   │   ├── InstallGuide.tsx
│   │   └── LoginGuide.tsx
│   └── settings/
│       └── SettingsOverlay.tsx
├── stores/
│   ├── chat-store.ts
│   ├── session-store.ts
│   ├── project-store.ts
│   └── settings-store.ts
└── types/
    └── electron.d.ts       # window.electronAPI type declaration
```

Create each file with minimal placeholder (`export default function X() { return null }` for components, `export {}` for stores).

**Step 4: Create Preload types**

Create `src/preload/index.ts` (placeholder) and `src/renderer/types/electron.d.ts`:

```typescript
// src/renderer/types/electron.d.ts
interface ElectronAPI {
  claude: {
    sendMessage: (sessionId: string, text: string) => Promise<void>
    onStreamEvent: (cb: (event: unknown) => void) => () => void
    abort: (sessionId: string) => Promise<void>
    onPermissionRequest: (cb: (req: unknown) => void) => () => void
    confirmPermission: (toolUseId: string, allow: boolean) => Promise<void>
  }
  session: {
    list: (projectPath: string) => Promise<unknown[]>
    load: (sessionId: string) => Promise<unknown>
    create: (projectPath: string) => Promise<string>
    delete: (sessionId: string) => Promise<void>
  }
  project: {
    list: () => Promise<unknown[]>
    add: (path: string) => Promise<void>
    getClaudeMd: (path: string) => Promise<string | null>
  }
  config: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
  }
  app: {
    checkCli: () => Promise<{ installed: boolean; version: string | null; authenticated: boolean }>
    getAuthStatus: () => Promise<unknown>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
```

**Step 5: Verify build**

```bash
pnpm dev
```

Expected: App still launches without import errors.

**Step 6: Commit**

```bash
git add .
git commit -m "feat(m0): establish project structure and shared types"
git tag m0-complete
```

---

## M0 Verification Checklist

- [ ] `pnpm dev` launches Electron window
- [ ] shadcn Button renders with Tailwind classes
- [ ] Tailwind v4 @theme variables work (bg-pampas, text-cloudy)
- [ ] All placeholder files exist without import errors
- [ ] Project structure matches specified layout

---

## M1: Core Service

**Verification:** `pnpm dev` launches Electron window showing CLI status ("Claude Code vX.X — Ready" or "Not installed"). Send a test message via a debug button and see stream-json events logged in DevTools console.

---

### Task 4: Implement Config Store

**Files:**
- Modify: `src/main/services/config-store.ts`
- Create: `src/main/__tests__/config-store.test.ts`

**Step 1: Write failing test**

```typescript
// src/main/__tests__/config-store.test.ts
import { describe, it, expect } from 'vitest'
import { getConfigDefaults, isValidFontSize } from '../services/config-store'

describe('ConfigStore', () => {
  it('returns correct defaults', () => {
    const d = getConfigDefaults()
    expect(d.theme).toBe('system')
    expect(d.fontSize).toBe(14)
    expect(d.globalAutoAccept).toBe(false)
    expect(d.sidebarCollapsed).toBe(false)
    expect(d.window).toEqual({ width: 1200, height: 800 })
  })

  it('validates fontSize range 12-20', () => {
    expect(isValidFontSize(12)).toBe(true)
    expect(isValidFontSize(20)).toBe(true)
    expect(isValidFontSize(11)).toBe(false)
    expect(isValidFontSize(21)).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/main/__tests__/config-store.test.ts
```

Expected: FAIL — functions not found.

**Step 3: Implement**

```typescript
// src/main/services/config-store.ts
import Store from 'electron-store'
import type { AppConfig } from '../../shared/types'

export function getConfigDefaults(): AppConfig {
  return {
    theme: 'system',
    fontSize: 14,
    claudeBinaryPath: '',
    globalAutoAccept: false,
    globalClaudeArgs: [],
    window: { width: 1200, height: 800 },
    sidebarCollapsed: false,
    lastProjectId: '',
    shortcuts: {},
    reduceMotion: false,
    projects: {},
  }
}

export function isValidFontSize(size: number): boolean {
  return size >= 12 && size <= 20
}

let store: Store<AppConfig> | null = null

export function getStore(): Store<AppConfig> {
  if (!store) {
    store = new Store<AppConfig>({ name: 'config', defaults: getConfigDefaults() })
  }
  return store
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/main/__tests__/config-store.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add .
git commit -m "feat(m1): implement config store with electron-store v9"
```

---

### Task 5: Implement AuthChecker

**Files:**
- Modify: `src/main/services/auth-checker.ts`
- Create: `src/main/__tests__/auth-checker.test.ts`

**Step 1: Write failing test**

```typescript
// src/main/__tests__/auth-checker.test.ts
import { describe, it, expect } from 'vitest'
import { parseVersionOutput, parseAuthStatusJson } from '../services/auth-checker'

describe('AuthChecker parsing', () => {
  it('parses claude version output', () => {
    expect(parseVersionOutput('1.0.40 (Claude Code)\n'))
      .toEqual({ installed: true, version: '1.0.40' })
  })

  it('detects missing CLI', () => {
    expect(parseVersionOutput('')).toEqual({ installed: false, version: null })
  })

  it('parses auth status JSON (authenticated)', () => {
    const json = '{"email":"user@example.com","plan":"pro","tokenExpiresAt":1748658860401,"authenticated":true}'
    expect(parseAuthStatusJson(json)).toEqual({ authenticated: true, email: 'user@example.com' })
  })

  it('parses auth status JSON (unauthenticated)', () => {
    const json = '{"authenticated":false}'
    expect(parseAuthStatusJson(json)).toEqual({ authenticated: false, email: null })
  })

  it('handles malformed auth output', () => {
    expect(parseAuthStatusJson('garbage')).toEqual({ authenticated: false, email: null })
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/main/__tests__/auth-checker.test.ts
```

**Step 3: Implement**

```typescript
// src/main/services/auth-checker.ts
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getStore } from './config-store'

const execFileAsync = promisify(execFile)

export interface CliStatus {
  installed: boolean
  version: string | null
}

export interface AuthStatus {
  authenticated: boolean
  email: string | null
}

export function parseVersionOutput(stdout: string): CliStatus {
  const trimmed = stdout.trim()
  if (!trimmed) return { installed: false, version: null }
  const match = trimmed.match(/^([\d.]+)/)
  return match ? { installed: true, version: match[1] } : { installed: false, version: null }
}

export function parseAuthStatusJson(stdout: string): AuthStatus {
  try {
    const data = JSON.parse(stdout.trim())
    return {
      authenticated: data.authenticated === true,
      email: data.email ?? null,
    }
  } catch {
    return { authenticated: false, email: null }
  }
}

function getClaudePath(): string {
  return getStore().get('claudeBinaryPath') || 'claude'
}

export async function checkCliInstalled(): Promise<CliStatus> {
  try {
    const { stdout } = await execFileAsync(getClaudePath(), ['--version'])
    return parseVersionOutput(stdout)
  } catch {
    return { installed: false, version: null }
  }
}

export async function checkAuth(): Promise<AuthStatus> {
  try {
    const { stdout } = await execFileAsync(getClaudePath(), ['auth', 'status'])
    return parseAuthStatusJson(stdout)
  } catch {
    return { authenticated: false, email: null }
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/main/__tests__/auth-checker.test.ts
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat(m1): implement AuthChecker with version and auth status parsing"
```

---

### Task 6: Implement JSONL Parser

**Files:**
- Modify: `src/main/parsers/jsonl-parser.ts`
- Create: `src/main/__tests__/jsonl-parser.test.ts`

**Step 1: Write failing test**

```typescript
// src/main/__tests__/jsonl-parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseJsonlLine, extractSessionMeta, extractChatMessages } from '../parsers/jsonl-parser'

describe('JSONL Parser', () => {
  it('parses assistant text event', () => {
    const line = JSON.stringify({
      type: 'assistant', uuid: 'a1', timestamp: '2026-03-09T10:00:00Z',
      message: { role: 'assistant', content: [{ type: 'text', text: 'Hello' }] },
    })
    const event = parseJsonlLine(line)
    expect(event).not.toBeNull()
    expect(event!.type).toBe('assistant')
  })

  it('parses tool_use nested in assistant', () => {
    const line = JSON.stringify({
      type: 'assistant', uuid: 'a2', timestamp: '2026-03-09T10:01:00Z',
      message: { role: 'assistant', content: [{
        type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: '/tmp/test.txt' },
      }] },
    })
    const event = parseJsonlLine(line)
    expect(event).not.toBeNull()
  })

  it('returns null for non-renderable types', () => {
    expect(parseJsonlLine(JSON.stringify({ type: 'progress', data: {} }))).toBeNull()
    expect(parseJsonlLine(JSON.stringify({ type: 'file-history-snapshot' }))).toBeNull()
    expect(parseJsonlLine(JSON.stringify({ type: 'system' }))).toBeNull()
  })

  it('extracts session title from custom-title record', () => {
    const lines = [
      JSON.stringify({ type: 'user', uuid: '1', timestamp: '2026-03-09T10:00:00Z', message: { role: 'user', content: [{ type: 'text', text: 'First message that is long enough' }] } }),
      JSON.stringify({ type: 'custom-title', customTitle: 'My Title', sessionId: 's1' }),
    ]
    expect(extractSessionMeta(lines, 's1', '/proj').title).toBe('My Title')
  })

  it('falls back to first user message (truncated to 30 chars)', () => {
    const lines = [
      JSON.stringify({ type: 'user', uuid: '1', timestamp: '2026-03-09T10:00:00Z', message: { role: 'user', content: [{ type: 'text', text: 'This is a very long message that should be truncated at thirty chars' }] } }),
    ]
    expect(extractSessionMeta(lines, 's2', '/proj').title.length).toBeLessThanOrEqual(30)
  })

  it('converts JSONL lines to ChatMessage array', () => {
    const lines = [
      JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-03-09T10:00:00Z', message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] } }),
      JSON.stringify({ type: 'assistant', uuid: 'a1', timestamp: '2026-03-09T10:00:01Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Hi' }] } }),
      JSON.stringify({ type: 'progress', data: {} }),
      JSON.stringify({ type: 'result', duration: 1200 }),
    ]
    const msgs = extractChatMessages(lines)
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/main/__tests__/jsonl-parser.test.ts
```

**Step 3: Implement**

```typescript
// src/main/parsers/jsonl-parser.ts
import type { ChatMessage, ContentBlock, SessionMeta } from '../../shared/types'

interface RawEvent {
  type: string
  uuid?: string
  timestamp?: string
  sessionId?: string
  message?: {
    role: string
    content: Array<{
      type: string; text?: string; id?: string; name?: string
      input?: Record<string, unknown>; content?: unknown; tool_use_id?: string
    }>
  }
  customTitle?: string
  cost?: { inputTokens: number; outputTokens: number; usdCost: number }
  model?: string
  [key: string]: unknown
}

const RENDERABLE_TYPES = new Set(['user', 'assistant'])

export function parseJsonlLine(line: string): RawEvent | null {
  try {
    const parsed: RawEvent = JSON.parse(line)
    if (!RENDERABLE_TYPES.has(parsed.type) && parsed.type !== 'custom-title') return null
    return parsed
  } catch {
    return null
  }
}

function toContentBlocks(message: RawEvent['message']): ContentBlock[] {
  if (!message?.content) return []
  return message.content
    .map((block): ContentBlock | null => {
      switch (block.type) {
        case 'text':
          return { type: 'text', content: block.text ?? '' }
        case 'tool_use':
          return { type: 'tool_use', toolId: block.id ?? '', name: block.name ?? '', input: block.input ?? {} }
        case 'tool_result':
          return { type: 'tool_result', toolId: block.tool_use_id ?? block.id ?? '', output: typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '') }
        case 'thinking':
          return { type: 'thinking', content: block.text ?? '' }
        default:
          return null
      }
    })
    .filter((b): b is ContentBlock => b !== null)
}

export function extractSessionMeta(lines: string[], sessionId: string, projectPath: string): SessionMeta {
  let title = ''
  let firstUserMsg = ''
  let lastTimestamp = ''
  let messageCount = 0

  for (const line of lines) {
    try {
      const parsed: RawEvent = JSON.parse(line)
      if (parsed.type === 'custom-title' && parsed.customTitle) title = parsed.customTitle
      if (parsed.type === 'user' && !firstUserMsg) {
        const text = parsed.message?.content?.find((b) => b.type === 'text')?.text
        if (text) firstUserMsg = text.slice(0, 30)
      }
      if (parsed.timestamp) lastTimestamp = parsed.timestamp
      if (parsed.type === 'user' || parsed.type === 'assistant') messageCount++
    } catch { /* skip malformed */ }
  }

  return { id: sessionId, title: title || firstUserMsg || 'Untitled', projectPath, lastActive: lastTimestamp, messageCount }
}

export function extractChatMessages(lines: string[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const line of lines) {
    const event = parseJsonlLine(line)
    if (!event?.message || (event.type !== 'user' && event.type !== 'assistant')) continue
    const blocks = toContentBlocks(event.message)
    if (blocks.length === 0) continue
    messages.push({
      id: event.uuid ?? crypto.randomUUID(),
      role: event.type as 'user' | 'assistant',
      timestamp: event.timestamp ?? '',
      blocks,
      cost: event.cost,
      model: event.model,
    })
  }
  return messages
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/main/__tests__/jsonl-parser.test.ts
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat(m1): implement JSONL parser for session files and stream events"
```

---

### Task 7: Implement ClaudeService

**Files:**
- Modify: `src/main/services/claude-service.ts`
- Create: `src/main/__tests__/claude-service.test.ts`

**Step 1: Write failing test**

```typescript
// src/main/__tests__/claude-service.test.ts
import { describe, it, expect } from 'vitest'
import { inferRiskLevel, buildClaudeArgs } from '../services/claude-service'

describe('ClaudeService utilities', () => {
  it('infers low risk for read tools', () => {
    expect(inferRiskLevel('Read', {})).toBe('low')
    expect(inferRiskLevel('Glob', {})).toBe('low')
    expect(inferRiskLevel('Grep', {})).toBe('low')
    expect(inferRiskLevel('WebFetch', {})).toBe('low')
  })

  it('infers medium risk for write tools', () => {
    expect(inferRiskLevel('Write', {})).toBe('medium')
    expect(inferRiskLevel('Edit', {})).toBe('medium')
  })

  it('infers high risk for Bash', () => {
    expect(inferRiskLevel('Bash', {})).toBe('high')
    expect(inferRiskLevel('Bash', { command: 'rm -rf /' })).toBe('high')
  })

  it('infers high risk for unknown tools', () => {
    expect(inferRiskLevel('SomethingNew', {})).toBe('high')
  })

  it('builds correct args for new session', () => {
    const args = buildClaudeArgs({ cwd: '/project', extraArgs: [] })
    expect(args).toContain('--print')
    expect(args).toContain('--output-format')
    expect(args).toContain('stream-json')
    expect(args).not.toContain('--resume')
  })

  it('builds correct args for resumed session', () => {
    const args = buildClaudeArgs({ sessionId: 'sess-123', cwd: '/project', extraArgs: [] })
    expect(args).toContain('--resume')
    expect(args).toContain('sess-123')
  })

  it('includes allowedTools for auto-accept mode', () => {
    const args = buildClaudeArgs({ cwd: '/p', extraArgs: [], autoAccept: true })
    expect(args.some(a => a.includes('Bash'))).toBe(true)
  })
})
```

**Step 2: Run test to verify it fails**

```bash
pnpm vitest run src/main/__tests__/claude-service.test.ts
```

**Step 3: Implement**

```typescript
// src/main/services/claude-service.ts
import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createInterface } from 'node:readline'
import type { RiskLevel } from '../../shared/types'
import { getStore } from './config-store'

const LOW_RISK = new Set(['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'LS'])
const MEDIUM_RISK = new Set(['Write', 'Edit', 'NotebookEdit'])

export function inferRiskLevel(toolName: string, input: Record<string, unknown>): RiskLevel {
  if (LOW_RISK.has(toolName)) return 'low'
  if (MEDIUM_RISK.has(toolName)) return 'medium'
  return 'high'
}

interface BuildArgsOptions {
  sessionId?: string
  cwd: string
  extraArgs: string[]
  autoAccept?: boolean
}

export function buildClaudeArgs(opts: BuildArgsOptions): string[] {
  const args = ['--print', '--output-format', 'stream-json', '--input-format', 'stream-json']
  if (opts.sessionId) args.push('--resume', opts.sessionId)
  if (opts.autoAccept) args.push('--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,LS,NotebookEdit')
  args.push(...opts.extraArgs)
  return args
}

export class ClaudeService extends EventEmitter {
  private processes = new Map<string, ChildProcess>()

  private getClaudePath(): string {
    return getStore().get('claudeBinaryPath') || 'claude'
  }

  async sendMessage(sessionId: string, message: string, cwd: string): Promise<void> {
    const existing = this.processes.get(sessionId)
    if (existing && !existing.killed) {
      existing.stdin?.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: message }] } }) + '\n')
      return
    }

    const store = getStore()
    const globalArgs = store.get('globalClaudeArgs') || []
    const projectConfig = store.get('projects')[cwd]
    const autoAccept = projectConfig?.autoAccept ?? store.get('globalAutoAccept')

    const args = buildClaudeArgs({ sessionId, cwd, extraArgs: globalArgs, autoAccept })
    const proc = spawn(this.getClaudePath(), args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } })
    this.processes.set(sessionId, proc)

    if (proc.stdout) {
      const rl = createInterface({ input: proc.stdout })
      rl.on('line', (line) => {
        try {
          const event = JSON.parse(line)
          this.emit('stream-event', { sessionId, event })
        } catch { /* skip non-JSON */ }
      })
    }

    if (proc.stderr) {
      const rl = createInterface({ input: proc.stderr })
      rl.on('line', (line) => this.emit('error', { sessionId, error: line }))
    }

    proc.on('exit', (code) => {
      this.processes.delete(sessionId)
      this.emit('exit', { sessionId, code })
    })

    proc.stdin?.write(JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: message }] } }) + '\n')
  }

  abort(sessionId: string): void {
    const proc = this.processes.get(sessionId)
    if (proc && !proc.killed) proc.kill('SIGINT')
  }

  confirmPermission(sessionId: string, toolUseId: string, allow: boolean): void {
    const proc = this.processes.get(sessionId)
    if (proc && !proc.killed) {
      proc.stdin?.write(JSON.stringify({ type: 'permission_response', toolUseId, allow }) + '\n')
    }
  }

  isActive(sessionId: string): boolean {
    const proc = this.processes.get(sessionId)
    return !!proc && !proc.killed
  }

  dispose(): void {
    for (const [, proc] of this.processes) {
      if (!proc.killed) proc.kill('SIGTERM')
    }
    this.processes.clear()
  }
}
```

**Step 4: Run test to verify it passes**

```bash
pnpm vitest run src/main/__tests__/claude-service.test.ts
```

**Step 5: Commit**

```bash
git add .
git commit -m "feat(m1): implement ClaudeService with stream-json child process management"
```

---

### Task 8: Implement IPC Bridge (Preload + Handlers)

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/main/index.ts`

**Step 1: Implement preload contextBridge**

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

const api = {
  claude: {
    sendMessage: (sessionId: string, text: string) => ipcRenderer.invoke(IPC.CLAUDE_SEND, sessionId, text),
    onStreamEvent: (cb: (event: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data)
      ipcRenderer.on(IPC.CLAUDE_STREAM, handler)
      return () => ipcRenderer.removeListener(IPC.CLAUDE_STREAM, handler)
    },
    abort: (sessionId: string) => ipcRenderer.invoke(IPC.CLAUDE_ABORT, sessionId),
    onPermissionRequest: (cb: (req: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data)
      ipcRenderer.on(IPC.CLAUDE_PERMISSION_REQUEST, handler)
      return () => ipcRenderer.removeListener(IPC.CLAUDE_PERMISSION_REQUEST, handler)
    },
    confirmPermission: (toolUseId: string, allow: boolean) => ipcRenderer.invoke(IPC.CLAUDE_CONFIRM, toolUseId, allow),
  },
  session: {
    list: (projectPath: string) => ipcRenderer.invoke(IPC.SESSION_LIST, projectPath),
    load: (sessionId: string) => ipcRenderer.invoke(IPC.SESSION_LOAD, sessionId),
    create: (projectPath: string) => ipcRenderer.invoke(IPC.SESSION_CREATE, projectPath),
    delete: (sessionId: string) => ipcRenderer.invoke(IPC.SESSION_DELETE, sessionId),
  },
  project: {
    list: () => ipcRenderer.invoke(IPC.PROJECT_LIST),
    add: (path: string) => ipcRenderer.invoke(IPC.PROJECT_ADD, path),
    getClaudeMd: (path: string) => ipcRenderer.invoke(IPC.PROJECT_CLAUDE_MD, path),
  },
  config: {
    get: (key: string) => ipcRenderer.invoke(IPC.CONFIG_GET, key),
    set: (key: string, value: unknown) => ipcRenderer.invoke(IPC.CONFIG_SET, key, value),
  },
  app: {
    checkCli: () => ipcRenderer.invoke(IPC.APP_CHECK_CLI),
    getAuthStatus: () => ipcRenderer.invoke(IPC.APP_AUTH_STATUS),
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
```

**Step 2: Implement IPC handlers**

```typescript
// src/main/ipc/handlers.ts
import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import type { ClaudeService } from '../services/claude-service'
import { checkCliInstalled, checkAuth } from '../services/auth-checker'
import { getStore } from '../services/config-store'

export function registerIpcHandlers(claudeService: ClaudeService): void {
  ipcMain.handle(IPC.APP_CHECK_CLI, async () => {
    const cli = await checkCliInstalled()
    const auth = cli.installed ? await checkAuth() : { authenticated: false }
    return { ...cli, ...auth }
  })

  ipcMain.handle(IPC.APP_AUTH_STATUS, async () => checkAuth())

  ipcMain.handle(IPC.CLAUDE_SEND, async (_e, sessionId: string, text: string) => {
    const store = getStore()
    const cwd = store.get('lastProjectId') || process.cwd()
    await claudeService.sendMessage(sessionId, text, cwd)
  })

  ipcMain.handle(IPC.CLAUDE_ABORT, (_e, sessionId: string) => claudeService.abort(sessionId))

  ipcMain.handle(IPC.CLAUDE_CONFIRM, (_e, toolUseId: string, allow: boolean) => {
    // Need sessionId context — will be refined in M2
  })

  ipcMain.handle(IPC.CONFIG_GET, (_e, key: string) => getStore().get(key as never))
  ipcMain.handle(IPC.CONFIG_SET, (_e, key: string, value: unknown) => getStore().set(key as never, value as never))

  // Forward stream events to all renderer windows
  claudeService.on('stream-event', (data) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.CLAUDE_STREAM, data)
    }
  })
}
```

**Step 3: Wire up main/index.ts**

Update `src/main/index.ts` to:
- Create BrowserWindow with `{ minWidth: 800, minHeight: 600, webPreferences: { preload, contextIsolation: true, nodeIntegration: false } }`
- Restore window bounds from config store
- Instantiate ClaudeService
- Call `registerIpcHandlers(claudeService)`
- Save window bounds on `close` event

**Step 4: Verify**

```bash
pnpm dev
```

Expected: App launches, no IPC errors in DevTools console.

**Step 5: Commit**

```bash
git add .
git commit -m "feat(m1): implement IPC bridge with contextBridge and handlers"
```

---

### Task 9: Validate stream-json Communication (E2E)

**Files:**
- Create: `scripts/test-stream-json.ts`
- Create: `scripts/test-stream-json-input.ts`

**Step 1: Create output-only test script**

```typescript
// scripts/test-stream-json.ts
// Run with: npx tsx scripts/test-stream-json.ts
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const proc = spawn('claude', ['--print', '--output-format', 'stream-json', '-p', 'Say hello in one word'], {
  stdio: ['pipe', 'pipe', 'pipe'],
})

const rl = createInterface({ input: proc.stdout! })
rl.on('line', (line) => {
  try {
    const parsed = JSON.parse(line)
    console.log(`[${parsed.type}]`, JSON.stringify(parsed).slice(0, 200))
  } catch { console.log('[raw]', line) }
})

proc.stderr?.on('data', (d) => console.error('[stderr]', d.toString()))
proc.on('exit', (code) => console.log('[exit]', code))
```

**Step 2: Run and verify output**

```bash
npx tsx scripts/test-stream-json.ts
```

Expected: See `[assistant]` events with text, then process exit 0.

**Step 3: Create bidirectional test script**

```typescript
// scripts/test-stream-json-input.ts
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const proc = spawn('claude', ['--print', '--output-format', 'stream-json', '--input-format', 'stream-json'], {
  stdio: ['pipe', 'pipe', 'pipe'],
})

const rl = createInterface({ input: proc.stdout! })
rl.on('line', (line) => {
  try {
    const parsed = JSON.parse(line)
    console.log(`[${parsed.type}]`, JSON.stringify(parsed).slice(0, 300))
  } catch { console.log('[raw]', line) }
})

proc.stderr?.on('data', (d) => console.error('[stderr]', d.toString()))
proc.on('exit', (code) => console.log('[exit]', code))

setTimeout(() => {
  const msg = JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'Say hello in one word' }] } })
  console.log('[sending]', msg)
  proc.stdin?.write(msg + '\n')
}, 1000)

setTimeout(() => proc.stdin?.end(), 5000)
```

**Step 4: Run and document findings**

```bash
npx tsx scripts/test-stream-json-input.ts
```

Document: actual stdin format, event types received, permission behavior.

**Step 5: Update ClaudeService if needed based on findings**

**Step 6: Commit**

```bash
git add .
git commit -m "feat(m1): validate stream-json communication with integration tests"
```

---

### Task 10: M1 Wrap-up — App Shell with CLI Status

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/main/index.ts`

**Step 1: Create minimal App shell proving IPC works**

```tsx
// src/renderer/App.tsx
import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'

export default function App() {
  const [status, setStatus] = useState('Checking...')

  useEffect(() => {
    window.electronAPI.app.checkCli().then((s) => {
      if (!s.installed) setStatus('Claude Code not installed')
      else if (!s.authenticated) setStatus(`Claude Code v${s.version} — Not authenticated`)
      else setStatus(`Claude Code v${s.version} — Ready`)
    })
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-pampas">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-serif text-gray-800">Cloak</h1>
        <p className="text-cloudy">{status}</p>
        <Button className="bg-terracotta hover:bg-terracotta-dark text-white">Get Started</Button>
      </div>
    </div>
  )
}
```

**Step 2: Verify end-to-end**

```bash
pnpm dev
```

Expected: Electron window shows "Cloak" with detected CLI status.

**Step 3: Commit + tag M0**

```bash
git add .
git commit -m "feat(m1): complete M1 — app shell with CLI detection and IPC"
git tag m1-complete
```

---

## M1 Verification Checklist

- [ ] `pnpm dev` launches Electron window
- [ ] Window shows correct CLI installation status
- [ ] Window shows correct auth status
- [ ] shadcn Button renders with Terracotta color
- [ ] `scripts/test-stream-json.ts` receives and parses events from Claude CLI
- [ ] All unit tests pass: `pnpm vitest run`
- [ ] Minimum window size 800x600 enforced

---

## M2: Chat UI

**Verification:** Type a message in InputArea, press Enter. See Claude's streaming response rendered as Markdown with code highlighting in a virtual-scrolled message list. Messages auto-scroll to bottom.

---

### Task 11: Implement Zustand Stores

**Files:**
- Modify: `src/renderer/stores/chat-store.ts`
- Modify: `src/renderer/stores/session-store.ts`
- Modify: `src/renderer/stores/project-store.ts`
- Modify: `src/renderer/stores/settings-store.ts`

Implement four Zustand stores matching types from `shared/types.ts`:

- **useChatStore:** `messages: ChatMessage[]`, `isStreaming: boolean`, `pendingPermission: PermissionRequest | null`, actions: `appendMessage`, `updateLastBlock`, `setStreaming`, `setPendingPermission`, `clearMessages`
- **useSessionStore:** `sessions: SessionMeta[]`, `activeSessionId: string | null`, actions: `setSessions`, `setActive`, `addSession`, `removeSession`
- **useProjectStore:** `projects: Project[]`, `activeProject: Project | null`, actions: `setProjects`, `setActive`, `addProject`
- **useSettingsStore:** `theme`, `fontSize`, `sidebarCollapsed`, actions: `setTheme`, `setFontSize`, `toggleSidebar` (synced to electron-store via IPC)

Write unit tests for each store's state transitions.

**Commit:** `feat(m2): implement Zustand stores for chat, session, project, settings`

---

### Task 12: Implement MainLayout + Sidebar Shell

**Files:**
- Modify: `src/renderer/components/layout/MainLayout.tsx`
- Modify: `src/renderer/components/layout/Sidebar.tsx`
- Modify: `src/renderer/App.tsx`

- MainLayout: `flex` container — Sidebar (240px, collapsible) + ChatArea (flex-1)
- Sidebar: 200ms width transition, placeholder content
- Responsive: listen to `window.resize`, auto-collapse sidebar when < 900px
- Wire `useSettingsStore.sidebarCollapsed`

**Verification:** Resize window below 900px → sidebar collapses. Toggle button restores it.

**Commit:** `feat(m2): implement MainLayout with collapsible sidebar`

---

### Task 13: Implement InputArea

**Files:**
- Modify: `src/renderer/components/chat/InputArea.tsx`

- Multi-line `<textarea>` with auto-resize (min 2 rows, max 10 rows)
- Enter sends message (calls `window.electronAPI.claude.sendMessage`), Shift+Enter inserts newline
- When `useChatStore.isStreaming === true`: show Stop button instead of Send button
- Stop button calls `window.electronAPI.claude.abort`

**Verification:** Type text → Enter sends → textarea clears. Shift+Enter adds newline. During streaming, button shows "Stop".

**Commit:** `feat(m2): implement InputArea with auto-resize and send/stop`

---

### Task 14: Implement MessageList with React Virtuoso

**Files:**
- Modify: `src/renderer/components/chat/MessageList.tsx`
- Modify: `src/renderer/components/chat/UserMessage.tsx`
- Modify: `src/renderer/components/chat/AssistantMessage.tsx`

Install dependency:
```bash
pnpm add react-virtuoso
```

- Use `<Virtuoso>` with `followOutput="smooth"` for auto-scroll to bottom
- `initialTopMostItemIndex` for loading at bottom
- UserMessage: right-aligned bubble, plain text
- AssistantMessage: left-aligned card, renders `blocks` array

**Verification:** Render 100+ messages → smooth scroll. New messages auto-scroll to bottom.

**Commit:** `feat(m2): implement MessageList with React Virtuoso virtual scrolling`

---

### Task 15: Implement MarkdownRenderer with Shiki

**Files:**
- Modify: `src/renderer/components/chat/MarkdownRenderer.tsx`

Install dependencies:
```bash
pnpm add react-markdown remark-gfm shiki
```

- `react-markdown` with `remark-gfm` plugin for tables, task lists, footnotes
- Custom `code` component using Shiki for syntax highlighting
- Lazy-load Shiki highlighter (async, show plain text while loading)
- Support streaming: component re-renders as content string grows

**Verification:** Send a message asking for code → see syntax-highlighted code block with Shiki. Tables render correctly.

**Commit:** `feat(m2): implement MarkdownRenderer with react-markdown and Shiki`

---

### Task 16: Wire Stream Events to Chat UI

**Files:**
- Modify: `src/renderer/App.tsx` (or a new `src/renderer/hooks/useStreamEvents.ts`)
- Modify: `src/renderer/stores/chat-store.ts`

- Subscribe to `window.electronAPI.claude.onStreamEvent` on mount
- Parse incoming events and map to `useChatStore` actions:
  - `message_start` → append new empty ChatMessage
  - `content_block_delta` (text_delta) → append text to current block
  - `content_block_start` (tool_use) → append tool_use block
  - `content_block_stop` → finalize block
  - `message_stop` / `result` → set `isStreaming = false`
- Cleanup subscription on unmount

**Verification:** Send a message → see real-time streaming text appear word by word in AssistantMessage.

**Commit:** `feat(m2): wire stream-json events to chat store and UI`

---

### Task 17: M1 Integration Test

- Send a real message through InputArea
- Verify stream-json events render as AssistantMessage with Markdown
- Verify code blocks have Shiki highlighting
- Verify virtual scroll works with 50+ messages
- Verify Stop button aborts mid-stream

**Commit + tag:**

```bash
git add .
git commit -m "feat(m2): complete M2 — chat UI with streaming Markdown rendering"
git tag m2-complete
```

---

## M2 Verification Checklist

- [ ] InputArea: Enter sends, Shift+Enter newlines, auto-resize works
- [ ] Messages render in virtual-scrolled list (React Virtuoso)
- [ ] Auto-scroll to bottom on new messages
- [ ] Claude responses stream in real-time (word by word)
- [ ] Markdown renders: headers, lists, tables, links, inline code
- [ ] Code blocks have Shiki syntax highlighting
- [ ] Stop button appears during streaming and aborts response
- [ ] Sidebar collapses/expands with 200ms transition

---

## M3: Permission System + Tool Cards + Diff View

**Verification:** Trigger a tool use (e.g., ask Claude to read a file). See ToolCard with risk badge. PermissionBar appears at bottom with Allow/Deny buttons. Press Y to allow, see result. For Edit operations, DiffView shows before/after.

---

### Task 18: Implement ThinkingBlock

**Files:**
- Modify: `src/renderer/components/chat/ThinkingBlock.tsx`

- Collapsible section for `thinking` content blocks
- Default collapsed, click to expand
- Muted styling to differentiate from main response

**Commit:** `feat(m3): implement collapsible ThinkingBlock`

---

### Task 19: Implement ToolCard

**Files:**
- Modify: `src/renderer/components/chat/ToolCard.tsx`

Install: `pnpm add lucide-react`

- Collapsible card: header shows icon + tool name + operation summary
- Risk level color coding: low=blue/gray, medium=orange, high=red
- Expand to show full input params (JSON formatted) and execution result
- Tool-specific icons from lucide-react (FileText for Read, Pencil for Edit, Terminal for Bash, Search for Grep)

**Commit:** `feat(m3): implement ToolCard with risk-level color coding`

---

### Task 20: Implement PermissionBar

**Files:**
- Modify: `src/renderer/components/chat/PermissionBar.tsx`

- Fixed bottom bar, appears when `useChatStore.pendingPermission` is set
- Shows: operation description, risk badge, Allow (green) and Deny (gray) buttons
- Keyboard shortcuts: Y to allow, N to deny (listen on `document.keydown` when permission pending)
- Blocks InputArea from sending but does NOT block message stream display
- Calls `window.electronAPI.claude.confirmPermission(toolUseId, allow)`

**Commit:** `feat(m3): implement PermissionBar with keyboard shortcuts`

---

### Task 21: Implement DiffView

**Files:**
- Modify: `src/renderer/components/chat/DiffView.tsx`

Install: `pnpm add react-diff-viewer-continued`

- Embedded inside ToolCard for Edit/Write tool results
- Extract `old_string` and `new_string` from Edit tool input params
- Toggle between unified and split view
- Use Cloak color theme for diff colors

**Commit:** `feat(m3): implement DiffView with react-diff-viewer-continued`

---

### Task 22: Implement Auto-Accept Mode

**Files:**
- Modify: `src/renderer/components/chat/InputArea.tsx` (add AutoAcceptBanner above)
- Modify: `src/renderer/stores/settings-store.ts`
- Modify: `src/main/services/claude-service.ts`

- Global toggle via `useSettingsStore` synced to electron-store
- When enabled: ClaudeService passes `--allowedTools` flag, no PermissionBar appears
- Yellow warning banner above InputArea: "Auto-accept mode enabled — Claude will execute all operations automatically"
- Tool cards show "Auto-accepted" badge instead of requiring confirmation
- First time enabling: show confirmation dialog (shadcn AlertDialog)

**Commit:** `feat(m3): implement auto-accept mode with warning banner`

---

### Task 23: M2 Integration Test

- Ask Claude to read a file → ToolCard appears with blue/low-risk badge
- PermissionBar shows → press Y → result appears in ToolCard
- Ask Claude to edit a file → DiffView renders inside ToolCard
- Toggle auto-accept → warning banner appears → tools auto-accepted
- Press N to deny a tool → Claude continues without executing

**Commit + tag:**

```bash
git add .
git commit -m "feat(m3): complete M3 — permission system, tool cards, diff view"
git tag m3-complete
```

---

## M3 Verification Checklist

- [ ] ThinkingBlock collapses/expands
- [ ] ToolCard shows correct icon and risk color per tool type
- [ ] ToolCard expands to show full input/output
- [ ] PermissionBar appears for tool_use events
- [ ] Y/N keyboard shortcuts work for allow/deny
- [ ] DiffView renders for Edit operations (unified + split toggle)
- [ ] Auto-accept mode: warning banner shown, tools auto-approved
- [ ] First-time auto-accept shows confirmation dialog

---

## M4: Sidebar + Session History + Project Management + Settings

**Verification:** Open app → AuthGate detects CLI/auth status. Select a project from sidebar → see its session history. Click a session → load its messages. Create new session. Open Settings overlay with Cmd+, → change theme and font size.

---

### Task 24: Implement SessionManager (Main Process)

**Files:**
- Modify: `src/main/services/session-manager.ts`
- Create: `src/main/__tests__/session-manager.test.ts`

- Scan `~/.claude/projects/<encoded-cwd>/*.jsonl` for sessions
- Use `extractSessionMeta` from jsonl-parser for metadata
- Reference `~/.claude/history.jsonl` for global index
- CRUD: create (generate UUID), load (parse JSONL → ChatMessage[]), delete (remove file)
- Path encoding: non-alphanumeric chars → `-`

Write tests for path encoding and metadata extraction.

**Commit:** `feat(m4): implement SessionManager with JSONL scanning`

---

### Task 25: Implement ProjectManager (Main Process)

**Files:**
- Modify: `src/main/services/project-manager.ts`

- Project registry stored in electron-store `projects` field
- Add project: validate path exists, store `{ name: basename, autoAccept: false, claudeArgs: [] }`
- Remove project: delete from store
- Detect CLAUDE.md: `fs.existsSync(path.join(projectPath, 'CLAUDE.md'))`
- Read CLAUDE.md content for display
- Wire IPC handlers: `PROJECT_LIST`, `PROJECT_ADD`, `PROJECT_CLAUDE_MD`

**Commit:** `feat(m4): implement ProjectManager with project registry`

---

### Task 26: Implement Sidebar with SessionList

**Files:**
- Modify: `src/renderer/components/layout/Sidebar.tsx`

- ProjectSelector at top (dropdown with search, "Add Project" button using `dialog.showOpenDialog`)
- NewSessionButton
- SessionSearch (text filter)
- SessionList using React Virtuoso — shows `SessionItem` with title, project name, last active time
- Active session highlighted with Terracotta accent
- Right-click or swipe to delete session (with confirmation dialog)
- Wire to `useSessionStore`

**Commit:** `feat(m4): implement Sidebar with project selector and session list`

---

### Task 27: Implement AuthGate

**Files:**
- Modify: `src/renderer/components/auth/AuthGate.tsx`
- Modify: `src/renderer/components/auth/InstallGuide.tsx`
- Modify: `src/renderer/components/auth/LoginGuide.tsx`
- Modify: `src/renderer/App.tsx`

Install: `pnpm add @xterm/xterm @xterm/addon-fit node-pty`

- AuthGate wraps MainLayout — checks CLI + auth on mount
- Not installed → show InstallGuide (instructions + link)
- Not authenticated → show LoginGuide with embedded xterm.js terminal running `claude auth login`
- Authenticated → render MainLayout
- Auto-load last opened project on auth success

**Commit:** `feat(m4): implement AuthGate with install guide and login terminal`

---

### Task 28: Implement SettingsOverlay

**Files:**
- Modify: `src/renderer/components/settings/SettingsOverlay.tsx`

- Full-screen overlay (z-50, backdrop blur), triggered by Cmd+, or settings icon
- Sections:
  - Appearance: theme toggle (light/dark/system), font size slider (12-20)
  - Claude Code: binary path (auto-detect + manual), default launch args
  - Auto-Accept: global toggle with risk explanation
  - Keyboard Shortcuts: display defaults, allow rebinding
- All changes persisted via `window.electronAPI.config.set`
- Close with Escape or X button

**Commit:** `feat(m4): implement SettingsOverlay with theme, font, and shortcuts`

---

### Task 29: M3 Integration Test

- Full flow: launch → AuthGate → project selection → session history loads
- Click session → messages render in ChatArea
- New session → empty chat, can send message
- Delete session → removed from list
- Settings → change theme → UI updates
- Cmd+, opens settings, Escape closes

**Commit + tag:**

```bash
git add .
git commit -m "feat(m4): complete M4 — sidebar, sessions, projects, settings"
git tag m4-complete
```

---

## M4 Verification Checklist

- [ ] AuthGate: shows InstallGuide if CLI missing
- [ ] AuthGate: shows LoginGuide with terminal if unauthenticated
- [ ] AuthGate: proceeds to MainLayout when authenticated
- [ ] ProjectSelector: lists projects, add via folder picker
- [ ] SessionList: shows sessions sorted by lastActive
- [ ] Session titles: custom-title preferred, fallback to first message
- [ ] Click session → loads message history
- [ ] New session → empty chat ready
- [ ] Delete session → confirmation → removed
- [ ] Settings: theme toggle works (light/dark/system)
- [ ] Settings: font size slider updates UI
- [ ] Cmd+, opens settings, Escape closes

---

## M5: Packaging + Polish

**Verification:** `pnpm build && pnpm electron-builder --mac` produces a .dmg file. Install it, launch, and complete a full conversation with Claude Code.

---

### Task 30: Window State Persistence

**Files:**
- Modify: `src/main/index.ts`

- Save window bounds (`x, y, width, height`) to electron-store on `close` and `resize` (debounced 500ms)
- Restore bounds on startup
- Save/restore sidebar collapsed state

**Commit:** `feat(m5): implement window state persistence`

---

### Task 31: Dark Theme

**Files:**
- Modify: `src/renderer/styles/globals.css`
- Modify: components as needed

- Add dark theme CSS variables via Tailwind v4 `@theme`
- Warm dark gray base (not pure black) — e.g., `#1C1917`
- Apply `dark:` Tailwind variants throughout components
- Respect `prefers-color-scheme` when theme is "system"
- Respect `reduceMotion` setting (disable transitions when true)

**Commit:** `feat(m5): implement dark theme and reduced motion support`

---

### Task 32: Configure electron-builder

**Files:**
- Create/modify: `electron-builder.yml`
- Modify: `package.json` build scripts

```yaml
# electron-builder.yml
appId: com.cloak.app
productName: Cloak
mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch:
        - universal
dmg:
  title: Cloak
  iconSize: 80
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications
```

Build scripts in `package.json`:
```json
{
  "scripts": {
    "build": "electron-vite build",
    "package": "electron-vite build && electron-builder --mac"
  }
}
```

Install: `pnpm add -D electron-builder`

**Commit:** `feat(m5): configure electron-builder for macOS dmg`

---

### Task 33: Implement UpdateService (Optional)

**Files:**
- Create: `src/main/services/update-service.ts`

Install: `pnpm add electron-updater`

- Check for updates on startup via `autoUpdater.checkForUpdates()`
- GitHub Releases as update source
- Emit event to renderer when update available
- UI: subtle badge/notification, not forced update
- Note: without code signing, auto-update won't work on macOS — this is prep for post-MVP signing

**Commit:** `feat(m5): implement UpdateService with electron-updater`

---

### Task 34: Design Polish + Accessibility

- Verify Pampas/Terracotta color scheme consistency across all components
- ARIA labels on all interactive elements
- Keyboard navigation: Tab through sidebar items, chat messages
- Animation: 150ms ease-out for messages appearing, 200ms for sidebar/PermissionBar
- `prefers-reduced-motion` disables all animations
- Focus rings on buttons and inputs

**Commit:** `feat(m5): design polish, accessibility, and animation system`

---

### Task 35: Final Testing + Build

**Step 1: Performance verification**

- Render 1000+ messages → verify smooth virtual scroll
- Memory: check < 400MB under active conversation (DevTools → Memory tab)
- Cold start: measure time to interactive < 3 seconds

**Step 2: Full E2E test**

- Launch → auth → select project → new session → send message → streaming response → tool use → permission → diff view → switch session → settings → close

**Step 3: Build and package**

```bash
pnpm build
pnpm electron-builder --mac
```

**Step 4: Verify .dmg**

- Open .dmg → drag to Applications → launch
- Complete a full conversation

**Step 5: Commit + tag**

```bash
git add .
git commit -m "feat(m5): complete M5 — packaging, polish, final testing"
git tag m5-complete
git tag v0.1.0
```

---

## M5 Verification Checklist

- [ ] Window bounds persist across restarts
- [ ] Sidebar collapsed state persists
- [ ] Dark theme renders correctly (warm gray, not pure black)
- [ ] System theme preference detected and applied
- [ ] Reduced motion setting disables all animations
- [ ] `.dmg` file produced by electron-builder
- [ ] App installs and launches from .dmg
- [ ] Full conversation flow works in packaged app
- [ ] 1000+ messages scroll smoothly
- [ ] Memory < 400MB under active use
- [ ] Cold start < 3 seconds
- [ ] All ARIA labels present on interactive elements

---

## Dependency Install Order

```bash
# M0: Scaffolding
pnpm add -D tailwindcss @tailwindcss/vite @types/node vitest

# M1: Core Service
pnpm add zustand electron-store@9

# M2: Chat UI
pnpm add react-markdown remark-gfm shiki react-virtuoso

# M3: Permissions + Diff
pnpm add lucide-react react-diff-viewer-continued

# M4: Auth + Terminal
pnpm add @xterm/xterm @xterm/addon-fit node-pty

# M5: Packaging
pnpm add -D electron-builder
pnpm add electron-updater
```
