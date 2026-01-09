import type { Settings } from "../../shared/settings-schema.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import path from "node:path";
import fs from "fs-extra";

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

    @IpcHandle("settings:pick_directory")
    async pickDirectory() {
        const result = await App.showOpenDialog({
            title: "Select directory",
            properties: ["openDirectory"]
        });

        const path = result.filePaths[0];
        if (!path)
            return { canceled: true };

        return { path };
    }

    @IpcHandle("settings:validate_directory")
    async validateDirectory(_event: IpcMainInvokeEvent, directoryPath: string) {
        try {
            if (directoryPath === App.paths.defaultHuggingFacePath)
                return { ok: true };

            await fs.readdir(directoryPath);

            const tmpFile = path.join(directoryPath, `.permission_test_${Date.now()}`);
            await fs.writeFile(tmpFile, "");
            await fs.remove(tmpFile);

            return { ok: true };
        } catch (error) {
            if (Utilities.isNodeError(error)) {
                if (error.code === "ENOENT")
                    return { ok: false, message: "Directory path does not exist" };
                else if (error.code === "ENOTDIR")
                    return { ok: false, message: "Path doesn't point to a directory" };
                else if (["EPERM", "EACCES"].includes(error.code ?? "") && error.syscall === "scandir")
                    return { ok: false, message: "No read permissions for this directory" };
                else if (["EPERM", "EACCES"].includes(error.code ?? ""))
                    return { ok: false, message: "No write permissions for this directory" };
            }

            console.error(error);
            App.logger.error(`[Settings Manager] Unknown error checking directory permissions: ${Utilities.getErrorMessage(error)}`);

            return { ok: false, message: "Unkown error, check the logs for more information" }
        }
    }
}
