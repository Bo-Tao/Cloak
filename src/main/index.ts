import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import icon from '../../resources/icon.png?asset'
import { registerIpcHandlers } from './ipc/handlers'
import { ClaudeService } from './services/claude-service'
import { getStore } from './services/config-store'

const claudeService = new ClaudeService()

async function createWindow(): Promise<BrowserWindow> {
  const store = await getStore()
  const windowConfig = store.get('window')

  const mainWindow = new BrowserWindow({
    width: windowConfig.width,
    height: windowConfig.height,
    x: windowConfig.x,
    y: windowConfig.y,
    minWidth: 800,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: fileURLToPath(new URL('../preload/index.mjs', import.meta.url)),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Save window bounds on close
  mainWindow.on('close', async () => {
    const bounds = mainWindow.getBounds()
    const s = await getStore()
    s.set('window', {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    })
  })

  // HMR for renderer based on electron-vite cli
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(
      fileURLToPath(new URL('../renderer/index.html', import.meta.url)),
    )
  }

  return mainWindow
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.cloak.app')

  if (process.platform === 'darwin' && is.dev) {
    app.dock?.setIcon(icon)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Set claude binary path from config
  const store = await getStore()
  const claudePath = store.get('claudeBinaryPath')
  if (claudePath) {
    claudeService.setClaudePath(claudePath)
  }

  // Register IPC handlers
  registerIpcHandlers(claudeService)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  claudeService.dispose()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
