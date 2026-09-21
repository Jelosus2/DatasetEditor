import type { IpcInvokeMap } from "../../shared/ipc-types.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";

@IpcClass()
export class DatabaseController {

    @IpcHandle("database:retrieve_completions")
    retrieveTagCompletions(_event: IpcMainInvokeEvent, tagHint: string): IpcInvokeMap["database:retrieve_completions"]["result"] {
        try {
            const tagCompletions = App.database.retrieveTagCompletions(tagHint);
            return tagCompletions;
        } catch (error) {
            console.error(error);
            App.logger.error(`[Database Manager] Error while trying to fetch tag completions for ${tagHint}: ${Utilities.getErrorMessage(error)}`);
            return [];
        }
    }
}
