import { IpcOnMap } from "../../shared/ipc-types";

export type IpcListener = {
    [K in keyof IpcOnMap]: {
        channel: K;
        handler: (...args: IpcOnMap[K]["args"]) => void;
    }
}[keyof IpcOnMap];
