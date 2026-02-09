import type { TaggerModelConfiguration } from "../../shared/tagger.js";

import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import fs from "fs-extra";
import _ from "lodash";

export class TaggerModelManager {
    constructor() {}

    private getDefaultModelNames() {
        return [
            "SmilingWolf/wd-eva02-large-tagger-v3",
            "SmilingWolf/wd-vit-large-tagger-v3",
            "SmilingWolf/wd-swinv2-tagger-v3",
            "SmilingWolf/wd-vit-tagger-v3",
            "SmilingWolf/wd-convnext-tagger-v3",
            "SmilingWolf/wd-v1-4-swinv2-tagger-v2",
            "SmilingWolf/wd-v1-4-moat-tagger-v2",
            "SmilingWolf/wd-v1-4-convnext-tagger-v2",
            "SmilingWolf/wd-v1-4-vit-tagger-v2",
            "SmilingWolf/wd-v1-4-convnextv2-tagger-v2",
            "SmilingWolf/wd-v1-4-convnext-tagger",
            "SmilingWolf/wd-v1-4-vit-tagger"
        ];
    }

    private buildDefaults(overrides: Partial<TaggerModelConfiguration> = {}) {
        const defaultNames = this.getDefaultModelNames();
        const defaults = {} as TaggerModelConfiguration;

        for (const name of defaultNames) {
            defaults[name] = {
                generalThreshold: 0.25,
                characterThreshold: 0.35,
                modelFile: "model.onnx",
                tagsFile: "selected_tags.csv"
            }
        }

        return { ...defaults, ...overrides } as TaggerModelConfiguration;
    }

    async updateConfiguration(configuration: TaggerModelConfiguration) {
        const sanitized = this.buildDefaults(configuration);
        await fs.outputJson(App.paths.taggerModelsConfigPath, sanitized, { spaces: 2, encoding: "utf-8" });

        return sanitized;
    }

    async loadConfiguration() {
        try {
            if (!await fs.pathExists(App.paths.taggerModelsConfigPath))
                return this.buildDefaults();

            const loadedConfiguration: TaggerModelConfiguration = await fs.readJson(App.paths.taggerModelsConfigPath, { encoding: "utf-8" });
            const configuration = this.buildDefaults(loadedConfiguration);

            if (!_.isEqual(loadedConfiguration, configuration))
                return this.updateConfiguration(configuration);

            return configuration;
        } catch (error) {
            console.error(error);
            App.logger?.error(`[Tagger Model Manager] Failed to load configuration from file, using defaults: ${Utilities.getErrorMessage(error)}`);
            return this.buildDefaults();
        }
    }

    async initializeWithDefaults() {
        if (await fs.pathExists(App.paths.taggerModelsConfigPath))
            return;

        const defaults = this.buildDefaults();
        await this.updateConfiguration(defaults);
    }
}
