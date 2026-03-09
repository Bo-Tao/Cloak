import { ipcMain, BrowserWindow, dialog } from 'electron'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { IPC } from '../../shared/types'
import type { ClaudeService } from '../services/claude-service'
import type { UpdateService } from '../services/update-service'
import { checkCliInstalled, checkAuth } from '../services/auth-checker'
import { getStore } from '../services/config-store'
import {
  listSessions,
  loadSession,
  createSession,
  deleteSession,
} from '../services/session-manager'

// Track active session so we know which process to send permission responses to
let activeSessionId: string | null = null

export function registerIpcHandlers(claudeService: ClaudeService, updateService?: UpdateService): void {
  // === App ===
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

  // === Claude ===
  ipcMain.handle(
    IPC.CLAUDE_SEND,
    async (_e, sessionId: string, text: string) => {
      activeSessionId = sessionId
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
      if (activeSessionId) {
        claudeService.confirmPermission(activeSessionId, toolUseId, allow)
      }
    },
  )

  // === Sessions ===
  ipcMain.handle(IPC.SESSION_LIST, async (_e, projectPath: string) => {
    return listSessions(projectPath)
  })

  ipcMain.handle(IPC.SESSION_LOAD, async (_e, sessionId: string) => {
    const store = await getStore()
    const projectPath = store.get('lastProjectId') || process.cwd()
    return loadSession(projectPath, sessionId)
  })

  ipcMain.handle(IPC.SESSION_CREATE, async (_e, projectPath: string) => {
    return createSession(projectPath)
  })

  ipcMain.handle(IPC.SESSION_DELETE, async (_e, sessionId: string) => {
    const store = await getStore()
    const projectPath = store.get('lastProjectId') || process.cwd()
    return deleteSession(projectPath, sessionId)
  })

  // === Projects ===
  ipcMain.handle(IPC.PROJECT_LIST, async () => {
    const store = await getStore()
    const projects = store.get('projects') || {}
    return Object.entries(projects).map(([path, config]) => ({
      path,
      name: config.name,
      autoAccept: config.autoAccept,
      claudeArgs: config.claudeArgs,
    }))
  })

  ipcMain.handle(IPC.PROJECT_ADD, async (_e, projectPath: string) => {
    if (!existsSync(projectPath)) throw new Error('Path does not exist')
    const store = await getStore()
    const projects = { ...store.get('projects') }
    projects[projectPath] = {
      name: basename(projectPath),
      autoAccept: false,
      claudeArgs: [],
    }
    store.set('projects', projects)
    store.set('lastProjectId', projectPath)
  })

  ipcMain.handle(IPC.PROJECT_CLAUDE_MD, async (_e, projectPath: string) => {
    const claudeMdPath = join(projectPath, 'CLAUDE.md')
    if (!existsSync(claudeMdPath)) return null
    try {
      return await readFile(claudeMdPath, 'utf-8')
    } catch {
      return null
    }
  })

  // === Dialogs ===
  ipcMain.handle(IPC.APP_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Project Folder',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // === Config ===
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

  // === Updates ===
  ipcMain.handle(IPC.APP_CHECK_UPDATE, async () => {
    if (!updateService) return { available: false }
    return updateService.checkForUpdates()
  })

  ipcMain.handle(IPC.APP_INSTALL_UPDATE, () => {
    updateService?.installUpdate()
  })

  // === Stream event forwarding ===
  claudeService.on('stream-event', (data: { sessionId: string; event: Record<string, unknown> }) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.CLAUDE_STREAM, data)
    }
  })
}
