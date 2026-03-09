import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

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
    }
  } catch {
    return { authenticated: false, email: null }
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
  try {
    const { stdout } = await execFileAsync(claudePath, ['auth', 'status'])
    return parseAuthStatusJson(stdout)
  } catch {
    return { authenticated: false, email: null }
  }
}
