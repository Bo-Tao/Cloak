import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'
import type { ClaudeService } from '../services/claude-service'
import { checkCliInstalled, checkAuth } from '../services/auth-checker'
import { getStore } from '../services/config-store'

export function registerIpcHandlers(claudeService: ClaudeService): void {
  ipcMain.handle(IPC.APP_CHECK_CLI, async () => {
    const store = await getStore()
    const claudePath = store.get('claudeBinaryPath') || 'claude'
    const cli = await checkCliInstalled(claudePath)
    const auth = cli.installed
      ? await checkAuth(claudePath)
      : { authenticated: false }
    return { ...cli, ...auth }
  })

  ipcMain.handle(IPC.APP_AUTH_STATUS, async () => {
    const store = await getStore()
    const claudePath = store.get('claudeBinaryPath') || 'claude'
    return checkAuth(claudePath)
  })

  ipcMain.handle(
    IPC.CLAUDE_SEND,
    async (_e, sessionId: string, text: string) => {
      const store = await getStore()
      const cwd = store.get('lastProjectId') || process.cwd()
      const globalArgs = store.get('globalClaudeArgs') || []
      const projectConfig = store.get('projects')[cwd]
      const autoAccept =
        projectConfig?.autoAccept ?? store.get('globalAutoAccept')
      await claudeService.sendMessage(sessionId, text, cwd, {
        extraArgs: globalArgs,
        autoAccept,
      })
    },
  )

  ipcMain.handle(IPC.CLAUDE_ABORT, (_e, sessionId: string) =>
    claudeService.abort(sessionId),
  )

  ipcMain.handle(
    IPC.CLAUDE_CONFIRM,
    (_e, toolUseId: string, allow: boolean) => {
      // Need sessionId context — will be refined in M2
      // For now, try confirming on all active sessions
    },
  )

  ipcMain.handle(IPC.CONFIG_GET, async (_e, key: string) => {
    const store = await getStore()
    return store.get(key as keyof import('../../shared/types').AppConfig)
  })

  ipcMain.handle(IPC.CONFIG_SET, async (_e, key: string, value: unknown) => {
    const store = await getStore()
    store.set(
      key as keyof import('../../shared/types').AppConfig,
      value as never,
    )
  })

  // Forward stream events to all renderer windows
  claudeService.on('stream-event', (data) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.CLAUDE_STREAM, data)
    }
  })
}
