import type { AppConfig } from '../../shared/types'

export function getConfigDefaults(): AppConfig {
  return {
    theme: 'system',
    fontSize: 14,
    claudeBinaryPath: '',
    globalAutoAccept: false,
    globalClaudeArgs: [],
    window: { width: 1200, height: 800 },
    sidebarCollapsed: false,
    lastProjectId: '',
    shortcuts: {},
    reduceMotion: false,
    projects: {},
  }
}

export function isValidFontSize(size: number): boolean {
  return size >= 12 && size <= 20
}

type StoreInstance = {
  get: <K extends keyof AppConfig>(key: K) => AppConfig[K]
  set: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void
  store: AppConfig
}

let store: StoreInstance | null = null

export async function getStore(): Promise<StoreInstance> {
  if (!store) {
    const Store = (await import('electron-store')).default
    store = new Store<AppConfig>({
      name: 'config',
      defaults: getConfigDefaults(),
    }) as unknown as StoreInstance
  }
  return store
}
