import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { createInterface } from 'node:readline'
import type { RiskLevel } from '../../shared/types'

const LOW_RISK = new Set([
  'Read',
  'Glob',
  'Grep',
  'WebSearch',
  'WebFetch',
  'LS',
])
const MEDIUM_RISK = new Set(['Write', 'Edit', 'NotebookEdit'])

export function inferRiskLevel(
  toolName: string,
  _input: Record<string, unknown>,
): RiskLevel {
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
  const args = [
    '--print',
    '--output-format',
    'stream-json',
    '--input-format',
    'stream-json',
  ]
  if (opts.sessionId) args.push('--resume', opts.sessionId)
  if (opts.autoAccept)
    args.push(
      '--allowedTools',
      'Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch,LS,NotebookEdit',
    )
  args.push(...opts.extraArgs)
  return args
}

export class ClaudeService extends EventEmitter {
  private processes = new Map<string, ChildProcess>()
  private claudePath = 'claude'

  setClaudePath(path: string): void {
    this.claudePath = path
  }

  async sendMessage(
    sessionId: string,
    message: string,
    cwd: string,
    opts?: { extraArgs?: string[]; autoAccept?: boolean },
  ): Promise<void> {
    const existing = this.processes.get(sessionId)
    if (existing && !existing.killed) {
      existing.stdin?.write(
        JSON.stringify({
          type: 'user',
          message: { role: 'user', content: [{ type: 'text', text: message }] },
        }) + '\n',
      )
      return
    }

    const args = buildClaudeArgs({
      sessionId,
      cwd,
      extraArgs: opts?.extraArgs ?? [],
      autoAccept: opts?.autoAccept,
    })
    const proc = spawn(this.claudePath, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    })
    this.processes.set(sessionId, proc)

    if (proc.stdout) {
      const rl = createInterface({ input: proc.stdout })
      rl.on('line', (line) => {
        try {
          const event = JSON.parse(line)
          this.emit('stream-event', { sessionId, event })
        } catch {
          /* skip non-JSON */
        }
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

    proc.stdin?.write(
      JSON.stringify({
        type: 'user',
        message: { role: 'user', content: [{ type: 'text', text: message }] },
      }) + '\n',
    )
  }

  abort(sessionId: string): void {
    const proc = this.processes.get(sessionId)
    if (proc && !proc.killed) proc.kill('SIGINT')
  }

  confirmPermission(
    sessionId: string,
    toolUseId: string,
    allow: boolean,
  ): void {
    const proc = this.processes.get(sessionId)
    if (proc && !proc.killed) {
      proc.stdin?.write(
        JSON.stringify({ type: 'permission_response', toolUseId, allow }) +
          '\n',
      )
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
