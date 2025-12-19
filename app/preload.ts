import type { IpcRendererEvent } from "electron";

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("ipcRenderer", {
    invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
        return ipcRenderer.invoke(channel, ...args);
    },
    send: (channel: string, ...args: unknown[]) => {
        ipcRenderer.send(channel, ...args);
    },
    on: (channel: string, listener: (...args: unknown[]) => void) => {
        const subscription = (_event: IpcRendererEvent, ...args: unknown[]) => {
            listener(...args);
        }

        ipcRenderer.on(channel, subscription);

        return () => {
            ipcRenderer.removeListener(channel, subscription);
        }
    },
    receive: (channel: string, func: (...args: unknown[]) => void) => ipcRenderer.on(channel, (_, ...args) => func(...args)),
});
