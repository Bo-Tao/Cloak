# Cloak Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a desktop GUI for Claude Code CLI using Electron, covering M0 through M4 milestones.

**Architecture:** Electron dual-process model. Main process manages Claude Code child processes (per-turn `--print --output-format stream-json`), JSONL parsing, and config persistence. Renderer process uses React 19 + Zustand for UI. Communication via contextBridge IPC.

**Tech Stack:** electron-vite, React 19, TypeScript, Tailwind CSS, shadcn/ui, Zustand, electron-store, electron-builder

**Key Design Decisions:**
- CLI communication uses `--print --output-format stream-json` (per-turn process, not persistent)
- Session data reads Claude Code's native JSONL files at `~/.claude/projects/`
- Permission handling requires M0 validation (--print mode has no interactive prompts)
- MVP ships without macOS code signing

---

## M0: Scaffolding + Core Service

### Task 1: Initialize electron-vite Project

**Files:**
- Create: entire project scaffold via `create-electron-vite`
- Modify: `package.json` (add dependencies)
- Modify: `electron.vite.config.ts` (configure paths)

**Step 1: Scaffold project**

Run:
```bash
cd /Users/botao/SP/Cloak
npx create-electron-vite@latest . --template react-ts
```

If the scaffolder refuses to write into a non-empty directory, move existing files aside first:
```bash
mkdir -p /tmp/cloak-backup
mv LICENSE Cloak-PRD-v1.0.md docs /tmp/cloak-backup/
npx create-electron-vite@latest . --template react-ts
mv /tmp/cloak-backup/* .
```

Expected: Project scaffold with `src/main/`, `src/preload/`, `src/renderer/`, `electron.vite.config.ts`

**Step 2: Install core dependencies**

```bash
pnpm add zustand electron-store
pnpm add -D tailwindcss @tailwindcss/vite postcss autoprefixer
pnpm add -D @types/node
```

**Step 3: Verify dev server starts**

```bash
pnpm dev
```

Expected: Electron window opens with default React template

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(m0): initialize electron-vite project with React + TypeScript"
```

---

### Task 2: Configure Tailwind CSS + shadcn/ui

**Files:**
- Create: `src/renderer/styles/globals.css`
- Modify: `src/renderer/index.html` (link CSS)
- Modify: `tsconfig.json` (path aliases for shadcn)
- Create: `components.json` (shadcn config)

**Step 1: Set up Tailwind CSS**

Create `src/renderer/styles/globals.css`:
```css
@import "tailwindcss";
```

Import in renderer entry (`src/renderer/main.tsx` or `src/renderer/index.tsx`):
```typescript
import './styles/globals.css'
```

Configure `electron.vite.config.ts` renderer section to use @tailwindcss/vite plugin:
```typescript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // ...
  renderer: {
    plugins: [react(), tailwindcss()],
    // ...
  }
})
```

**Step 2: Initialize shadcn/ui**

```bash
cd src/renderer
npx shadcn@latest init
```

Select: TypeScript, Default style, CSS variables for colors.

Verify `components.json` is created and `src/renderer/components/ui/` directory exists.

**Step 3: Install a test component to verify**

```bash
npx shadcn@latest add button
```

Use the Button component in the default App.tsx to verify it renders correctly.

**Step 4: Verify**

```bash
pnpm dev
```

Expected: Electron window shows styled shadcn Button component with Tailwind classes applied.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(m0): configure Tailwind CSS and shadcn/ui"
```

---

### Task 3: Set Up Project Directory Structure

**Files:**
- Create directory structure under `src/main/` and `src/renderer/`

**Step 1: Create Main Process structure**

```
src/main/
├── index.ts              # Main process entry (already exists)
├── services/
│   ├── claude-service.ts # ClaudeService - CLI child process management
│   ├── session-manager.ts # SessionManager - session CRUD
│   ├── project-manager.ts # ProjectManager - project registry
│   ├── auth-checker.ts    # AuthChecker - CLI + auth detection
│   └── config-store.ts    # electron-store wrapper with typed schema
├── ipc/
│   ├── handlers.ts        # IPC handler registration
│   └── channels.ts        # Channel name constants (shared types)
└── parsers/
    └── jsonl-parser.ts    # JSONL file + stream-json event parser
```

**Step 2: Create Renderer structure**

