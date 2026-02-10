import type { TaggerModelConfiguration, TaggerModelConfigurationProperties } from "../../shared/tagger";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAlert } from "@/composables/useAlert";

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

    async getModelsConfiguration() {
        const result = await this.ipc.invoke("tagger:load_models_config");

        const configurationMap = new Map<string, TaggerModelConfigurationProperties>();
        for (const [name, properties] of Object.entries(result)) {
            configurationMap.set(name, properties);
        }

        return configurationMap;
    }

    async updateModelsConfiguration(configuration: TaggerModelConfiguration) {
        const result = await this.ipc.invoke("tagger:update_models_config", configuration);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return { error: true, configuration: null };
        }

        return { error: false, configuration: result.configuration }
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

        this.alert.showAlert(result.error ? "error" : "success", result.message);

        return {
            error: result.error,
            cacheSizeBytes: result.cacheSizeBytes
        };
    }
}
