import type { Settings } from "../types/settings.js";

import { App } from "../App.js";
import * as _ from "lodash";

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
            enableHardwareAcceleration: false
        };
    }

    async saveSettings(settings: Settings | null, isDarkThemeDefault?: boolean) {
        try {
            if (!settings && !await App.paths.fileExists(App.paths.settingsPath))
                return;
            await App.paths.mkdirRecursive(App.paths.dataPath);

            const defaultSettings = this.getDefaultSettings();
            if (!settings && !isDarkThemeDefault)
                defaultSettings.theme = "winter";

            settings = settings ?? defaultSettings;
            await App.paths.writeJSONFile(App.paths.settingsPath, settings);
            this.originalSettings = settings;
        } catch (error: unknown) {
            console.error(error);
        }
    }

    async loadSettings() {
        try {
            if (!await App.paths.fileExists(App.paths.settingsPath))
                return null;

            const loadedSettings = await App.paths.readJSONFile<Settings>(App.paths.settingsPath);
            const settings = { ...this.getDefaultSettings(), ...loadedSettings };

            if (!_.isEqual(loadedSettings, settings))
                this.saveSettings(settings);

            this.originalSettings = settings;
            return settings;
        } catch (error: unknown) {
            console.error(error);
            return null;
        }
    }

    compareChanges(settings: Settings): boolean {
        if (!this.originalSettings)
            return true;

        return _.isEqual(this.originalSettings, settings);
    }

    async initializeWithDefaults(isDarkThemeDefault: boolean) {
        await this.saveSettings(null, isDarkThemeDefault);
    }
}
