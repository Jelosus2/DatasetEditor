import "reflect-metadata";

export const CONTROLLER_REGISTRY_KEY: {new (...args: unknown[]): object}[] = [];

const IPC_HANDLE_KEY = Symbol("ipc:handle");
const IPC_ON_KEY = Symbol("ipc:on");

export function IpcClass() {
    return function <T extends { new (...args: unknown[]): object }>(constructor: T) {
        CONTROLLER_REGISTRY_KEY.push(constructor);
    }
}

export function IpcHandle(channel: string) {
    return function (target: object, ...args: unknown[]) {
        const propertyKey = args[0] as string;
        Reflect.defineMetadata(IPC_HANDLE_KEY, channel, target, propertyKey);
    }
}

export function IpcOn(channel: string) {
    return function (target: object, ...args: unknown[]) {
        const propertyKey = args[0] as string;
        Reflect.defineMetadata(IPC_ON_KEY, channel, target, propertyKey);
    }
}

export function getIpcHandleChannel(target: object, propertyKey: string): string | undefined {
    return Reflect.getMetadata(IPC_HANDLE_KEY, target, propertyKey);
}

export function getIpcOnChannel(target: object, propertyKey: string): string | undefined {
    return Reflect.getMetadata(IPC_ON_KEY, target, propertyKey);
}
