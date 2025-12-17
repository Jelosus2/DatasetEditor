import * as ipcDecorator from "../decorators/ipc.js";
import { ipcMain } from "electron";

type GenericMethod = (...args: unknown[]) => unknown;

export class IpcRegistrar {
    static registerAll() {
        ipcDecorator.CONTROLLER_REGISTRY_KEY.forEach((ControllerClass) => {
            const instance = new ControllerClass();
            const prototype = Object.getPrototypeOf(instance);
            const methods = Object.getOwnPropertyNames(prototype);

            methods.forEach((methodName) => {
                if (methodName === "constructor")
                    return;

                const handleChannel = ipcDecorator.getIpcHandleChannel(prototype, methodName);
                if (handleChannel) {
                    const method  = (instance as Record<string, GenericMethod>)[methodName];

                    if (typeof method === "function") {
                        ipcMain.handle(handleChannel, method.bind(instance));
                        console.log(`[IPC-Invoke] Registered: ${handleChannel}`);
                    }
                }

                const onChannel = ipcDecorator.getIpcOnChannel(prototype, methodName);
                if (onChannel) {
                    const method  = (instance as Record<string, GenericMethod>)[methodName];

                    if (typeof method === "function") {
                        ipcMain.on(onChannel, method.bind(instance));
                        console.log(`[IPC-On] Registered: ${onChannel}`);
                    }
                }
            });
        });
    }
}
