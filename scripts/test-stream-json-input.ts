// Run with: pnpm exec tsx scripts/test-stream-json-input.ts
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
    '--input-format',
    'stream-json',
    '--verbose',
  ],
  {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: cleanEnv,
  },
)

// Auto-kill after 30s
const timeout = setTimeout(() => {
  console.error('[timeout] Process did not complete within 30s, killing...')
  proc.kill('SIGTERM')
  process.exit(1)
}, 30_000)

const rl = createInterface({ input: proc.stdout! })
rl.on('line', (line) => {
  try {
    const parsed = JSON.parse(line)
    console.log(`[${parsed.type}]`, JSON.stringify(parsed).slice(0, 300))
  } catch {
    console.log('[raw]', line)
  }
})

proc.stderr?.on('data', (d) => console.error('[stderr]', d.toString()))
proc.on('exit', (code) => {
  clearTimeout(timeout)
  console.log('[exit]', code)
})

setTimeout(() => {
  const msg = JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'text', text: 'Say hello in one word' }],
    },
  })
  console.log('[sending]', msg)
  proc.stdin?.write(msg + '\n')
}, 2000)

setTimeout(() => {
  console.log('[closing stdin]')
  proc.stdin?.end()
}, 20000)