```
src/renderer/
├── App.tsx
├── main.tsx
├── styles/
│   └── globals.css
├── components/
│   ├── ui/               # shadcn components (auto-generated)
│   ├── layout/
│   │   ├── MainLayout.tsx
│   │   └── Sidebar.tsx
│   ├── chat/
│   │   ├── ChatArea.tsx
│   │   ├── MessageList.tsx
│   │   ├── UserMessage.tsx
│   │   ├── AssistantMessage.tsx
│   │   ├── ToolCard.tsx
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
├── lib/
│   └── utils.ts          # shadcn utility (cn function)
└── types/
    └── index.ts           # Shared TypeScript types
```

**Step 3: Create Preload structure**

```
src/preload/
├── index.ts              # contextBridge API exposure
└── types.ts              # API type definitions (shared with renderer)
```

**Step 4: Create shared types file**

Create `src/shared/types.ts` for types used across main, preload, and renderer:

```typescript
// Message types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  timestamp: string
  blocks: ContentBlock[]
}

export type ContentBlock =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; toolId: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; toolId: string; output: string; error?: string }
  | { type: 'thinking'; content: string }

export interface PermissionRequest {
  toolUseId: string
  toolName: string
  input: Record<string, unknown>
  riskLevel: 'low' | 'medium' | 'high'
}

// Session types
export interface SessionMeta {
  id: string
  title: string
  projectPath: string
  lastActive: string
  messageCount: number
}

// Project types
export interface Project {
  path: string
  name: string
  autoAccept: boolean
  claudeArgs: string[]
}

// IPC Channel names
export const IPC_CHANNELS = {
  CLAUDE_SEND: 'claude:send-message',
  CLAUDE_STREAM: 'claude:stream-event',
  CLAUDE_ABORT: 'claude:abort',
  CLAUDE_CONFIRM: 'claude:confirm-tool',
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
} as const
```

**Step 5: Create placeholder files**

Create each file listed above with minimal exports (empty functions/components) so imports don't break.

**Step 6: Verify build**

```bash
pnpm dev
```

Expected: App still launches without import errors.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(m0): establish project directory structure and shared types"
```

---

### Task 4: Implement Config Store

**Files:**
- Modify: `src/main/services/config-store.ts`
- Create: `src/main/__tests__/config-store.test.ts`

**Step 1: Write test**

```typescript
// src/main/__tests__/config-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'

// We'll test the config schema and defaults
describe('ConfigStore', () => {
  it('should have correct default values', () => {
    const defaults = getConfigDefaults()
    expect(defaults.theme).toBe('system')
    expect(defaults.fontSize).toBe(14)
    expect(defaults.globalAutoAccept).toBe(false)
    expect(defaults.sidebarCollapsed).toBe(false)
    expect(defaults.reduceMotion).toBe(false)
  })

  it('should validate fontSize range', () => {
    expect(isValidFontSize(12)).toBe(true)
    expect(isValidFontSize(20)).toBe(true)
    expect(isValidFontSize(11)).toBe(false)
    expect(isValidFontSize(21)).toBe(false)
  })
})
```

**Step 2: Run test, verify it fails**

```bash
pnpm vitest run src/main/__tests__/config-store.test.ts
```

Note: vitest may need to be installed and configured first. Add to package.json:
```bash
pnpm add -D vitest
```

**Step 3: Implement config-store.ts**

```typescript
// src/main/services/config-store.ts
import Store from 'electron-store'

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
    store = new Store<AppConfig>({
      name: 'config',
      defaults: getConfigDefaults(),
    })
  }
  return store
}
```

**Step 4: Run test, verify it passes**

```bash
pnpm vitest run src/main/__tests__/config-store.test.ts
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(m0): implement config store with electron-store"
```

---

### Task 5: Implement AuthChecker

**Files:**
- Modify: `src/main/services/auth-checker.ts`
- Create: `src/main/__tests__/auth-checker.test.ts`

**Step 1: Write test**

```typescript
// src/main/__tests__/auth-checker.test.ts
import { describe, it, expect, vi } from 'vitest'
import { parseVersionOutput, parseAuthOutput } from '../services/auth-checker'

