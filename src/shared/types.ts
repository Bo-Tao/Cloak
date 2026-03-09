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
  | {
      type: 'tool_use'
      toolId: string
      name: string
      input: Record<string, unknown>
    }
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
  projects: Record<
    string,
    { name: string; autoAccept: boolean; claudeArgs: string[] }
  >
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
  APP_SELECT_FOLDER: 'app:select-folder',
  APP_UPDATE_AVAILABLE: 'app:update-available',
  APP_UPDATE_DOWNLOADED: 'app:update-downloaded',
  APP_CHECK_UPDATE: 'app:check-update',
  APP_INSTALL_UPDATE: 'app:install-update',
} as const
