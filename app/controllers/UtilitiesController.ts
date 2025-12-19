import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { shell } from "electron";

@IpcClass()
export class UtilitiesController {
    constructor() {}

    @IpcHandle("utilities:open_url")
    openExternalUrl(_event: IpcMainInvokeEvent, url: string) {
        shell.openExternal(url);
    }
}