describe('AuthChecker parsing', () => {
  it('should parse claude version output', () => {
    const result = parseVersionOutput('1.0.40 (Claude Code)\n')
    expect(result).toEqual({ installed: true, version: '1.0.40' })
  })

  it('should detect missing CLI', () => {
    const result = parseVersionOutput('')
    expect(result).toEqual({ installed: false, version: null })
  })

  it('should parse authenticated status', () => {
    const result = parseAuthOutput('Logged in as user@example.com\n')
    expect(result).toEqual({ authenticated: true })
  })

  it('should detect unauthenticated', () => {
    const result = parseAuthOutput('Not logged in\n')
    expect(result).toEqual({ authenticated: false })
  })
})
```

**Step 2: Run test, verify it fails**

```bash
pnpm vitest run src/main/__tests__/auth-checker.test.ts
```

**Step 3: Implement auth-checker.ts**

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
}

export function parseVersionOutput(stdout: string): CliStatus {
  const trimmed = stdout.trim()
  if (!trimmed) return { installed: false, version: null }
  const match = trimmed.match(/^([\d.]+)/)
  return match
    ? { installed: true, version: match[1] }
    : { installed: false, version: null }
}

export function parseAuthOutput(stdout: string): AuthStatus {
  const trimmed = stdout.trim().toLowerCase()
  return { authenticated: !trimmed.includes('not logged in') && trimmed.length > 0 }
}

function getClaudePath(): string {
  const store = getStore()
  return store.get('claudeBinaryPath') || 'claude'
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
    return parseAuthOutput(stdout)
  } catch {
    return { authenticated: false }
  }
}
```

**Step 4: Run test, verify it passes**

```bash
pnpm vitest run src/main/__tests__/auth-checker.test.ts
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(m0): implement AuthChecker with CLI and auth detection"
```

---

### Task 6: Implement JSONL Parser

**Files:**
- Modify: `src/main/parsers/jsonl-parser.ts`
- Create: `src/main/__tests__/jsonl-parser.test.ts`

**Step 1: Write test**

```typescript
// src/main/__tests__/jsonl-parser.test.ts
import { describe, it, expect } from 'vitest'
import { parseJsonlLine, extractSessionMeta, extractChatMessages } from '../parsers/jsonl-parser'

describe('JSONL Parser', () => {
  it('should parse an assistant text event', () => {
    const line = JSON.stringify({
      type: 'assistant',
      uuid: 'abc-123',
      timestamp: '2026-03-09T10:00:00Z',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello world' }],
        stop_reason: 'end_turn',
      },
    })
    const event = parseJsonlLine(line)
    expect(event).not.toBeNull()
    expect(event!.type).toBe('assistant')
  })

  it('should parse an assistant tool_use event', () => {
    const line = JSON.stringify({
      type: 'assistant',
      uuid: 'abc-456',
      timestamp: '2026-03-09T10:01:00Z',
      message: {
        role: 'assistant',
        content: [{
          type: 'tool_use',
          id: 'tool-1',
          name: 'Read',
          input: { file_path: '/tmp/test.txt' },
        }],
      },
    })
    const event = parseJsonlLine(line)
    expect(event).not.toBeNull()
    expect(event!.type).toBe('assistant')
  })

  it('should ignore progress events', () => {
    const line = JSON.stringify({ type: 'progress', data: {} })
    const event = parseJsonlLine(line)
    expect(event).toBeNull()
  })

  it('should extract session title from custom-title record', () => {
    const lines = [
      JSON.stringify({ type: 'user', uuid: '1', timestamp: '2026-03-09T10:00:00Z', message: { role: 'user', content: [{ type: 'text', text: 'This is a very long first message that should be truncated' }] } }),
      JSON.stringify({ type: 'custom-title', customTitle: 'My Custom Title', sessionId: 'sess-1' }),
    ]
    const meta = extractSessionMeta(lines, 'sess-1', '/project')
    expect(meta.title).toBe('My Custom Title')
  })

  it('should fallback to first user message for title', () => {
    const lines = [
      JSON.stringify({ type: 'user', uuid: '1', timestamp: '2026-03-09T10:00:00Z', message: { role: 'user', content: [{ type: 'text', text: 'This is a very long first message that should be truncated after thirty' }] } }),
    ]
    const meta = extractSessionMeta(lines, 'sess-2', '/project')
    expect(meta.title.length).toBeLessThanOrEqual(30)
  })

  it('should convert JSONL lines to ChatMessage array', () => {
    const lines = [
      JSON.stringify({ type: 'user', uuid: 'u1', timestamp: '2026-03-09T10:00:00Z', message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] } }),
      JSON.stringify({ type: 'assistant', uuid: 'a1', timestamp: '2026-03-09T10:00:01Z', message: { role: 'assistant', content: [{ type: 'text', text: 'Hi there' }] } }),
      JSON.stringify({ type: 'progress', data: {} }),
    ]
    const messages = extractChatMessages(lines)
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[1].role).toBe('assistant')
  })
})
```

**Step 2: Run test, verify it fails**

```bash
pnpm vitest run src/main/__tests__/jsonl-parser.test.ts
```

**Step 3: Implement jsonl-parser.ts**

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
      type: string
      text?: string
      id?: string
      name?: string
      input?: Record<string, unknown>
      content?: unknown
    }>
    stop_reason?: string | null
    usage?: Record<string, number>
  }
  customTitle?: string
  [key: string]: unknown
}

