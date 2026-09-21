import type { SettingDefinition, SettingDefinitionInput } from "../../shared/settings-schema.js";
import type { GenericCtor } from "../types/decorator.js";

import "reflect-metadata";

const SETTINGS_METADATA = Symbol("settings-metadata");

export function Setting(definition: SettingDefinitionInput) {
    return function (target: object, propertyKey: string) {
        const existing = getSettingsMetadata(target.constructor as GenericCtor);

        const setting = {
            ...definition,
            key: propertyKey
        } as SettingDefinition;

        existing.push(setting);

        Reflect.defineMetadata(SETTINGS_METADATA, existing, target.constructor);
    }
}

export function getSettingsMetadata(ctor: GenericCtor): SettingDefinition[] {
    return Reflect.getMetadata(SETTINGS_METADATA, ctor) ?? [];
}
