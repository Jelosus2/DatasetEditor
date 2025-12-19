import { Settings } from "../types/settings.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
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
        await App.settings.saveSettings(settings);
    }

    @IpcHandle("settings:compare")
    compare(_event: IpcMainInvokeEvent, settings: Settings) {
        return App.settings.compare(settings);
    }
}
