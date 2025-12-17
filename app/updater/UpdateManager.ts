import electronUpdater from "electron-updater";
import { App } from "../App.js";

const { autoUpdater } = electronUpdater;

export class UpdateManager {
    constructor() {
        autoUpdater.autoDownload = false;
        autoUpdater.disableWebInstaller = true;
        autoUpdater.autoInstallOnAppQuit = false;
        this.registerListeners();
    }

    registerListeners() {
        autoUpdater.on('update-available', () => {
            App.window.mainWindow?.webContents.send('update_available');
        });

        autoUpdater.on('download-progress', () => {
            App.window.mainWindow?.webContents.send('update_progress');
        });

        autoUpdater.on('update-downloaded', () => {
            App.window.mainWindow?.webContents.send('update_downloaded');
        });

        autoUpdater.on('error', (err) => {
            App.window.mainWindow?.webContents.send('update_error');
            const message = `Updater error: ${err.message}`;
            App.window.mainWindow?.webContents.send('app-log', { type: 'error', message });
        });
    }

    async checkForUpdates() {
        try {
            await autoUpdater.checkForUpdates();
        } catch (error: unknown) {
            console.error(error);
        }
    }

    async downloadUpdate() {
        try {
            await autoUpdater.downloadUpdate();
        } catch (error: unknown) {
            console.error(error);
        }
    }

    installUpdate() {
        autoUpdater.quitAndInstall();
    }
}
