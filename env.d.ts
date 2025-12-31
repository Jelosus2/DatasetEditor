/// <reference types="vite/client" />
import type { IpcInvokeMap, IpcOnMap } from "./shared/ipc-types";
import type { openWikiLink } from "@/services/wikiService";

interface ipcElectronAPI {
    invoke: <K extends keyof IpcInvokeMap>(
        channel: K,
        ...args: IpcInvokeMap[K]["args"]
    ) => Promise<IpcInvokeMap[K]["result"]>;
    send: (channel: string, ...args: unknown[]) => void;
    on: <K extends keyof IpcOnMap>(
        channel: K,
        listener: (...args: IpcOnMap[K]["args"]) => void
    ) => () => void;
}

declare global {
    interface Window {
        ipcRenderer: ipcElectronAPI;
        openWikiLink: typeof openWikiLink;
        __imageUpdatedListenerAdded: boolean;
    }
}

declare module '*.json' {
    const value: unknown;
    export default value;
}
