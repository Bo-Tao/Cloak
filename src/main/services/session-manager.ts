import { readdir, readFile, unlink, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ChatMessage, SessionMeta } from '../../shared/types'
import { extractSessionMeta, extractChatMessages } from '../parsers/jsonl-parser'

/**
 * Encode a project path to match Claude Code's directory naming convention.
 * Non-alphanumeric chars become '-'.
 */
export function encodeProjectPath(projectPath: string): string {
  return projectPath.replace(/[^a-zA-Z0-9]/g, '-')
}

function getClaudeProjectsDir(): string {
  return join(homedir(), '.claude', 'projects')
}

function getSessionDir(projectPath: string): string {
  return join(getClaudeProjectsDir(), encodeProjectPath(projectPath))
}

export async function listSessions(projectPath: string): Promise<SessionMeta[]> {
  const dir = getSessionDir(projectPath)
  try {
    const files = await readdir(dir)
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl'))

    const sessions: SessionMeta[] = []
    for (const file of jsonlFiles) {
      const sessionId = file.replace('.jsonl', '')
      try {
        const content = await readFile(join(dir, file), 'utf-8')
        const lines = content.split('\n').filter((l) => l.trim())
        const meta = extractSessionMeta(lines, sessionId, projectPath)
        sessions.push(meta)
      } catch {
        // Skip unreadable files
      }
    }

    // Sort by lastActive descending
    sessions.sort((a, b) => {
      if (!a.lastActive && !b.lastActive) return 0
      if (!a.lastActive) return 1
      if (!b.lastActive) return -1
      return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
    })

    return sessions
  } catch {
    return []
  }
}

export async function loadSession(
  projectPath: string,
  sessionId: string,
): Promise<ChatMessage[]> {
  const filePath = join(getSessionDir(projectPath), `${sessionId}.jsonl`)
  try {
    const content = await readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter((l) => l.trim())
    return extractChatMessages(lines)
  } catch {
    return []
  }
}

export async function createSession(projectPath: string): Promise<string> {
  // Simply generate a UUID — the JSONL file will be created by Claude CLI when messages are sent
  return crypto.randomUUID()
}

export async function deleteSession(
  projectPath: string,
  sessionId: string,
): Promise<void> {
  const filePath = join(getSessionDir(projectPath), `${sessionId}.jsonl`)
  try {
    await unlink(filePath)
  } catch {
    // File may not exist
  }
}

/**
 * Get all projects that have session directories.
 */
export async function discoverProjects(): Promise<string[]> {
  const dir = getClaudeProjectsDir()
  try {
    const entries = await readdir(dir)
    const projects: string[] = []
    for (const entry of entries) {
      const fullPath = join(dir, entry)
      const s = await stat(fullPath).catch(() => null)
      if (s?.isDirectory()) {
        // Decode directory name back to path (approximate)
        projects.push(entry)
      }
    }
    return projects
  } catch {
    return []
  }
}
