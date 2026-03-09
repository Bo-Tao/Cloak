import { describe, it, expect } from 'vitest'
import {
  parseVersionOutput,
  parseAuthStatusJson,
  parseClaudeJson,
  parseClaudeSettings,
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
      authMethod: null,
    })
  })

  it('parses auth status JSON (unauthenticated)', () => {
    const json = '{"authenticated":false}'
    expect(parseAuthStatusJson(json)).toEqual({
      authenticated: false,
      email: null,
      authMethod: null,
    })
  })

  it('handles malformed auth output', () => {
    expect(parseAuthStatusJson('garbage')).toEqual({
      authenticated: false,
      email: null,
      authMethod: null,
    })
  })
})

describe('parseClaudeJson', () => {
  it('detects oauthAccount as authenticated', () => {
    const content = JSON.stringify({
      oauthAccount: { emailAddress: 'alice@example.com', organizationName: 'Acme' },
    })
    expect(parseClaudeJson(content)).toEqual({
      authenticated: true,
      email: 'alice@example.com',
      authMethod: 'oauth',
    })
  })

  it('handles oauthAccount without emailAddress', () => {
    const content = JSON.stringify({ oauthAccount: { organizationName: 'Acme' } })
    expect(parseClaudeJson(content)).toEqual({
      authenticated: true,
      email: null,
      authMethod: 'oauth',
    })
  })

  it('returns unauthenticated when oauthAccount is missing', () => {
    const content = JSON.stringify({ someOtherField: true })
    expect(parseClaudeJson(content)).toEqual({
      authenticated: false,
      email: null,
      authMethod: null,
    })
  })

  it('handles malformed JSON', () => {
    expect(parseClaudeJson('not-json')).toEqual({
      authenticated: false,
      email: null,
      authMethod: null,
    })
  })
})

describe('parseClaudeSettings', () => {
  it('detects api_billing when both env vars present', () => {
    const content = JSON.stringify({
      env: {
        ANTHROPIC_BASE_URL: 'https://api.example.com',
        ANTHROPIC_AUTH_TOKEN: 'sk-xxx',
      },
    })
    expect(parseClaudeSettings(content)).toEqual({
      authenticated: true,
      email: null,
      authMethod: 'api_billing',
    })
  })

  it('returns unauthenticated when only ANTHROPIC_BASE_URL present', () => {
    const content = JSON.stringify({
      env: { ANTHROPIC_BASE_URL: 'https://api.example.com' },
    })
    expect(parseClaudeSettings(content)).toEqual({
      authenticated: false,
      email: null,
      authMethod: null,
    })
  })

  it('returns unauthenticated when only ANTHROPIC_AUTH_TOKEN present', () => {
    const content = JSON.stringify({
      env: { ANTHROPIC_AUTH_TOKEN: 'sk-xxx' },
    })
    expect(parseClaudeSettings(content)).toEqual({
      authenticated: false,
      email: null,
      authMethod: null,
    })
  })

  it('returns unauthenticated when env is missing', () => {
    const content = JSON.stringify({ otherKey: true })
    expect(parseClaudeSettings(content)).toEqual({
      authenticated: false,
      email: null,
      authMethod: null,
    })
  })

  it('handles malformed JSON', () => {
    expect(parseClaudeSettings('bad-json')).toEqual({
      authenticated: false,
      email: null,
      authMethod: null,
    })
  })
})
