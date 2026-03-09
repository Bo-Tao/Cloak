import { describe, it, expect } from 'vitest'
import { inferRiskLevel, buildClaudeArgs } from '../services/claude-service'

describe('ClaudeService utilities', () => {
  it('infers low risk for read-only tools', () => {
    expect(inferRiskLevel('Read', {})).toBe('low')
    expect(inferRiskLevel('Glob', {})).toBe('low')
    expect(inferRiskLevel('Grep', {})).toBe('low')
    expect(inferRiskLevel('WebFetch', {})).toBe('low')
    expect(inferRiskLevel('WebSearch', {})).toBe('low')
    expect(inferRiskLevel('LS', {})).toBe('low')
    expect(inferRiskLevel('Agent', {})).toBe('low')
    expect(inferRiskLevel('AskUserQuestion', {})).toBe('low')
    expect(inferRiskLevel('TaskOutput', {})).toBe('low')
    expect(inferRiskLevel('TaskCreate', {})).toBe('low')
    expect(inferRiskLevel('TaskGet', {})).toBe('low')
    expect(inferRiskLevel('TaskList', {})).toBe('low')
    expect(inferRiskLevel('TaskUpdate', {})).toBe('low')
    expect(inferRiskLevel('KillShell', {})).toBe('low')
    expect(inferRiskLevel('MCPSearch', {})).toBe('low')
    expect(inferRiskLevel('LSP', {})).toBe('low')
  })

  it('infers medium risk for write/control tools', () => {
    expect(inferRiskLevel('Write', {})).toBe('medium')
    expect(inferRiskLevel('Edit', {})).toBe('medium')
    expect(inferRiskLevel('NotebookEdit', {})).toBe('medium')
    expect(inferRiskLevel('ExitPlanMode', {})).toBe('medium')
    expect(inferRiskLevel('Skill', {})).toBe('medium')
  })

  it('infers high risk for Bash', () => {
    expect(inferRiskLevel('Bash', {})).toBe('high')
    expect(inferRiskLevel('Bash', { command: 'rm -rf /' })).toBe('high')
  })

  it('infers high risk for unknown tools', () => {
    expect(inferRiskLevel('SomethingNew', {})).toBe('high')
  })

  it('builds correct args for new session', () => {
    const args = buildClaudeArgs({ cwd: '/project', extraArgs: [] })
    expect(args).toContain('--print')
    expect(args).toContain('--output-format')
    expect(args).toContain('stream-json')
    expect(args).toContain('--verbose')
    expect(args).not.toContain('--resume')
  })

  it('builds correct args for resumed session', () => {
    const args = buildClaudeArgs({
      sessionId: 'sess-123',
      cwd: '/project',
      extraArgs: [],
    })
    expect(args).toContain('--resume')
    expect(args).toContain('sess-123')
  })

  it('includes allowedTools for auto-accept mode', () => {
    const args = buildClaudeArgs({ cwd: '/p', extraArgs: [], autoAccept: true })
    expect(args.some((a) => a.includes('Bash'))).toBe(true)
  })
})
