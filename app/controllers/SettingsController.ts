import type { Settings } from "../../shared/settings-schema.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";

@IpcClass()
export class SettingsController {
    constructor() {}

    @IpcHandle("settings:get_schema")
    getSchema() {
        return App.settings.getSchema();
    }

    @IpcHandle("settings:load")
    async load() {
        App.logger.info("[Settings Manager] Settings loaded successfully");
        return await App.settings.loadSettings();
    }

    @IpcHandle("settings:update")
    async update(_event: IpcMainInvokeEvent, partial: Partial<Settings>) {
        try {
            const settings = await App.settings.updatePartial(partial);

            App.logger.info("[Settings Manager] Settings updated successfully");
            return { error: false, settings }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Settings Manager] Failed to update settings: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to update settings, check the logs for more information" }
        }
    }

    @IpcHandle("settings:compare")
    compare(_event: IpcMainInvokeEvent, settings: Settings) {
        return App.settings.compare(settings);
    }

    @IpcHandle("settings:action")
    async action(_event: IpcMainInvokeEvent, actionId: string) {
        if (actionId === "loadTagsCsv")
            return await App.importTagsCsvFromDialog();

        return { error: true, message: `Unknown settings action: ${actionId}` };
    }
}
