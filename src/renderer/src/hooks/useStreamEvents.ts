import { useEffect } from 'react'
import { useChatStore } from '../stores/chat-store'
import type { ContentBlock } from '../../../shared/types'

interface StreamEvent {
  sessionId: string
  event: {
    type: string
    subtype?: string
    uuid?: string
    timestamp?: string
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
    cost?: { inputTokens: number; outputTokens: number; usdCost: number }
    model?: string
    // stream-json delta fields
    content_block?: {
      type: string
      text?: string
      id?: string
      name?: string
      input?: string
    }
    delta?: {
      type: string
      text?: string
      partial_json?: string
    }
    index?: number
  }
}

export function useStreamEvents() {
  useEffect(() => {
    const unsubscribe = window.electronAPI.claude.onStreamEvent((raw: unknown) => {
      const data = raw as StreamEvent
      const { event } = data
      const store = useChatStore.getState()

      switch (event.type) {
        case 'assistant': {
          // Full assistant message (from --verbose mode)
          if (event.message?.content) {
            const blocks: ContentBlock[] = event.message.content
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

            if (blocks.length > 0) {
              store.appendMessage({
                id: event.uuid ?? crypto.randomUUID(),
                role: 'assistant',
                timestamp: event.timestamp ?? new Date().toISOString(),
                blocks,
                cost: event.cost,
                model: event.model,
              })
            }
          }
          break
        }

        case 'message_start': {
          // New streaming message begins
          store.appendMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            timestamp: new Date().toISOString(),
            blocks: [],
          })
          break
        }

        case 'content_block_start': {
          // New block starting
          if (event.content_block) {
            const cb = event.content_block
            store.updateLastAssistantBlock((blocks) => {
              if (cb.type === 'text') {
                return [...blocks, { type: 'text', content: '' }]
              }
              if (cb.type === 'tool_use') {
                return [
                  ...blocks,
                  {
                    type: 'tool_use',
                    toolId: cb.id ?? '',
                    name: cb.name ?? '',
                    input: {},
                  },
                ]
              }
              if (cb.type === 'thinking') {
                return [...blocks, { type: 'thinking', content: '' }]
              }
              return blocks
            })
          }
          break
        }

        case 'content_block_delta': {
          if (event.delta) {
            store.updateLastAssistantBlock((blocks) => {
              if (blocks.length === 0) return blocks
              const last = blocks[blocks.length - 1]
              if (event.delta!.type === 'text_delta' && last.type === 'text') {
                return [
                  ...blocks.slice(0, -1),
                  { ...last, content: last.content + (event.delta!.text ?? '') },
                ]
              }
              if (event.delta!.type === 'thinking_delta' && last.type === 'thinking') {
                return [
                  ...blocks.slice(0, -1),
                  { ...last, content: last.content + (event.delta!.text ?? '') },
                ]
              }
              return blocks
            })
          }
          break
        }

        case 'content_block_stop':
          // Block finished, nothing specific needed
          break

        case 'message_stop':
        case 'result':
          store.setStreaming(false)
          break

        default:
          // Ignore other event types (progress, system, etc.)
          break
      }
    })

    return unsubscribe
  }, [])
}
