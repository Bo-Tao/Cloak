// Run with: pnpm exec tsx scripts/test-stream-json-input.ts
// Tests bidirectional stdin/stdout communication with stream-json format
// NOTE: Must unset CLAUDECODE env var if running inside Claude Code session
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

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
    env: (() => {
      const env = { ...process.env }
      delete env.CLAUDECODE
      return env
    })(),
  },
)

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
proc.on('exit', (code) => console.log('[exit]', code))

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
}, 15000)
