import { Settings } from "../../shared/settings-schema";

export type SettingsChangeRecord = {
    key: keyof Settings;
    previous: Settings[keyof Settings];
    value: Settings[keyof Settings];
}
