import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { App } from "../App.js";

@IpcClass()
export class UpdateController {
    constructor() {}

    @IpcHandle("update:check")
    checkForUpdates() {
        App.updater.checkForUpdates();
    }

    @IpcHandle("update:download")
    downloadUpdate() {
        App.updater.downloadUpdate();
    }

    @IpcHandle("update:install")
    installUpdate() {
        App.updater.installUpdate();
    }

    @IpcHandle("update:availability")
    async areUpdatesAvailable() {
        return await App.isPortableInstallation();
    }
}
