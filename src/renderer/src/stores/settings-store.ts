import { create } from 'zustand'

interface SettingsState {
  theme: 'light' | 'dark' | 'system'
  fontSize: number
  sidebarCollapsed: boolean
  sidebarWidth: number
  autoAccept: boolean
  autoAcceptConfirmed: boolean

  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setFontSize: (size: number) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSidebarWidth: (width: number) => void
  setAutoAccept: (enabled: boolean) => void
  confirmAutoAccept: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'system',
  fontSize: 14,
  sidebarCollapsed: false,
  sidebarWidth: 280,
  autoAccept: false,
  autoAcceptConfirmed: false,

  setTheme: (theme) => {
    set({ theme })
    window.electronAPI.config.set('theme', theme)
  },

  setFontSize: (fontSize) => {
    if (fontSize >= 12 && fontSize <= 20) {
      set({ fontSize })
      window.electronAPI.config.set('fontSize', fontSize)
    }
  },

  toggleSidebar: () =>
    set((state) => {
      const collapsed = !state.sidebarCollapsed
      window.electronAPI.config.set('sidebarCollapsed', collapsed)
      return { sidebarCollapsed: collapsed }
    }),

  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  setSidebarWidth: (width) => {
    const clamped = Math.max(240, Math.min(520, width))
    set({ sidebarWidth: clamped })
    window.electronAPI.config.set('sidebarWidth', clamped)
  },

  setAutoAccept: (enabled) => {
    set({ autoAccept: enabled })
    window.electronAPI.config.set('globalAutoAccept', enabled)
  },

  confirmAutoAccept: () => set({ autoAcceptConfirmed: true }),
}))
