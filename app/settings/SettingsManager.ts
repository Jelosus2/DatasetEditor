import type { AppSettingKey, AppSettingValue, TypedSettingDef } from "../types/settings.js";
import type { Settings } from "../../shared/settings-schema.js";

import { getSettingsMetadata } from "../decorators/settings.js";
import { Utilities } from "../utils/Utilities.js";
import { AppSettings } from "./AppSettings.js";
import { App } from "../App.js";
import fs from "fs-extra";
import _ from "lodash";

export class SettingsManager {
    private originalSettings: Settings | null;

    constructor() {
        this.originalSettings = null;
    }

    getSchema() {
        return getSettingsMetadata(AppSettings);
    }

    private buildDefaults(overrides: Partial<Settings> = {}) {
        const instance = new AppSettings();
        const schema = this.getSchema() as TypedSettingDef[];

        const defaults = {} as Record<AppSettingKey, AppSettingValue>;

        for (const item of schema) {
            if (item.type === "action")
                continue;

            defaults[item.key] = instance[item.key];
        }

        return { ...defaults, ...overrides } as Settings;
    }

    async saveSettings(settings: Settings) {
        const sanitized = this.buildDefaults(settings);
        await fs.outputJson(App.paths.settingsPath, sanitized, { spaces: 2, encoding: "utf-8" });

        this.originalSettings = sanitized;
        return sanitized;
    }

    async loadSettings() {
        try {
            if (!await fs.pathExists(App.paths.settingsPath))
                return this.buildDefaults();

            const loadedSettings: Settings = await fs.readJson(App.paths.settingsPath, { encoding: "utf-8" });
            const settings = this.buildDefaults(loadedSettings);

            if (!_.isEqual(loadedSettings, settings))
                await this.saveSettings(settings);

            this.originalSettings = settings;
            return settings;
        } catch (error) {
            console.error(error);
            App.logger?.error(`[Settings Manager] Failed to load settings from file, using defaults: ${Utilities.getErrorMessage(error)}`);
            return this.buildDefaults();
        }
    }

    async updatePartial(partial: Partial<Settings>) {
        const current = await this.loadSettings();
        const settings = await this.saveSettings({ ...current, ...partial });
        return settings;
    }

    compare(settings: Settings): boolean {
        if (!this.originalSettings)
            return true;

        return _.isEqual(this.originalSettings, settings);
    }

    async initializeWithDefaults(isDarkThemeDefault: boolean) {
        if (await fs.pathExists(App.paths.settingsPath))
            return;

        const defaults = this.buildDefaults({
            theme: isDarkThemeDefault ? "dark" : "winter"
        });

        await this.saveSettings(defaults);
    }
}
