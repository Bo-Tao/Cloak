// Run with: pnpm exec tsx scripts/test-stream-json.ts
// NOTE: Must unset CLAUDECODE env var if running inside Claude Code session
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const proc = spawn(
  'claude',
  [
    '--print',
    '--output-format',
    'stream-json',
    '--verbose',
    '-p',
    'Say hello in one word',
  ],
  {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, CLAUDECODE: undefined },
  },
)

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
proc.on('exit', (code) => console.log('[exit]', code))
