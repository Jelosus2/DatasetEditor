import type { TaggerModelConfiguration, TaggerModelConfigurationProperties } from "../../shared/tagger";
import type { AlertType } from "@/types/alert";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAlert } from "@/composables/useAlert";
import { toRaw } from "vue";

export class TaggerService {
    private ipc;
    private alert = useAlert();
    private isServiceRunning = false;

    public onData?: (data: string) => void;
    public onServiceStarted?: () => void;
    public onServiceStopped?: () => void;

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

                    this.onData?.(data)
                }
            },
            {
                channel: "tagger:service_stopped",
                handler: () => {
                    this.isServiceRunning = false;
                    this.onServiceStopped?.()
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

    async startService() {
        const result = await this.ipc.invoke("tagger:start");

        if (result.error)
            this.alert.showAlert("error", result.message!);
    }

    async resizeTerminal(columms: number, rows: number) {
        await this.ipc.invoke("tagger:resize_terminal", columms, rows);
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
}
