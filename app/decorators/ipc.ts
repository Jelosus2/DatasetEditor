import type { GenericCtor } from "../types/decorator.js";

import "reflect-metadata";

export const CONTROLLER_REGISTRY_KEY: GenericCtor[] = [];

const IPC_HANDLE_KEY = Symbol("ipc:handle");

export function IpcClass() {
    return function <T extends GenericCtor>(constructor: T) {
        CONTROLLER_REGISTRY_KEY.push(constructor);
    }
}

export function IpcHandle(channel: string) {
    return function (target: object, propertyKey: string) {
        Reflect.defineMetadata(IPC_HANDLE_KEY, channel, target, propertyKey);
    }
}

export function getIpcHandleChannel(target: object, propertyKey: string): string | undefined {
    return Reflect.getMetadata(IPC_HANDLE_KEY, target, propertyKey);
}
