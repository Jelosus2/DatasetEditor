import type { TaggerModelConfiguration } from "../../shared/tagger.js";

import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import fs from "fs-extra";
import _ from "lodash";

const MODEL_CONFIGURATION_SCHEMA_VERSION = 1;

type StoredTaggerModelConfiguration = {
    schemaVersion: typeof MODEL_CONFIGURATION_SCHEMA_VERSION;
    models: TaggerModelConfiguration;
    removedDefaultModels: string[];
};

export class TaggerModelManager {

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

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === "object" && value !== null && !Array.isArray(value);
    }

    private isStoredConfiguration(value: unknown): value is StoredTaggerModelConfiguration {
        if (!this.isRecord(value))
            return false;

        return (
            value.schemaVersion === MODEL_CONFIGURATION_SCHEMA_VERSION &&
            this.isRecord(value.models) &&
            Array.isArray(value.removedDefaultModels) &&
            value.removedDefaultModels.every((model): model is string => typeof model === "string")
        );
    }

    private buildConfiguration(overrides: Partial<TaggerModelConfiguration> = {}, removedDefaultModels: ReadonlySet<string> = new Set()) {
        const defaultNames = this.getDefaultModelNames();
        const defaultNameSet = new Set(defaultNames);

        const activeDefaults = defaultNames.filter((name) => !removedDefaultModels.has(name));
        const allNames = new Set([...activeDefaults, ...Object.keys(overrides)]);

        const configuration = {} as TaggerModelConfiguration;

        for (const name of allNames) {
            const override = overrides[name];
            const isCustomModel = !defaultNameSet.has(name);

            const modelFile = isCustomModel
                ? override?.modelFile || ""
                : "model.onnx";

            const tagsFile = isCustomModel
                ? override?.tagsFile || ""
                : "selected_tags.csv";

            configuration[name] = {
                generalThreshold: 0.25,
                characterThreshold: 0.35,
                ...(override || {}),
                isCustomModel,
                modelFile,
                tagsFile
            };
        }

        return configuration;
    }

    private createStoredConfiguration(configuration: TaggerModelConfiguration): StoredTaggerModelConfiguration {
        const removedDefaultModels = this.getDefaultModelNames().filter((name) => !Object.hasOwn(configuration, name));
        const models = this.buildConfiguration(configuration, new Set(removedDefaultModels));

        return {
            schemaVersion: MODEL_CONFIGURATION_SCHEMA_VERSION,
            models,
            removedDefaultModels
        };
    }

    private async writeConfiguration(configuration: StoredTaggerModelConfiguration) {
        await fs.outputJson(App.paths.taggerModelsConfigPath, configuration, { spaces: 2, encoding: "utf-8" });
    }

    async updateConfiguration(configuration: TaggerModelConfiguration) {
        const storedConfiguration = this.createStoredConfiguration(configuration);
        await this.writeConfiguration(storedConfiguration);

        return storedConfiguration.models;
    }

    async loadConfiguration() {
        try {
            if (!await fs.pathExists(App.paths.taggerModelsConfigPath))
                return this.buildConfiguration();

            const loadedConfiguration = await fs.readJson(App.paths.taggerModelsConfigPath, { encoding: "utf-8" });
            let configuration: TaggerModelConfiguration;

            if (this.isStoredConfiguration(loadedConfiguration)) {
                const defaultNames = new Set(this.getDefaultModelNames());
                const removedDefaultModels = new Set(loadedConfiguration.removedDefaultModels.filter((name) => defaultNames.has(name)));

                configuration = this.buildConfiguration(loadedConfiguration.models, removedDefaultModels);
            } else if (this.isRecord(loadedConfiguration)) {
                configuration = this.buildConfiguration(loadedConfiguration as TaggerModelConfiguration);
            } else {
                throw new TypeError("Invalid model configuration");
            }

            const normalizedConfiguration = this.createStoredConfiguration(configuration);

            if (!_.isEqual(loadedConfiguration, normalizedConfiguration))
                await this.writeConfiguration(normalizedConfiguration);

            return normalizedConfiguration.models;
        } catch (error) {
            console.error(error);

            App.logger.error(`[Tagger Model Manager] Failed to load configuration from file, using defaults: ${Utilities.getErrorMessage(error)}`);
            return this.buildConfiguration();
        }
    }

    async initializeWithDefaults() {
        if (await fs.pathExists(App.paths.taggerModelsConfigPath))
            return;

        await this.updateConfiguration(this.buildConfiguration());
    }
}
