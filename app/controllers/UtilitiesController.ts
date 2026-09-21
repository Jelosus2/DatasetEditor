import type { IpcInvokeMap } from "../../shared/ipc-types.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { app, shell } from "electron";

@IpcClass()
export class UtilitiesController {

    @IpcHandle("utilities:open_url")
    openExternalUrl(_event: IpcMainInvokeEvent, url: string): IpcInvokeMap["utilities:open_url"]["result"] {
        shell.openExternal(url);
    }

    @IpcHandle("utilities:restart_app")
    restartApp(): IpcInvokeMap["utilities:restart_app"]["result"] {
        app.relaunch();
        app.exit(0);
    }
}
