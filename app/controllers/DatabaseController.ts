import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";

@IpcClass()
export class DatabaseController {
    constructor() {}

    @IpcHandle("database:retrieve_completions")
    retrieveTagCompletions(_event: IpcMainInvokeEvent, tagHint: string) {
        try {
            const tagCompletions = App.database.retrieveTagCompletions(tagHint);
            return tagCompletions;
        } catch (error) {
            console.error(error);
            App.logger.error(`[Database Manager] Error while trying to fetch tag completions for ${tagHint}: ${Utilities.getErrorMessage(error)}`);
            return [];
        }
    }

    @IpcHandle("database:load_csv")
    async loadCsv() {
        try {
            const result = await App.showOpenDialog({
                title: "Select the autocomplete file",
                properties: ["openFile"],
                filters: [
                    {
                        name: "CSV File",
                        extensions: ["csv"],
                    },
                ],
            });

            const filePath = result.filePaths[0];
            if (!filePath)
                return;

            await App.database.loadCsv(filePath);
            App.logger.info("[Database Manager] Imported tags from CSV file successfully");
        } catch (error) {
            console.log(error);
            App.logger.error(`[Database Manager] Error while loading CSV file into database: ${Utilities.getErrorMessage(error)}`);
        }
    }
}
