import type { ChatMessage, ContentBlock, SessionMeta } from '../../shared/types'

interface RawEvent {
  type: string
  uuid?: string
  timestamp?: string
  sessionId?: string
  message?: {
    role: string
    content: Array<{
      type: string
      text?: string
      id?: string
      name?: string
      input?: Record<string, unknown>
      content?: unknown
      tool_use_id?: string
    }>
  }
  customTitle?: string
  cost?: { inputTokens: number; outputTokens: number; usdCost: number }
  model?: string
  [key: string]: unknown
}

const RENDERABLE_TYPES = new Set(['user', 'assistant'])

export function parseJsonlLine(line: string): RawEvent | null {
  try {
    const parsed: RawEvent = JSON.parse(line)
    if (!RENDERABLE_TYPES.has(parsed.type) && parsed.type !== 'custom-title')
      return null
    return parsed
  } catch {
    return null
  }
}

function toContentBlocks(message: RawEvent['message']): ContentBlock[] {
  if (!message?.content) return []
  return message.content
    .map((block): ContentBlock | null => {
      switch (block.type) {
        case 'text':
          return { type: 'text', content: block.text ?? '' }
        case 'tool_use':
          return {
            type: 'tool_use',
            toolId: block.id ?? '',
            name: block.name ?? '',
            input: block.input ?? {},
          }
        case 'tool_result':
          return {
            type: 'tool_result',
            toolId: block.tool_use_id ?? block.id ?? '',
            output:
              typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content ?? ''),
          }
        case 'thinking':
          return { type: 'thinking', content: block.text ?? '' }
        default:
          return null
      }
    })
    .filter((b): b is ContentBlock => b !== null)
}

export function extractSessionMeta(
  lines: string[],
  sessionId: string,
  projectPath: string,
): SessionMeta {
  let title = ''
  let firstUserMsg = ''
  let lastTimestamp = ''
  let messageCount = 0

  for (const line of lines) {
    try {
      const parsed: RawEvent = JSON.parse(line)
      if (parsed.type === 'custom-title' && parsed.customTitle)
        title = parsed.customTitle
      if (parsed.type === 'user' && !firstUserMsg) {
        const text = parsed.message?.content?.find((b) => b.type === 'text')?.text
        if (text) firstUserMsg = text.slice(0, 30)
      }
      if (parsed.timestamp) lastTimestamp = parsed.timestamp
      if (parsed.type === 'user' || parsed.type === 'assistant') messageCount++
    } catch {
      /* skip malformed */
    }
  }

  return {
    id: sessionId,
    title: title || firstUserMsg || 'Untitled',
    projectPath,
    lastActive: lastTimestamp,
    messageCount,
  }
}

export function extractChatMessages(lines: string[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  for (const line of lines) {
    const event = parseJsonlLine(line)
    if (
      !event?.message ||
      (event.type !== 'user' && event.type !== 'assistant')
    )
      continue
    const blocks = toContentBlocks(event.message)
    if (blocks.length === 0) continue
    messages.push({
      id: event.uuid ?? crypto.randomUUID(),
      role: event.type as 'user' | 'assistant',
      timestamp: event.timestamp ?? '',
      blocks,
      cost: event.cost,
      model: event.model,
    })
  }
  return messages
}
