import { describe, it, expect } from 'vitest'
import {
  parseJsonlLine,
  extractSessionMeta,
  extractChatMessages,
} from '../parsers/jsonl-parser'

describe('JSONL Parser', () => {
  it('parses assistant text event', () => {
    const line = JSON.stringify({
      type: 'assistant',
      uuid: 'a1',
      timestamp: '2026-03-09T10:00:00Z',
      message: {
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
      },
    })
    const event = parseJsonlLine(line)
    expect(event).not.toBeNull()
    expect(event!.type).toBe('assistant')
  })

  it('parses tool_use nested in assistant', () => {
    const line = JSON.stringify({
      type: 'assistant',
      uuid: 'a2',
      timestamp: '2026-03-09T10:01:00Z',
      message: {
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-1',
            name: 'Read',
            input: { file_path: '/tmp/test.txt' },
          },
        ],
      },
    })
    const event = parseJsonlLine(line)
    expect(event).not.toBeNull()
  })

  it('returns null for non-renderable types', () => {
    expect(
      parseJsonlLine(JSON.stringify({ type: 'progress', data: {} })),
    ).toBeNull()
    expect(
      parseJsonlLine(JSON.stringify({ type: 'file-history-snapshot' })),
    ).toBeNull()
    expect(parseJsonlLine(JSON.stringify({ type: 'system' }))).toBeNull()
  })

  it('extracts session title from custom-title record', () => {
    const lines = [
      JSON.stringify({
        type: 'user',
        uuid: '1',
        timestamp: '2026-03-09T10:00:00Z',
        message: {
          role: 'user',
          content: [
            { type: 'text', text: 'First message that is long enough' },
          ],
        },
      }),
      JSON.stringify({
        type: 'custom-title',
        customTitle: 'My Title',
        sessionId: 's1',
      }),
    ]
    expect(extractSessionMeta(lines, 's1', '/proj').title).toBe('My Title')
  })

  it('falls back to first user message (truncated to 30 chars)', () => {
    const lines = [
      JSON.stringify({
        type: 'user',
        uuid: '1',
        timestamp: '2026-03-09T10:00:00Z',
        message: {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'This is a very long message that should be truncated at thirty chars',
            },
          ],
        },
      }),
    ]
    expect(
      extractSessionMeta(lines, 's2', '/proj').title.length,
    ).toBeLessThanOrEqual(30)
  })

  it('converts JSONL lines to ChatMessage array', () => {
    const lines = [
      JSON.stringify({
        type: 'user',
        uuid: 'u1',
        timestamp: '2026-03-09T10:00:00Z',
        message: { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
      }),
      JSON.stringify({
        type: 'assistant',
        uuid: 'a1',
        timestamp: '2026-03-09T10:00:01Z',
        message: { role: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
      }),
      JSON.stringify({ type: 'progress', data: {} }),
      JSON.stringify({ type: 'result', duration: 1200 }),
    ]
    const msgs = extractChatMessages(lines)
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
  })
})
