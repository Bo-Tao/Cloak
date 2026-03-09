// Run with: pnpm exec tsx scripts/test-stream-json.ts
// Best to run from a standalone terminal, NOT inside Claude Code session
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

// Only remove the nested session marker, keep auth/config vars
const cleanEnv = { ...process.env }
delete cleanEnv.CLAUDECODE

const proc = spawn(
  'claude',
  [
    '--print',
    '--output-format',
    'stream-json',
    '--verbose',
    'Say hello in one word',
  ],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: cleanEnv,
  },
)

// Auto-kill after 30s to prevent hanging
const timeout = setTimeout(() => {
  console.error('[timeout] Process did not complete within 30s, killing...')
  proc.kill('SIGTERM')
  process.exit(1)
}, 30_000)

const rl = createInterface({ input: proc.stdout! })
rl.on('line', (line) => {
  try {
    const parsed = JSON.parse(line)
    console.log(`[${parsed.type}]`, JSON.stringify(parsed).slice(0, 200))
  } catch {
    console.log('[raw]', line)
  }
})

proc.stderr?.on('data', (d) => console.error('[stderr]', d.toString()))
proc.on('exit', (code) => {
  clearTimeout(timeout)
  console.log('[exit]', code)
})
