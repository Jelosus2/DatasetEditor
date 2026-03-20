import type { AppSettings } from "../settings/AppSettings.ts";
import type { SettingDefinition } from "../../shared/settings-schema.js";

export type AppSettingKey = keyof AppSettings;
export type AppSettingValue = AppSettings[AppSettingKey];
export type TypedSettingDef = Omit<SettingDefinition, "key"> & { key: AppSettingKey };
