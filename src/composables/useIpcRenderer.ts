import type { IpcInvokeMap, IpcOnMap } from "../../shared/ipc-types";
import type { IpcListener } from "@/types/ipc";

import { useLogStore } from "@/stores/logStore";
import { onMounted, onUnmounted, onActivated, onDeactivated } from "vue";

let logUnsubscribe: (() => void) | null = null;

export function useIpcRenderer(listeners: IpcListener[]) {
    const logStore = useLogStore();
    const unsubscribes: Array<() => void> = [];
    let subscribed = false;

    function subscribeAll() {
        if (subscribed)
            return;
        subscribed = true;

        listeners.forEach((listener) => {
            const unsubscribe = window.ipcRenderer.on(
                listener.channel,
                listener.handler as (...args: IpcOnMap[keyof IpcOnMap]["args"]) => void
            );

            if (typeof unsubscribe === "function")
                unsubscribes.push(unsubscribe);
        });

        if (!logUnsubscribe) {
            logUnsubscribe = window.ipcRenderer.on("app:log", (entry) => {
                logStore.addLog(entry.type, entry.message);
            });
        }
    }

    function unsubscribeAll() {
        if (!subscribed)
            return;
        subscribed = false;

        unsubscribes.forEach((fn) => fn());
        unsubscribes.length = 0;
    }

    onMounted(subscribeAll);
    onActivated(subscribeAll);
    onDeactivated(unsubscribeAll);
    onUnmounted(unsubscribeAll);

    const invoke = async <K extends keyof IpcInvokeMap>(channel: K, ...args: IpcInvokeMap[K]["args"]): Promise<IpcInvokeMap[K]["result"]> => {
        return window.ipcRenderer.invoke(channel, ...args);
    };

    const send = (channel: string, ...args: unknown[]) => {
        window.ipcRenderer.send(channel, ...args);
    }

    return { invoke, send };
}
