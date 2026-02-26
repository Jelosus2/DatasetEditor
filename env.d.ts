/// <reference types="vite/client" />
import type { IpcInvokeMap, IpcOnMap } from "./shared/ipc-types";

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
    interface KeyboardLayoutMap {
        get(key: string): string | undefined;
        has(key: string): boolean;
        entries(): IterableIterator<[string, string]>;
        keys(): IterableIterator<string>;
        values(): IterableIterator<string>;
        forEach(callback: (value: string, key: string, map: KeyboardLayoutMap) => void): void;
        readonly size: number;
    }

    interface Keyboard {
        getLayoutMap(): Promise<KeyboardLayoutMap>;
    }

    interface Navigator {
        readonly keyboard: Keyboard;
    }

    interface Window {
        ipcRenderer: ipcElectronAPI;
        openTagWikiInBrowser: (event: MouseEvent, href: string) => void;
        __imageUpdatedListenerAdded: boolean;
    }
}

declare module '*.json' {
    const value: unknown;
    export default value;
}
