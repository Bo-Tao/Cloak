import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore } from '../stores/chat-store'
import { useSessionStore } from '../stores/session-store'
import { useProjectStore } from '../stores/project-store'
import type { ChatMessage, SessionMeta, Project } from '../../../shared/types'

// Mock window.electronAPI for settings store
vi.stubGlobal('window', {
  electronAPI: {
    config: { get: vi.fn(), set: vi.fn() },
    claude: { sendMessage: vi.fn(), onStreamEvent: vi.fn(), abort: vi.fn() },
    app: { checkCli: vi.fn() },
  },
})

describe('useChatStore', () => {
  beforeEach(() => {
    useChatStore.getState().clearMessages()
  })

  it('appends a message', () => {
    const msg: ChatMessage = {
      id: '1',
      role: 'user',
      timestamp: '2026-03-09T10:00:00Z',
      blocks: [{ type: 'text', content: 'Hello' }],
    }
    useChatStore.getState().appendMessage(msg)
    expect(useChatStore.getState().messages).toHaveLength(1)
    expect(useChatStore.getState().messages[0].id).toBe('1')
  })

  it('updates last assistant block', () => {
    const assistantMsg: ChatMessage = {
      id: '2',
      role: 'assistant',
      timestamp: '2026-03-09T10:00:01Z',
      blocks: [{ type: 'text', content: 'Hi' }],
    }
    useChatStore.getState().appendMessage(assistantMsg)
    useChatStore.getState().updateLastAssistantBlock((blocks) => {
      const last = blocks[blocks.length - 1]
      if (last.type === 'text') {
        return [...blocks.slice(0, -1), { ...last, content: last.content + ' there' }]
      }
      return blocks
    })
    const blocks = useChatStore.getState().messages[0].blocks
    expect(blocks[0].type === 'text' && blocks[0].content).toBe('Hi there')
  })

  it('sets streaming state', () => {
    useChatStore.getState().setStreaming(true)
    expect(useChatStore.getState().isStreaming).toBe(true)
    useChatStore.getState().setStreaming(false)
    expect(useChatStore.getState().isStreaming).toBe(false)
  })

  it('sets pending permission', () => {
    const req = { toolUseId: 't1', toolName: 'Bash', input: {}, riskLevel: 'high' as const }
    useChatStore.getState().setPendingPermission(req)
    expect(useChatStore.getState().pendingPermission).toEqual(req)
    useChatStore.getState().setPendingPermission(null)
    expect(useChatStore.getState().pendingPermission).toBeNull()
  })

  it('clears messages', () => {
    useChatStore.getState().appendMessage({
      id: '1', role: 'user', timestamp: '', blocks: [{ type: 'text', content: 'x' }],
    })
    useChatStore.getState().setStreaming(true)
    useChatStore.getState().clearMessages()
    expect(useChatStore.getState().messages).toHaveLength(0)
    expect(useChatStore.getState().isStreaming).toBe(false)
  })
})

describe('useSessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({ sessions: [], activeSessionId: null })
  })

  it('sets sessions', () => {
    const sessions: SessionMeta[] = [
      { id: 's1', title: 'Test', projectPath: '/p', lastActive: '', messageCount: 5 },
    ]
    useSessionStore.getState().setSessions(sessions)
    expect(useSessionStore.getState().sessions).toHaveLength(1)
  })

  it('adds a session', () => {
    const s: SessionMeta = { id: 's2', title: 'New', projectPath: '/p', lastActive: '', messageCount: 0 }
    useSessionStore.getState().addSession(s)
    expect(useSessionStore.getState().sessions[0].id).toBe('s2')
  })

  it('removes a session and clears active if matching', () => {
    useSessionStore.setState({
      sessions: [{ id: 's1', title: 'T', projectPath: '/p', lastActive: '', messageCount: 0 }],
      activeSessionId: 's1',
    })
    useSessionStore.getState().removeSession('s1')
    expect(useSessionStore.getState().sessions).toHaveLength(0)
    expect(useSessionStore.getState().activeSessionId).toBeNull()
  })
})

describe('useProjectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({ projects: [], activeProject: null })
  })

  it('sets and activates projects', () => {
    const proj: Project = { path: '/p', name: 'P', autoAccept: false, claudeArgs: [] }
    useProjectStore.getState().setProjects([proj])
    useProjectStore.getState().setActive(proj)
    expect(useProjectStore.getState().projects).toHaveLength(1)
    expect(useProjectStore.getState().activeProject?.path).toBe('/p')
  })

  it('adds a project', () => {
    const proj: Project = { path: '/q', name: 'Q', autoAccept: true, claudeArgs: [] }
    useProjectStore.getState().addProject(proj)
    expect(useProjectStore.getState().projects).toHaveLength(1)
  })
})
