import { useEffect } from 'react'
import { useSettingsStore } from '../stores/settings-store'

export function useTheme() {
  const { theme } = useSettingsStore()

  useEffect(() => {
    const root = document.documentElement

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    if (theme === 'dark') {
      applyTheme(true)
    } else if (theme === 'light') {
      applyTheme(false)
    } else {
      // System preference
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      applyTheme(mq.matches)

      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])
}
