import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface CliStatus {
  installed: boolean
  version: string | null
}

export interface AuthStatus {
  authenticated: boolean
  email: string | null
  authMethod: 'oauth' | 'api_billing' | null
}

export function parseVersionOutput(stdout: string): CliStatus {
  const trimmed = stdout.trim()
  if (!trimmed) return { installed: false, version: null }
  const match = trimmed.match(/^([\d.]+)/)
  return match
    ? { installed: true, version: match[1] }
    : { installed: false, version: null }
}

export function parseAuthStatusJson(stdout: string): AuthStatus {
  try {
    const data = JSON.parse(stdout.trim())
    return {
      authenticated: data.authenticated === true,
      email: data.email ?? null,
      authMethod: null,
    }
  } catch {
    return { authenticated: false, email: null, authMethod: null }
  }
}

export function parseClaudeJson(content: string): AuthStatus {
  try {
    const data = JSON.parse(content)
    if (data.oauthAccount) {
      return {
        authenticated: true,
        email: data.oauthAccount.emailAddress ?? null,
        authMethod: 'oauth',
      }
    }
  } catch {
    // ignore parse errors
  }
  return { authenticated: false, email: null, authMethod: null }
}

export function parseClaudeSettings(content: string): AuthStatus {
  try {
    const data = JSON.parse(content)
    const env = data.env
    if (env && env.ANTHROPIC_BASE_URL && env.ANTHROPIC_AUTH_TOKEN) {
      return {
        authenticated: true,
        email: null,
        authMethod: 'api_billing',
      }
    }
  } catch {
    // ignore parse errors
  }
  return { authenticated: false, email: null, authMethod: null }
}

async function readClaudeSettings(): Promise<AuthStatus> {
  try {
    const content = await readFile(join(homedir(), '.claude', 'settings.json'), 'utf-8')
    return parseClaudeSettings(content)
  } catch {
    return { authenticated: false, email: null, authMethod: null }
  }
}

async function readClaudeJson(): Promise<AuthStatus> {
  try {
    const content = await readFile(join(homedir(), '.claude.json'), 'utf-8')
    return parseClaudeJson(content)
  } catch {
    return { authenticated: false, email: null, authMethod: null }
  }
}

export async function checkCliInstalled(
  claudePath = 'claude',
): Promise<CliStatus> {
  try {
    const { stdout } = await execFileAsync(claudePath, ['--version'])
    return parseVersionOutput(stdout)
  } catch {
    return { installed: false, version: null }
  }
}

export async function checkAuth(claudePath = 'claude'): Promise<AuthStatus> {
  // 1. Check settings.json for API billing
  const settingsResult = await readClaudeSettings()
  if (settingsResult.authenticated) return settingsResult

  // 2. Check ~/.claude.json for OAuth
  const jsonResult = await readClaudeJson()
  if (jsonResult.authenticated) return jsonResult

  // 3. Fallback to CLI
  try {
    const { stdout } = await execFileAsync(claudePath, ['auth', 'status'])
    return parseAuthStatusJson(stdout)
  } catch {
    return { authenticated: false, email: null, authMethod: null }
  }
}
