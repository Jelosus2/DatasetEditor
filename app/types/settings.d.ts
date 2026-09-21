import type { Settings } from "../../shared/settings-schema.js";

export type AppSettingKey = keyof Settings;
export type AppSettingValue = Settings[AppSettingKey];
