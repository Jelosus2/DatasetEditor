import type { Settings } from "../types/settings.js";

import { App } from "../App.js";
import * as _ from "lodash";
import fs from "node:fs";

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

    saveSettings(settings: Settings | null, isDarkThemeDefault?: boolean) {
        try {
            if (!settings || !fs.existsSync(App.paths.settingsPath))
                return;
            if (!fs.existsSync(App.paths.dataPath))
                App.paths.mkdirRecursive(App.paths.dataPath);

            const defaultSettings = this.getDefaultSettings();
            if (!settings && !isDarkThemeDefault)
                defaultSettings.theme = "winter";

            settings = settings ?? defaultSettings;
            App.paths.writeJSONFile(App.paths.settingsPath, settings);
            this.originalSettings = settings;
        } catch (error: unknown) {
            console.error(error);
        }
    }

    loadSettings(): Settings | null {
        try {
            if (!fs.existsSync(App.paths.settingsPath))
                return null;

            const loadedSettings = App.paths.readJSONFile<Settings>(App.paths.settingsPath);
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

    initializeWithDefaults(isDarkThemeDefault: boolean) {
        this.saveSettings(null, isDarkThemeDefault);
    }
}
