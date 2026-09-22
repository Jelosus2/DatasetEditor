import type { SettingDefinition, StringSettingDefinition, Settings } from "../../shared/settings-schema.js";
import type { AppSettingKey, AppSettingValue } from "../types/settings.js";

import { getSettingsMetadata } from "../decorators/settings.js";
import { Utilities } from "../utils/Utilities.js";
import { AppSettings } from "./AppSettings.js";
import { app, safeStorage } from "electron";
import { App } from "../App.js";
import fs from "fs-extra";

type StoredEncryptedString = {
    format: "safe-storage";
    data: string;
};

type LoadSettingsOptions = {
    decryptEncrypted?: boolean;
};

export class SettingsManager {
    private originalSettings: Settings | null;

    constructor() {
        this.originalSettings = null;
    }

    getSchema() {
        return getSettingsMetadata(AppSettings);
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    private isStoredEncryptedString(value: unknown): value is StoredEncryptedString {
        return this.isRecord(value) && value.format === "safe-storage" && typeof value.data === "string";
    }

    private isEncryptedStringSetting(definition: SettingDefinition): definition is StringSettingDefinition {
        return definition.type === "string" && definition.storage === "encrypted";
    }

    private buildDefaults(overrides: Partial<Settings> = {}) {
        const instance = new AppSettings();
        const schema = this.getSchema();

        const defaults = {} as Record<AppSettingKey, AppSettingValue>;

        for (const item of schema) {
            if (item.type === "action")
                continue;

            defaults[item.key] = instance[item.key];
        }

        return { ...defaults, ...overrides } as Settings;
    }

    private async ensureEncryptionAvailable() {
        if (!app.isReady())
            throw new Error("Encrypted settings cannot be accessed before Electron is ready");

        if (!await safeStorage.isAsyncEncryptionAvailable())
            throw new Error("Secure storage is not available on this system");
    }

    private async encryptString(value: string): Promise<StoredEncryptedString> {
        if (!value) {
            return {
                format: "safe-storage",
                data: ""
            };
        }

        await this.ensureEncryptionAvailable();
        const encrypted = await safeStorage.encryptStringAsync(value);

        return {
            format: "safe-storage",
            data: encrypted.toString("base64")
        };
    }

    private async decryptString(value: StoredEncryptedString) {
        if (!value.data) {
            return {
                value: "",
                shouldReEncrypt: false
            };
        }

        await this.ensureEncryptionAvailable();

        const encrypted = Buffer.from(value.data, "base64");
        const result = await safeStorage.decryptStringAsync(encrypted);

        return {
            value: result.result,
            shouldReEncrypt: result.shouldReEncrypt
        };
    }

    private async serializeSettings(settings: Settings) {
        const stored: Record<string, unknown> = {};

        for (const definition of this.getSchema()) {
            if (definition.type === "action")
                continue;

            const value = settings[definition.key];

            if (this.isEncryptedStringSetting(definition)) {
                stored[definition.key] = await this.encryptString(String(value));
                continue;
            }

            stored[definition.key] = value;
        }

        return stored;
    }

    private async deserializeSettings(stored: Record<string, unknown>, decryptEncrypted: boolean) {
        const settings = this.buildDefaults();
        const values = settings as unknown as Record<string, AppSettingValue>;
        let shouldSave = false;

        for (const definition of this.getSchema()) {
            if (definition.type === "action")
                continue;

            const key = definition.key;
            if (!Object.hasOwn(stored, key)) {
                shouldSave = true;
                continue;
            }

            const storedValue = stored[key];

            if (this.isEncryptedStringSetting(definition)) {
                if (typeof storedValue === "string") {
                    if (decryptEncrypted) {
                        values[key] = storedValue;
                        shouldSave = true;
                    }

                    continue;
                }

                if (!this.isStoredEncryptedString(storedValue))
                    throw new TypeError(`Invalid encrypted setting '${key}'`);

                if (decryptEncrypted) {
                    const decrypted = await this.decryptString(storedValue);
                    values[key] = decrypted.value;

                    if (decrypted.shouldReEncrypt)
                        shouldSave = true;
                }

                continue;
            }

            values[key] = storedValue as AppSettingValue;
        }

        return { settings, shouldSave };
    }

    private async saveSettings(settings: Settings) {
        const sanitized = this.buildDefaults(settings);
        const stored = await this.serializeSettings(sanitized);

        await fs.outputJson(App.paths.settingsPath, stored, { spaces: 2, encoding: "utf-8" });

        this.originalSettings = sanitized;
        return sanitized;
    }

    async loadSettings(options: LoadSettingsOptions = {}) {
        const decryptEncrypted = options.decryptEncrypted ?? true;

        try {
            if (!await fs.pathExists(App.paths.settingsPath))
                return this.buildDefaults();

            const loaded = await fs.readJson(App.paths.settingsPath, { encoding: "utf-8" });
            if (!this.isRecord(loaded))
                throw new TypeError("Invalid settings file");

            const { settings, shouldSave } = await this.deserializeSettings(loaded, decryptEncrypted);

            if (shouldSave && decryptEncrypted)
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
        return this.saveSettings({ ...current, ...partial });
    }

    async initializeWithDefaults(isDarkThemeDefault: boolean) {
        if (await fs.pathExists(App.paths.settingsPath))
            return;

        const defaults = this.buildDefaults({
            theme: isDarkThemeDefault ? "dark" : "light"
        });

        await this.saveSettings(defaults);
    }
}
