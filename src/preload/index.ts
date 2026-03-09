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
    load: (sessionId: string) =>
      ipcRenderer.invoke(IPC.SESSION_LOAD, sessionId),
    create: (projectPath: string) =>
      ipcRenderer.invoke(IPC.SESSION_CREATE, projectPath),
    delete: (sessionId: string) =>
      ipcRenderer.invoke(IPC.SESSION_DELETE, sessionId),
  },
  project: {
    list: () => ipcRenderer.invoke(IPC.PROJECT_LIST),
    add: (path: string) => ipcRenderer.invoke(IPC.PROJECT_ADD, path),
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
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
