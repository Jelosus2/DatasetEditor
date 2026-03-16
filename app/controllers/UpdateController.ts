import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";

@IpcClass()
export class UpdateController {

    @IpcHandle("update:check")
    async checkForUpdates() {
        try {
            App.logger.info("[Updater] Checking for updates...");

            const result = await App.updater.checkForUpdates();
            if (result === null) {
                App.logger.warning("[Updater] Updater not available");
                return { error: true, message: "Updater not available" };
            }

            const isUpdateAvailable = result.isUpdateAvailable;

            if (!isUpdateAvailable)
                App.logger.warning("[Updater] There's no updates available");
            else
                App.logger.info(`[Updater] Found a new version update: ${result.updateInfo.version}`);

            return { error: false, isUpdateAvailable };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Updater] Error while checking for updates: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to check for updates, check the logs for more information" };
        }
    }

    @IpcHandle("update:download")
    async downloadUpdate() {
        try {
            App.logger.info("[Updater] Attempting to download update...");
            await App.updater.downloadUpdate();
            App.logger.info("[Updater] Update downloaded successfully");

            return { error: false };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Updater] Error while downloading the update: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to download the update, check the logs for more information" };
        }
    }

    @IpcHandle("update:install")
    installUpdate() {
        App.logger.info("[Updater] Preparing to install the update...");
        App.updater.installUpdate();
    }

    @IpcHandle("update:availability")
    async areUpdatesAvailable() {
        return !App.IS_DEVELOPMENT && !(await App.isPortableInstallation());
    }
}
