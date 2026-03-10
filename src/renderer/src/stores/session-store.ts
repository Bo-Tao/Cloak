import { create } from 'zustand'
import type { SessionMeta } from '../../../shared/types'

interface SessionState {
  sessionsByProject: Record<string, SessionMeta[]>
  activeSessionId: string | null

  setSessionsForProject: (projectPath: string, sessions: SessionMeta[]) => void
  setActive: (id: string | null) => void
  addSession: (session: SessionMeta) => void
  removeSession: (id: string) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionsByProject: {},
  activeSessionId: null,

  setSessionsForProject: (projectPath, sessions) =>
    set((state) => ({
      sessionsByProject: { ...state.sessionsByProject, [projectPath]: sessions },
    })),

  setActive: (id) => set({ activeSessionId: id }),

  addSession: (session) =>
    set((state) => {
      const existing = state.sessionsByProject[session.projectPath] || []
      return {
        sessionsByProject: {
          ...state.sessionsByProject,
          [session.projectPath]: [session, ...existing],
        },
      }
    }),

  removeSession: (id) =>
    set((state) => {
      const updated: Record<string, SessionMeta[]> = {}
      for (const [path, sessions] of Object.entries(state.sessionsByProject)) {
        updated[path] = sessions.filter((s) => s.id !== id)
      }
      return {
        sessionsByProject: updated,
        activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
      }
    }),
}))
