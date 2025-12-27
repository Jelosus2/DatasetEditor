import type { Settings } from "../types/settings.js";

import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import fs from "fs-extra";
import _ from "lodash";

export class SettingsManager {
    private originalSettings: Settings | null;

    constructor() {
        this.originalSettings = null;
    }

    getDefaultSettings(): Settings {
        return {
            showTagCount: false,
            showDiffSection: true,
            showCaptionDiffList: true,
            showTagGroups: true,
            theme: 'dark',
            autocomplete: true,
            tagsIgnored: [],
            taggerPort: 3067,
            recursiveDatasetLoad: false,
            autoCheckUpdates: true,
            sortImagesAlphabetically: false,
            enableHardwareAcceleration: true
        };
    }

    async saveSettings(settings: Settings | null, isDarkThemeDefault?: boolean) {
        if (!settings && await fs.pathExists(App.paths.settingsPath))
            return;

        const defaultSettings = this.getDefaultSettings();
        if (!settings && !isDarkThemeDefault)
            defaultSettings.theme = "winter";

        settings = settings ?? defaultSettings;
        await fs.outputJson(App.paths.settingsPath, settings, { spaces: 2, encoding: "utf-8" });
        this.originalSettings = settings;
    }

    async loadSettings() {
        try {
            if (!await fs.pathExists(App.paths.settingsPath))
                return this.getDefaultSettings();

            const loadedSettings: Settings = await fs.readJson(App.paths.settingsPath, { encoding: "utf-8" });
            const settings = { ...this.getDefaultSettings(), ...loadedSettings };

            if (!_.isEqual(loadedSettings, settings))
                await this.saveSettings(settings);

            this.originalSettings = settings;
            return settings;
        } catch (error) {
            console.error(error);
            App.logger?.error(`[Settings Manager] Failed to load settings from file, using defaults: ${Utilities.getErrorMessage(error)}`);
            return this.getDefaultSettings();
        }
    }

    compare(settings: Settings): boolean {
        if (!this.originalSettings)
            return true;

        return _.isEqual(this.originalSettings, settings);
    }

    async initializeWithDefaults(isDarkThemeDefault: boolean) {
        await this.saveSettings(null, isDarkThemeDefault);
    }
}
