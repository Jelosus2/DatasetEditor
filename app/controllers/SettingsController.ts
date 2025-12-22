import { Settings } from "../types/settings.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";

@IpcClass()
export class SettingsController {
    constructor() {}

    @IpcHandle("settings:load")
    async loadSettings() {
        return await App.settings.loadSettings();
    }

    @IpcHandle("settings:save")
    async saveSettings(_event: IpcMainInvokeEvent, settings: Settings) {
        try {
            await App.settings.saveSettings(settings);
            return { error: false, message: "Settings saved successfully" }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Settings Manager] Failed to save settings: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to save settings, check the logs for more information" }
        }
    }

    @IpcHandle("settings:compare")
    compare(_event: IpcMainInvokeEvent, settings: Settings) {
        return App.settings.compare(settings);
    }
}
