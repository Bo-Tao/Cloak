import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

const api = {
  claude: {
    sendMessage: (sessionId: string, text: string) =>
      ipcRenderer.invoke(IPC.CLAUDE_SEND, sessionId, text),
    onStreamEvent: (cb: (event: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data)
      ipcRenderer.on(IPC.CLAUDE_STREAM, handler)
      return () => ipcRenderer.removeListener(IPC.CLAUDE_STREAM, handler)
    },
    abort: (sessionId: string) =>
      ipcRenderer.invoke(IPC.CLAUDE_ABORT, sessionId),
    onPermissionRequest: (cb: (req: unknown) => void) => {
      const handler = (_: unknown, data: unknown) => cb(data)
      ipcRenderer.on(IPC.CLAUDE_PERMISSION_REQUEST, handler)
      return () =>
        ipcRenderer.removeListener(IPC.CLAUDE_PERMISSION_REQUEST, handler)
    },
    confirmPermission: (toolUseId: string, allow: boolean) =>
      ipcRenderer.invoke(IPC.CLAUDE_CONFIRM, toolUseId, allow),
  },
  session: {
    list: (projectPath: string) =>
      ipcRenderer.invoke(IPC.SESSION_LIST, projectPath),
    load: (sessionId: string, projectPath: string) =>
      ipcRenderer.invoke(IPC.SESSION_LOAD, sessionId, projectPath),
    create: (projectPath: string) =>
      ipcRenderer.invoke(IPC.SESSION_CREATE, projectPath),
    delete: (sessionId: string) =>
      ipcRenderer.invoke(IPC.SESSION_DELETE, sessionId),
  },
  project: {
    list: () => ipcRenderer.invoke(IPC.PROJECT_LIST),
    add: (path: string) => ipcRenderer.invoke(IPC.PROJECT_ADD, path),
    remove: (path: string) => ipcRenderer.invoke(IPC.PROJECT_REMOVE, path),
    rename: (path: string, newName: string) =>
      ipcRenderer.invoke(IPC.PROJECT_RENAME, path, newName),
    getClaudeMd: (path: string) =>
      ipcRenderer.invoke(IPC.PROJECT_CLAUDE_MD, path),
  },
  config: {
    get: (key: string) => ipcRenderer.invoke(IPC.CONFIG_GET, key),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke(IPC.CONFIG_SET, key, value),
  },
  app: {
    checkCli: () => ipcRenderer.invoke(IPC.APP_CHECK_CLI),
    getAuthStatus: () => ipcRenderer.invoke(IPC.APP_AUTH_STATUS),
    selectFolder: () => ipcRenderer.invoke(IPC.APP_SELECT_FOLDER) as Promise<string | null>,
    checkUpdate: () => ipcRenderer.invoke(IPC.APP_CHECK_UPDATE) as Promise<{ available: boolean; version?: string }>,
    installUpdate: () => ipcRenderer.invoke(IPC.APP_INSTALL_UPDATE),
    openPath: (path: string) => ipcRenderer.invoke(IPC.SHELL_OPEN_PATH, path),
    onUpdateAvailable: (cb: (info: { version: string }) => void) => {
      const handler = (_: unknown, data: { version: string }) => cb(data)
      ipcRenderer.on(IPC.APP_UPDATE_AVAILABLE, handler)
      return () => ipcRenderer.removeListener(IPC.APP_UPDATE_AVAILABLE, handler)
    },
    onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
      const handler = (_: unknown, data: { version: string }) => cb(data)
      ipcRenderer.on(IPC.APP_UPDATE_DOWNLOADED, handler)
      return () => ipcRenderer.removeListener(IPC.APP_UPDATE_DOWNLOADED, handler)
    },
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
