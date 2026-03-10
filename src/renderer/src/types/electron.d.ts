interface ElectronAPI {
  claude: {
    sendMessage: (sessionId: string, text: string) => Promise<void>
    onStreamEvent: (cb: (event: unknown) => void) => () => void
    abort: (sessionId: string) => Promise<void>
    onPermissionRequest: (cb: (req: unknown) => void) => () => void
    confirmPermission: (toolUseId: string, allow: boolean) => Promise<void>
  }
  session: {
    list: (projectPath: string) => Promise<unknown[]>
    load: (sessionId: string, projectPath: string) => Promise<unknown>
    create: (projectPath: string) => Promise<string>
    delete: (sessionId: string) => Promise<void>
  }
  project: {
    list: () => Promise<unknown[]>
    add: (path: string) => Promise<void>
    remove: (path: string) => Promise<void>
    rename: (path: string, newName: string) => Promise<void>
    getClaudeMd: (path: string) => Promise<string | null>
  }
  config: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
  }
  app: {
    checkCli: () => Promise<{
      installed: boolean
      version: string | null
      authenticated: boolean
    }>
    getAuthStatus: () => Promise<{
      authenticated: boolean
      email: string | null
      authMethod: 'oauth' | 'api_billing' | null
    }>
    selectFolder: () => Promise<string | null>
    checkUpdate: () => Promise<{ available: boolean; version?: string }>
    installUpdate: () => Promise<void>
    onUpdateAvailable: (cb: (info: { version: string }) => void) => () => void
    onUpdateDownloaded: (cb: (info: { version: string }) => void) => () => void
    openPath: (path: string) => Promise<void>
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
