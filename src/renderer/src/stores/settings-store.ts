import { create } from 'zustand'

interface SettingsState {
  theme: 'light' | 'dark' | 'system'
  fontSize: number
  sidebarCollapsed: boolean

  setTheme: (theme: 'light' | 'dark' | 'system') => void
  setFontSize: (size: number) => void
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'system',
  fontSize: 14,
  sidebarCollapsed: false,

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
}))
