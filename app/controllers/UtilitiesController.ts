import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { app, shell } from "electron";

@IpcClass()
export class UtilitiesController {

    @IpcHandle("utilities:open_url")
    openExternalUrl(_event: IpcMainInvokeEvent, url: string) {
        shell.openExternal(url);
    }

    @IpcHandle("utilities:restart_app")
    restartApp() {
        app.relaunch();
        app.exit(0);
    }
}
