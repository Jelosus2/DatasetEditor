import type { TaggerModelConfiguration, TaggerModelConfigurationProperties, TaggerWSPayloadModel } from "../../shared/tagger";
import type { AlertType } from "@/types/alert";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useDatasetStore } from "@/stores/datasetStore";
import { useAlert } from "@/composables/useAlert";
import { toRaw } from "vue";

export class TaggerService {
    private ipc;
    private alert = useAlert();
    private isServiceRunning = false;
    private datasetStore = useDatasetStore();

    onData?: (data: string) => void;
    onServiceStarted?: () => void;
    onServiceStopped?: () => void;

    constructor() {
        this.ipc = useIpcRenderer([
            {
                channel: "tagger:output",
                handler: (data) => {
                    if (data.includes("Tagger service running on port") && !this.isServiceRunning) {
                        this.isServiceRunning = true;
                        this.onServiceStarted?.();
                        this.alert.showAlert("success", "Server started successfully");
                    }

                    this.onData?.(data);
                }
            },
            {
                channel: "tagger:service_stopped",
                handler: (erroredOut) => {
                    if (erroredOut)
                        this.alert.showAlert("error", "The tagger service crashed due to an error, check the logs for more information");

                    this.isServiceRunning = false;
                    this.onServiceStopped?.();
                }
            }
        ]);
    }

    private getRawConfiguration(configurationMap: Map<string, TaggerModelConfigurationProperties>) {
        const rawMap = toRaw(configurationMap);
        const object = {} as TaggerModelConfiguration;

        for (const [name, properties] of rawMap.entries()) {
            const rawProperties = toRaw(properties);
            object[name] = rawProperties;
        }

        return object;
    }

    private rawConfigurationToMap(configuration: TaggerModelConfiguration) {
        const configurationMap = new Map<string, TaggerModelConfigurationProperties>();
        for (const [name, properties] of Object.entries(configuration)) {
            configurationMap.set(name, properties);
        }

        return configurationMap;
    }

    private configurationMapToPayload(configurationMap: Map<string, TaggerModelConfigurationProperties>) {
        const resultArr: TaggerWSPayloadModel[] = [];
        for (const [name, properties] of configurationMap) {
            resultArr.push({
                repo_id: name,
                general_threshold: properties.generalThreshold,
                character_threshold: properties.characterThreshold,
                model_file: properties.modelFile,
                tags_file: properties.tagsFile
            });
        }

        return resultArr;
    }

    private applyTaggerTagsToDataset(results: Map<string, string[]>) {
        for (const [name, tags] of results) {
            if (this.datasetStore.dataset.has(name))
                this.datasetStore.addTagsToImages([name], new Set(tags));
        }
    }

    async getModelsConfiguration() {
        const result = await this.ipc.invoke("tagger:load_models_config");
        return this.rawConfigurationToMap(result);
    }

    async updateModelsConfiguration(configurationMap: Map<string, TaggerModelConfigurationProperties>) {
        const configuration = this.getRawConfiguration(configurationMap);
        const result = await this.ipc.invoke("tagger:update_models_config", configuration);

        this.alert.showAlert(result.error ? "error" : "success", result.message);

        return { error: result.error };
    }

    async installDependencies() {
        const result = await this.ipc.invoke("tagger:install");

        if (result.stopped)
            return;

        this.alert.showAlert(result.error ? "error" : "success", result.message!);
    }

    async uninstallDependencies() {
        const result = await this.ipc.invoke("tagger:uninstall");

        if (result.stopped)
            return;

        this.alert.showAlert(result.error ? "error" : "success", result.message!);
    }

    async startService() {
        const result = await this.ipc.invoke("tagger:start");

        if (result.error)
            this.alert.showAlert("error", result.message!);
        if (!result.error && result.port)
            this.alert.showAlert("info", `Starting tagger service on port ${result.port}`);

        return result.error;
    }

    async resizeTerminal(columns: number, rows: number) {
        await this.ipc.invoke("tagger:resize_terminal", columns, rows);
    }

    async stopProcess() {
        const result = await this.ipc.invoke("tagger:stop");

        this.alert.showAlert(result.error ? "error" : "success", result.message);
    }

    async getDevice() {
        const result = await this.ipc.invoke("tagger:get_device");

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return "Unknown";
        }

        return result.device!;
    }

    async downloadModel(modelRepo: string, modelFile: string, tagsFile: string) {
        const result = await this.ipc.invoke("tagger:download_model", modelRepo, modelFile, tagsFile);

        this.alert.showAlert(result.error ? "error" : "success", result.message);

        return {
            error: result.error,
            cacheSizeBytes: result.cacheSizeBytes
        };
    }

    async getModelsStatus() {
        const result = await this.ipc.invoke("tagger:models_status");

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return { status: {}, cacheSizeBytes: 0 };
        }

        return {
            status: result.status!,
            cacheSizeBytes: result.cacheSizeBytes!
        };
    }

    async deleteModel(modelRepo: string) {
        const result = await this.ipc.invoke("tagger:delete_model", modelRepo);

        let alertType: AlertType = "success";
        if (result.error)
            alertType = "error";
        else if (!result.success)
            alertType = "warning";

        this.alert.showAlert(alertType, result.message);

        return {
            error: result.error,
            cacheSizeBytes: result.cacheSizeBytes
        };
    }

    async tagImages(
        configurationMap: Map<string, TaggerModelConfigurationProperties>,
        removeUnderscores: boolean,
        removeRedundantTags: boolean,
        disableCharacterThreshold: boolean,
        mode: "autotag" | "diff"
    ) {
        const images = Array.from(this.datasetStore.dataset.values(), (properties) => properties.path);
        if (images.length === 0) {
            this.alert.showAlert("warning", "Load a dataset before attempting to autotag it");
            return;
        }

        const payloadModels = this.configurationMapToPayload(configurationMap);
        if (payloadModels.length === 0) {
            this.alert.showAlert("warning", "Select atleast one autotagger model");
            return;
        }

        const result = await this.ipc.invoke("tagger:tag_images", {
            images,
            models: payloadModels,
            tags_ignored: [],
            remove_underscores: removeUnderscores,
            disable_character_threshold: disableCharacterThreshold
        }, removeRedundantTags);

        if (result.error) {
            this.alert.showAlert("error", result.message);
            return;
        }

        if (mode === "autotag" && result.results)
            this.applyTaggerTagsToDataset(result.results);
        else if (mode === "diff" && result.results)
            this.datasetStore.setTagDiffFromResults(result.results);

        this.alert.showAlert("success", result.message);
    }

    async stopTagger() {
        return this.ipc.invoke("tagger:stop_tagging");
    }

    async compareStyle() {
        const images = Array.from(this.datasetStore.dataset.values(), (properties) => properties.path);
        if (images.length < 3) {
            this.alert.showAlert("warning", "Need at least three images to compare style");
            return null;
        }

        const result = await this.ipc.invoke("tagger:compare_style", images);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return null;
        }

        if (!result.error && result.message) {
            this.alert.showAlert("success", result.message);
            return null;
        }

        return {
            folderCohesion: result.folderCohesion!,
            results: result.results!
        };
    }

    async stopStyleCompare() {
        return this.ipc.invoke("tagger:stop_style_compare");
    }
}
