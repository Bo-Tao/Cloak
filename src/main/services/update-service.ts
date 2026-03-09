import { BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import { IPC } from '../../shared/types'

const { autoUpdater } = electronUpdater
type UpdateInfo = { version: string; releaseDate?: string }

export class UpdateService {
  private updateAvailable = false
  private updateDownloaded = false

  init(): void {
    // Disable auto-download — let the user decide
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info: UpdateInfo) => {
      this.updateAvailable = true
      this.broadcast(IPC.APP_UPDATE_AVAILABLE, {
        version: info.version,
        releaseDate: info.releaseDate,
      })
    })

    autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
      this.updateDownloaded = true
      this.broadcast(IPC.APP_UPDATE_DOWNLOADED, {
        version: info.version,
      })
    })

    autoUpdater.on('error', (err: Error) => {
      // Silently log — update failures shouldn't block the app
      console.warn('[UpdateService] Update check failed:', err.message)
    })
  }

  async checkForUpdates(): Promise<{ available: boolean; version?: string }> {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result?.updateInfo) {
        return { available: true, version: result.updateInfo.version }
      }
      return { available: false }
    } catch {
      return { available: false }
    }
  }

  installUpdate(): void {
    if (this.updateDownloaded) {
      autoUpdater.quitAndInstall()
    }
  }

  async downloadUpdate(): Promise<void> {
    if (this.updateAvailable && !this.updateDownloaded) {
      await autoUpdater.downloadUpdate()
    }
  }

  private broadcast(channel: string, data: unknown): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(channel, data)
    }
  }
}
