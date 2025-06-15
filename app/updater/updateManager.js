import electronUpdater from 'electron-updater';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const { autoUpdater } = electronUpdater;

export class UpdateManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    autoUpdater.autoDownload = false;
    autoUpdater.disableWebInstaller = true;
    autoUpdater.autoInstallOnAppQuit = false;
    this.registerListeners();
  }

  registerListeners() {
    autoUpdater.on('update-available', () => {
      this.mainWindow.webContents.send('update_available');
    });

    autoUpdater.on('download-progress', () => {
      this.mainWindow.webContents.send('update_progress');
    });

    autoUpdater.on('update-downloaded', () => {
      this.mainWindow.webContents.send('update_downloaded');
    });

    autoUpdater.on('error', (err) => {
      this.mainWindow.webContents.send('update_error');
      const message = `Updater error: ${err.code ? '[' + err.code + '] ' : ''}${err.message}`;
      this.mainWindow.webContents.send('app-log', { type: 'error', message });
    });
  }

  async checkForUpdates() {
    try {
      return await autoUpdater.checkForUpdates();
    } catch (err) {
      const message = `Error checking for updates: ${err.code ? '[' + err.code + '] ' : ''}${err.message}`;
      this.mainWindow.webContents.send('app-log', { type: 'error', message });
    }
  }

  async downloadUpdate() {
    try {
      await autoUpdater.downloadUpdate();
    } catch (err) {
      const message = `Error downloading update: ${err.code ? '[' + err.code + '] ' : ''}${err.message}`;
      this.mainWindow.webContents.send('app-log', { type: 'error', message });
    }
  }

  installUpdate() {
    autoUpdater.quitAndInstall();
  }

  areUpdatesAvailable() {
    return autoUpdater.isUpdaterActive() && existsSync(join(process.resourcesPath, 'elevate.exe'));
  }
}