const RENDERABLE_TYPES = new Set(['user', 'assistant'])

export function parseJsonlLine(line: string): RawEvent | null {
  try {
    const parsed: RawEvent = JSON.parse(line)
    if (!RENDERABLE_TYPES.has(parsed.type) && parsed.type !== 'custom-title') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

function rawContentToBlocks(content: RawEvent['message']): ContentBlock[] {
  if (!content?.content) return []
  return content.content
    .map((block): ContentBlock | null => {
      switch (block.type) {
        case 'text':
          return { type: 'text', content: block.text || '' }
        case 'tool_use':
          return {
            type: 'tool_use',
            toolId: block.id || '',
            name: block.name || '',
            input: (block.input as Record<string, unknown>) || {},
          }
        case 'tool_result':
          return {
            type: 'tool_result',
            toolId: block.id || '',
            output: typeof block.content === 'string' ? block.content : JSON.stringify(block.content || ''),
          }
        case 'thinking':
          return { type: 'thinking', content: block.text || '' }
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
      if (parsed.type === 'custom-title' && parsed.customTitle) {
        title = parsed.customTitle
      }
      if (parsed.type === 'user' && !firstUserMsg && parsed.message?.content) {
        const textBlock = parsed.message.content.find((b) => b.type === 'text')
        if (textBlock?.text) {
          firstUserMsg = textBlock.text.slice(0, 30)
        }
      }
      if (parsed.timestamp) {
        lastTimestamp = parsed.timestamp
      }
      if (parsed.type === 'user' || parsed.type === 'assistant') {
        messageCount++
      }
    } catch {
      // skip malformed lines
    }
  }

  return {
    id: sessionId,
    title: title || firstUserMsg || 'Untitled',
    projectPath,
    lastActive: lastTimestamp,
    messageCount,
  }
}

export function extractChatMessages(lines: string[]): ChatMessage[] {
  const messages: ChatMessage[] = []

  for (const line of lines) {
    const event = parseJsonlLine(line)
    if (!event || !event.message) continue
    if (event.type !== 'user' && event.type !== 'assistant') continue

    const blocks = rawContentToBlocks(event.message)
    if (blocks.length === 0) continue

    messages.push({
      id: event.uuid || crypto.randomUUID(),
      role: event.type as 'user' | 'assistant',
      timestamp: event.timestamp || '',
      blocks,
    })
  }

  return messages
}
```

**Step 4: Run test, verify it passes**

```bash
pnpm vitest run src/main/__tests__/jsonl-parser.test.ts
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(m0): implement JSONL parser for session files and stream events"
```

---

### Task 7: Implement ClaudeService

**Files:**
- Modify: `src/main/services/claude-service.ts`
- Create: `src/main/__tests__/claude-service.test.ts`

**Step 1: Write test for risk level inference**

```typescript
// src/main/__tests__/claude-service.test.ts
import { describe, it, expect } from 'vitest'
import { inferRiskLevel, buildClaudeArgs } from '../services/claude-service'

describe('ClaudeService utilities', () => {
  it('should infer low risk for read tools', () => {
    expect(inferRiskLevel('Read')).toBe('low')
    expect(inferRiskLevel('Glob')).toBe('low')
    expect(inferRiskLevel('Grep')).toBe('low')
    expect(inferRiskLevel('WebSearch')).toBe('low')
  })

  it('should infer medium risk for write tools', () => {
    expect(inferRiskLevel('Write')).toBe('medium')
    expect(inferRiskLevel('Edit')).toBe('medium')
    expect(inferRiskLevel('NotebookEdit')).toBe('medium')
  })

  it('should infer high risk for bash tools', () => {
    expect(inferRiskLevel('Bash')).toBe('high')
  })

  it('should build correct args for new session', () => {
    const args = buildClaudeArgs({
      sessionId: undefined,
      cwd: '/project',
      extraArgs: [],
    })
    expect(args).toContain('--print')
    expect(args).toContain('--output-format')
    expect(args).toContain('stream-json')
  })

  it('should build correct args for resumed session', () => {
    const args = buildClaudeArgs({
      sessionId: 'sess-123',
      cwd: '/project',
      extraArgs: [],
    })
    expect(args).toContain('--resume')
    expect(args).toContain('sess-123')
  })
})
```

**Step 2: Run test, verify it fails**

```bash
pnpm vitest run src/main/__tests__/claude-service.test.ts
```

**Step 3: Implement claude-service.ts**

```typescript
// src/main/services/claude-service.ts
import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createInterface } from 'node:readline'
import { getStore } from './config-store'
import { parseJsonlLine } from '../parsers/jsonl-parser'

type RiskLevel = 'low' | 'medium' | 'high'

const LOW_RISK_TOOLS = new Set(['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'LS'])
const MEDIUM_RISK_TOOLS = new Set(['Write', 'Edit', 'NotebookEdit'])
const HIGH_RISK_TOOLS = new Set(['Bash'])

export function inferRiskLevel(toolName: string): RiskLevel {
  if (LOW_RISK_TOOLS.has(toolName)) return 'low'
  if (MEDIUM_RISK_TOOLS.has(toolName)) return 'medium'
  if (HIGH_RISK_TOOLS.has(toolName)) return 'high'
  return 'medium' // default to medium for unknown tools
}

interface BuildArgsOptions {
  sessionId?: string
  cwd: string
  extraArgs: string[]
}

export function buildClaudeArgs(options: BuildArgsOptions): string[] {
  const args = [
    '--print',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
  ]

  if (options.sessionId) {
    args.push('--resume', options.sessionId)
  }

  args.push(...options.extraArgs)

  return args
}

export class ClaudeService extends EventEmitter {
  private processes = new Map<string, ChildProcess>()

  private getClaudePath(): string {
    const store = getStore()
    return store.get('claudeBinaryPath') || 'claude'
  }

  async sendMessage(sessionId: string, message: string, cwd: string): Promise<void> {
    const existingProc = this.processes.get(sessionId)
    if (existingProc && !existingProc.killed) {
      // Write to existing process stdin
      existingProc.stdin?.write(JSON.stringify({ type: 'user', message }) + '\n')
      return
    }

    const store = getStore()
    const globalArgs = store.get('globalClaudeArgs') || []

    const args = buildClaudeArgs({
      sessionId,
      cwd,
      extraArgs: globalArgs,
    })

    const proc = spawn(this.getClaudePath(), args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })

    this.processes.set(sessionId, proc)

    // Read stdout line by line
    if (proc.stdout) {
      const rl = createInterface({ input: proc.stdout })
      rl.on('line', (line) => {
        const event = parseJsonlLine(line)
        if (event) {
          this.emit('stream-event', { sessionId, event })
        }
      })
    }

    // Read stderr for errors
    if (proc.stderr) {
      const rl = createInterface({ input: proc.stderr })
      rl.on('line', (line) => {
        this.emit('error', { sessionId, error: line })
      })
    }

    proc.on('exit', (code) => {
      this.processes.delete(sessionId)
      this.emit('exit', { sessionId, code })
    })

    // Send the user message via stdin
    proc.stdin?.write(JSON.stringify({ type: 'user', message }) + '\n')
  }

  abort(sessionId: string): void {
    const proc = this.processes.get(sessionId)
    if (proc && !proc.killed) {
      proc.kill('SIGINT')
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

**Step 4: Run test, verify it passes**

```bash
pnpm vitest run src/main/__tests__/claude-service.test.ts
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(m0): implement ClaudeService with stream-json child process management"
```

---

### Task 8: Implement IPC Bridge

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc/handlers.ts`
- Modify: `src/main/ipc/channels.ts`
- Modify: `src/main/index.ts`

**Step 1: Implement preload contextBridge**

```typescript
// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'

export const electronAPI = {
  claude: {
    sendMessage: (sessionId: string, text: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_SEND, sessionId, text),
    onStreamEvent: (cb: (event: unknown) => void) => {
      const handler = (_event: unknown, data: unknown) => cb(data)
      ipcRenderer.on(IPC_CHANNELS.CLAUDE_STREAM, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.CLAUDE_STREAM, handler)
    },
    abort: (sessionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_ABORT, sessionId),
    confirmTool: (toolUseId: string, allow: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.CLAUDE_CONFIRM, toolUseId, allow),
  },
  session: {
    list: (projectPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_LIST, projectPath),
    load: (sessionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_LOAD, sessionId),
    create: (projectPath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_CREATE, projectPath),
    delete: (sessionId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SESSION_DELETE, sessionId),
  },
  project: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),
    add: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.PROJECT_ADD, path),
    getClaudeMd: (path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CLAUDE_MD, path),
  },
  config: {
    get: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.CONFIG_GET, key),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke(IPC_CHANNELS.CONFIG_SET, key, value),
  },
  app: {
    checkCli: () => ipcRenderer.invoke(IPC_CHANNELS.APP_CHECK_CLI),
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
```

**Step 2: Implement IPC handlers in main**

```typescript
// src/main/ipc/handlers.ts
import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { ClaudeService } from '../services/claude-service'
import { checkCliInstalled, checkAuth } from '../services/auth-checker'
import { getStore } from '../services/config-store'

export function registerIpcHandlers(claudeService: ClaudeService): void {
  // App
  ipcMain.handle(IPC_CHANNELS.APP_CHECK_CLI, async () => {
    const cli = await checkCliInstalled()
    const auth = cli.installed ? await checkAuth() : { authenticated: false }
    return { ...cli, ...auth }
  })

  // Claude
  ipcMain.handle(IPC_CHANNELS.CLAUDE_SEND, async (_e, sessionId: string, text: string) => {
    const store = getStore()
    const lastProject = store.get('lastProjectId')
    const projects = store.get('projects')
    const cwd = (lastProject && projects[lastProject]?.name) ? lastProject : process.cwd()
    await claudeService.sendMessage(sessionId, text, cwd)
  })

  ipcMain.handle(IPC_CHANNELS.CLAUDE_ABORT, (_e, sessionId: string) => {
    claudeService.abort(sessionId)
  })

  // Config
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, (_e, key: string) => {
    const store = getStore()
    return store.get(key as keyof typeof store.store)
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_e, key: string, value: unknown) => {
    const store = getStore()
    store.set(key as string, value)
  })

  // Forward stream events to renderer
  claudeService.on('stream-event', (data) => {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      win.webContents.send(IPC_CHANNELS.CLAUDE_STREAM, data)
    }
  })
}
```

**Step 3: Wire up in main/index.ts**

Update `src/main/index.ts` to initialize services and register handlers at startup.

**Step 4: Verify**

```bash
pnpm dev
```

Expected: App launches, no IPC errors in console.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat(m0): implement IPC bridge with contextBridge and handlers"
```

---

### Task 9: M0 Integration — Validate stream-json Communication

**This is the critical validation task.** Send a real message to Claude Code and verify we receive stream-json output.

**Files:**
- Create: `src/main/__tests__/integration/claude-e2e.test.ts` (manual test script)

**Step 1: Create a manual test script**

```typescript
// scripts/test-stream-json.ts
// Run with: npx tsx scripts/test-stream-json.ts
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const proc = spawn('claude', [
  '--print',
  '--output-format', 'stream-json',
  '-p', 'Say hello in one word',
], {
  stdio: ['pipe', 'pipe', 'pipe'],
})

const rl = createInterface({ input: proc.stdout! })
rl.on('line', (line) => {
  try {
    const parsed = JSON.parse(line)
    console.log(`[${parsed.type}]`, JSON.stringify(parsed).slice(0, 200))
  } catch {
    console.log('[raw]', line)
  }
})

proc.stderr?.on('data', (data) => {
  console.error('[stderr]', data.toString())
})

proc.on('exit', (code) => {
  console.log('[exit]', code)
})
```

**Step 2: Run the test**

```bash
npx tsx scripts/test-stream-json.ts
```

Expected: See `[assistant]` events with text content, followed by process exit.

**Step 3: Test with --input-format stream-json**

Create a second test to verify bidirectional communication:

```typescript
// scripts/test-stream-json-input.ts
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const proc = spawn('claude', [
  '--print',
  '--output-format', 'stream-json',
  '--input-format', 'stream-json',
  '--replay-user-messages',
], {
  stdio: ['pipe', 'pipe', 'pipe'],
})

const rl = createInterface({ input: proc.stdout! })
rl.on('line', (line) => {
  try {
    const parsed = JSON.parse(line)
    console.log(`[${parsed.type}]`, JSON.stringify(parsed).slice(0, 300))
  } catch {
    console.log('[raw]', line)
  }
})

proc.stderr?.on('data', (data) => {
  console.error('[stderr]', data.toString())
})

proc.on('exit', (code) => {
  console.log('[exit]', code)
})

// Send a user message via stdin
setTimeout(() => {
  const msg = JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: 'Say hello in one word' }] } })
  console.log('[sending]', msg)
  proc.stdin?.write(msg + '\n')
}, 1000)

// Close stdin after message to signal end of input
setTimeout(() => {
  proc.stdin?.end()
}, 2000)
```

**Step 4: Run and document findings**

```bash
npx tsx scripts/test-stream-json-input.ts
```

Document:
- Does `--input-format stream-json` accept our JSON format?
- What exact format does stdin expect?
- How does the process behave?
- Are there permission prompts or does it auto-accept?

**Step 5: Update ClaudeService based on findings**

Adjust `claude-service.ts` based on the actual stdin format discovered.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(m0): validate stream-json communication with integration tests"
```

---

### Task 10: M0 Wrap-up — Basic App Shell

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/main/index.ts`

**Step 1: Create minimal App shell**

Replace the default React template with a basic layout that proves IPC works:

```tsx
// src/renderer/App.tsx
import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'

function App() {
  const [cliStatus, setCliStatus] = useState<string>('Checking...')

  useEffect(() => {
    window.electronAPI.app.checkCli().then((status) => {
      if (!status.installed) {
        setCliStatus('Claude Code not installed')
      } else if (!status.authenticated) {
        setCliStatus(`Claude Code v${status.version} — Not authenticated`)
      } else {
        setCliStatus(`Claude Code v${status.version} — Ready`)
      }
    })
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-[#F4F3EE]">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-serif text-gray-800">Cloak</h1>
        <p className="text-gray-600">{cliStatus}</p>
        <Button variant="default" className="bg-[#C15F3C] hover:bg-[#AE5630]">
          Get Started
        </Button>
      </div>
    </div>
  )
}

export default App
```

**Step 2: Configure main process window**

Update `src/main/index.ts` to:
- Set minimum window size 800x600
- Restore saved window bounds from config
- Initialize ClaudeService and register IPC handlers
- Set appropriate webPreferences (preload script, contextIsolation: true)

**Step 3: Verify end-to-end**

```bash
pnpm dev
```

Expected: Electron window shows "Cloak" with CLI status detection working.

**Step 4: Commit**

```bash
git add -A
git commit -m "feat(m0): complete M0 with basic app shell and IPC integration"
```

---

## M1: Chat UI

### Task 11: Implement Zustand Stores

**Files:** `src/renderer/stores/chat-store.ts`, `session-store.ts`, `project-store.ts`, `settings-store.ts`

Create four Zustand stores matching the types defined in `shared/types.ts`:
- `useChatStore`: messages array, isStreaming, pendingPermission, append/update methods
- `useSessionStore`: sessions array, activeSessionId, switching logic
- `useProjectStore`: projects array, activeProject
- `useSettingsStore`: theme, fontSize, shortcuts (synced with electron-store via IPC)

Write unit tests for each store's reducers/actions.

### Task 12: Implement MainLayout + Sidebar Shell

**Files:** `src/renderer/components/layout/MainLayout.tsx`, `Sidebar.tsx`

- MainLayout: flex container with Sidebar (240px) + ChatArea
- Sidebar: collapsible (200ms transition), project selector placeholder, session list placeholder
- Responsive: auto-collapse when window < 900px

### Task 13: Implement InputArea

**Files:** `src/renderer/components/chat/InputArea.tsx`

- Multi-line textarea (2-10 rows auto-resize)
- Enter sends, Shift+Enter newline
- Send button → Stop button when streaming
- Wire to `useChatStore` and `electronAPI.claude.sendMessage`

### Task 14: Implement MessageList with Virtual Scrolling

**Files:** `src/renderer/components/chat/MessageList.tsx`, `UserMessage.tsx`, `AssistantMessage.tsx`

- Use `@tanstack/react-virtual` for virtualized list
- Auto-scroll to bottom on new messages
- UserMessage: right-aligned bubble
- AssistantMessage: left-aligned card

### Task 15: Implement Markdown Renderer with Code Highlighting

**Files:** `src/renderer/components/chat/MarkdownRenderer.tsx`

- `react-markdown` + `remark-gfm` + Shiki for code blocks
- Streaming-friendly: render incrementally as text arrives
- Support tables, links, lists, inline code

### Task 16: Wire Up Stream Events to UI

Connect `electronAPI.claude.onStreamEvent` to `useChatStore`:
- Parse incoming events, update message blocks in real-time
- Handle streaming text (append to current text block)
- Handle tool_use blocks (create ToolCard entries)

### Task 17: M1 Integration Test

- Send a real message through the UI
- Verify stream-json events render as messages
- Test scrolling with many messages
- Commit M1

---

## M2: Permission System + Diff View

### Task 18: Implement ToolCard Component

**Files:** `src/renderer/components/chat/ToolCard.tsx`

- Collapsible card with icon + tool name + summary
- Color-coded by risk level (blue/orange/red)
- Expand to show full input params and result
- Different icons per tool type (lucide-react)

### Task 19: Implement PermissionBar

**Files:** `src/renderer/components/chat/PermissionBar.tsx`

- Fixed bottom bar when permission pending
- Shows operation description, risk badge, Allow/Deny buttons
- Keyboard shortcuts: Y to allow, N to deny
- Blocks input but not message stream display

### Task 20: Implement DiffView

**Files:** `src/renderer/components/chat/DiffView.tsx`

- `react-diff-viewer-continued` integration
- Extract old_string/new_string from Edit tool params
- Toggle between unified and split view
- Syntax highlighting in diff

### Task 21: Implement Auto-Accept Mode

- Global toggle in settings store
- Project-level override
- Yellow warning banner when active
- Tool cards marked "auto-accepted"
- First-time confirmation dialog

### Task 22: M2 Integration Test

- Trigger a tool use (file read/write)
- Verify PermissionBar appears
- Test allow/deny flow
- Test auto-accept mode
- Verify DiffView renders for Edit operations
- Commit M2

---

## M3: Multi-Project + Session History + Settings

### Task 23: Implement SessionManager

**Files:** `src/main/services/session-manager.ts`

- Scan `~/.claude/projects/` for JSONL files
- Map project paths to sessions
- Parse session metadata (title, lastActive)
- CRUD operations on sessions

### Task 24: Implement ProjectManager

**Files:** `src/main/services/project-manager.ts`

- Project registry in electron-store
- Add/remove projects via folder picker (`dialog.showOpenDialog`)
- Detect CLAUDE.md files
- Project-level config (autoAccept, claudeArgs)

### Task 25: Implement Sidebar SessionList

**Files:** `src/renderer/components/layout/Sidebar.tsx` (expand)

- Virtual scrolled session list
- Search/filter sessions
- New session button
- Delete session (with confirmation)
- Active session highlight

### Task 26: Implement ProjectSelector

**Files:** `src/renderer/components/layout/ProjectSelector.tsx`

- Dropdown with search
- Add project button (folder picker)
- Switch project → switch associated sessions
- Display CLAUDE.md status indicator

### Task 27: Implement Settings Overlay

**Files:** `src/renderer/components/settings/SettingsOverlay.tsx`

- Full-screen overlay (not route-based)
- Appearance: theme toggle, font size slider
- Claude Path: auto-detect + manual input
- Auto-Accept: global toggle
- Shortcuts: key binding editor
- Cmd+, to open

### Task 28: Implement AuthGate

**Files:** `src/renderer/components/auth/AuthGate.tsx`, `InstallGuide.tsx`, `LoginGuide.tsx`

- Check CLI + auth on startup
- InstallGuide: instructions + link if CLI missing
- LoginGuide: embedded xterm.js terminal for `claude auth login`

### Task 29: M3 Integration Test

- Full flow: open app → auth gate → project selection → session history → new chat
- Commit M3

---

## M4: Packaging + Polish

### Task 30: Configure electron-builder

**Files:** `electron-builder.yml` or `package.json` build config

- macOS: dmg output (universal binary)
- No code signing (MVP)
- App icon and metadata
- File associations (none for MVP)

### Task 31: Implement Window State Persistence

- Save window bounds on close/resize (debounced)
- Restore on startup
- Sidebar collapsed state persistence

### Task 32: Implement UpdateService (Optional for MVP)

**Files:** `src/main/services/update-service.ts`

- electron-updater with GitHub Releases
- Check for updates on startup
- UI notification for available updates
- Defer: can be added post-MVP if no signed binary

### Task 33: Design Polish

- Verify Pampas/Terracotta color scheme throughout
- Dark theme implementation
- Animation system (150-200ms transitions)
- prefers-reduced-motion support
- ARIA labels on key elements

### Task 34: Final Testing + Bug Fixes

- Test all flows end-to-end
- Performance: 1000+ messages virtual scroll
- Memory: verify < 400MB under load
- Cold start: verify < 3 seconds

### Task 35: Build and Package

```bash
pnpm build
pnpm electron-builder --mac
```

- Verify .dmg installs and launches correctly
- Test on both Apple Silicon and Intel (if universal binary)
- Commit M4 and tag release

---

## Dependency Install Order

```bash
# Core (Task 1)
pnpm add react react-dom zustand electron-store
pnpm add -D electron electron-vite vite typescript @types/node

# Styling (Task 2)
pnpm add -D tailwindcss @tailwindcss/vite postcss autoprefixer
# shadcn/ui components installed individually

# Testing
pnpm add -D vitest

# M1 Dependencies (Tasks 11-17)
pnpm add react-markdown remark-gfm rehype-highlight shiki
pnpm add @tanstack/react-virtual
pnpm add lucide-react

# M2 Dependencies (Tasks 18-22)
pnpm add react-diff-viewer-continued

# M3 Dependencies (Tasks 23-29)
pnpm add @xterm/xterm @xterm/addon-fit

# M4 Dependencies (Tasks 30-35)
pnpm add -D electron-builder
pnpm add electron-updater
```
