import { create } from 'zustand'
import type { ChatMessage, ContentBlock, PermissionRequest } from '../../../shared/types'

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  pendingPermission: PermissionRequest | null

  appendMessage: (msg: ChatMessage) => void
  updateLastAssistantBlock: (updater: (blocks: ContentBlock[]) => ContentBlock[]) => void
  setStreaming: (streaming: boolean) => void
  setPendingPermission: (req: PermissionRequest | null) => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  pendingPermission: null,

  appendMessage: (msg) =>
    set((state) => ({ messages: [...state.messages, msg] })),

  updateLastAssistantBlock: (updater) =>
    set((state) => {
      const msgs = [...state.messages]
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === 'assistant') {
          msgs[i] = { ...msgs[i], blocks: updater([...msgs[i].blocks]) }
          break
        }
      }
      return { messages: msgs }
    }),

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  setPendingPermission: (req) => set({ pendingPermission: req }),

  clearMessages: () => set({ messages: [], isStreaming: false, pendingPermission: null }),
}))
