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
        autoUpdater.on("update-available", () => {
            App.window.ipcSend("app:update_available");
        });

        autoUpdater.on("download-progress", (progressInfo) => {
            App.window.ipcSend("app:update_progress", progressInfo.percent);
        });

        autoUpdater.on("update-downloaded", () => {
            App.window.ipcSend("app:update_downloaded");
        });

        autoUpdater.on("error", (error) => {
            App.window.ipcSend("app:update_error");
            App.logger.error(`[Updater] Update error: ${Utilities.getErrorMessage(error)}`)
        });
    }

    async checkForUpdates() {
        return await autoUpdater.checkForUpdates();
    }

    async downloadUpdate() {
        await autoUpdater.downloadUpdate();
    }

    installUpdate() {
        autoUpdater.quitAndInstall();
    }
}
