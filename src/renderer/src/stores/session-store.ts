import { create } from 'zustand'
import type { SessionMeta } from '../../../shared/types'

interface SessionState {
  sessions: SessionMeta[]
  activeSessionId: string | null

  setSessions: (sessions: SessionMeta[]) => void
  setActive: (id: string | null) => void
  addSession: (session: SessionMeta) => void
  removeSession: (id: string) => void
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSessionId: null,

  setSessions: (sessions) => set({ sessions }),

  setActive: (id) => set({ activeSessionId: id }),

  addSession: (session) =>
    set((state) => ({ sessions: [session, ...state.sessions] })),

  removeSession: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
      activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
    })),
}))
