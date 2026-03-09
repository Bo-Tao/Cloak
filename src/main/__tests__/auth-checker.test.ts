import { describe, it, expect } from 'vitest'
import {
  parseVersionOutput,
  parseAuthStatusJson,
} from '../services/auth-checker'

describe('AuthChecker parsing', () => {
  it('parses claude version output', () => {
    expect(parseVersionOutput('1.0.40 (Claude Code)\n')).toEqual({
      installed: true,
      version: '1.0.40',
    })
  })

  it('detects missing CLI', () => {
    expect(parseVersionOutput('')).toEqual({ installed: false, version: null })
  })

  it('parses auth status JSON (authenticated)', () => {
    const json =
      '{"email":"user@example.com","plan":"pro","tokenExpiresAt":1748658860401,"authenticated":true}'
    expect(parseAuthStatusJson(json)).toEqual({
      authenticated: true,
      email: 'user@example.com',
    })
  })

  it('parses auth status JSON (unauthenticated)', () => {
    const json = '{"authenticated":false}'
    expect(parseAuthStatusJson(json)).toEqual({
      authenticated: false,
      email: null,
    })
  })

  it('handles malformed auth output', () => {
    expect(parseAuthStatusJson('garbage')).toEqual({
      authenticated: false,
      email: null,
    })
  })
})
