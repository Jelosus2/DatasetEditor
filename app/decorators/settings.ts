import type { SettingDefinition } from "../../shared/settings-schema.js";
import type { GenericCtor } from "../types/decorator.js";

import "reflect-metadata";

const SETTINGS_METADATA = Symbol("settings-metadata");

export function Setting(definition: Omit<SettingDefinition, "key">) {
    return function (target: object, propertyKey: string) {
        const existing: SettingDefinition[] = getSettingsMetadata(target.constructor as GenericCtor);

        existing.push({
            ...definition,
            key: propertyKey
        });

        Reflect.defineMetadata(SETTINGS_METADATA, existing, target.constructor);
    }
}

export function getSettingsMetadata(ctor: GenericCtor): SettingDefinition[] {
    return Reflect.getMetadata(SETTINGS_METADATA, ctor) ?? [];
}
