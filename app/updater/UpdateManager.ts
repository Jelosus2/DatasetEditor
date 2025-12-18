import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import electronUpdater from "electron-updater";

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

        autoUpdater.on('error', (error) => {
            App.window.mainWindow?.webContents.send('update_error');
            App.logger.error(`[Updater] Update error: ${Utilities.getErrorMessage(error)}`)
        });
    }

    async checkForUpdates() {
        try {
            await autoUpdater.checkForUpdates();
        } catch (error) {
            console.error(error);
            App.logger.error(`[Updater] Error while checking for updates: ${Utilities.getErrorMessage(error)}`);
        }
    }

    async downloadUpdate() {
        try {
            await autoUpdater.downloadUpdate();
        } catch (error) {
            console.error(error);
            App.logger.error(`[Updater] Error while downloading the update: ${Utilities.getErrorMessage(error)}`);
        }
    }

    installUpdate() {
        autoUpdater.quitAndInstall();
    }
}
