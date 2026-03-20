import type { DeviceWSResponse, ModelsStatusWSResponse, DeleteModelWSResponse, ModelActionWSResponse } from "../types/tagger.js";
import type { TaggerModelConfiguration, TaggerWSPayload } from "../../shared/tagger.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { APIClient } from "../utils/APIClient.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import net from "node:net";

@IpcClass()
export class TaggerController {
    private port: number | null;

    constructor() {
        this.port = null;
    }

    @IpcHandle("tagger:load_models_config")
    async loadModelsConfiguration() {
        App.logger.info("[Tagger Model Manager] Models configuration loaded successfully");
        return App.taggerModels.loadConfiguration();
    }

    @IpcHandle("tagger:update_models_config")
    async updateModelsConfiguration(_event: IpcMainInvokeEvent, config: TaggerModelConfiguration) {
        try {
            await App.taggerModels.updateConfiguration(config);

            App.logger.info("[Tagger Model Manager] Model configuration updated successfully");
            return { error: false, message: "Model configuration updated successfully" };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Model Manager] Failed to update configuration: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to update model configuration, check the logs for more information" };
        }
    }

    @IpcHandle("tagger:install")
    async installDependencies() {
        try {
            App.logger.info("[Tagger Manager] Installing dependencies...");
            const result = await App.tagger.runInstallProcess();

            if (result.isManualKilling)
                return { stopped: true };
            if (result.exitCode !== 0)
                throw new Error(`Dependency installation failed with exit code ${result.exitCode}`);

            App.logger.info("[Tagger Manager] Dependencies installed successfully");
            return { error: false, message: "Dependencies installed successfully" };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Error while installing dependencies: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to install dependencies, check the logs for more information" };
        }
    }

    @IpcHandle("tagger:uninstall")
    async uninstallDependencies() {
        try {
            App.logger.info("[Tagger Manager] Uninstalling dependencies...");
            const result = await App.tagger.runUninstallProcess();

            if (result.isManualKilling)
                return { stopped: true };
            if (result.exitCode !== 0)
                throw new Error(`Dependency uninstallation failed with exit code ${result.exitCode}`);

             App.logger.info("[Tagger Manager] Dependencies uninstalled successfully");
            return { error: false, message: "Dependencies uninstalled successfully" };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Error while uninstalling dependencies: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to uninstall dependencies, check the logs for more information" };
        }
    }

    @IpcHandle("tagger:start")
    async startTagger() {
        try {
            const settings = await App.settings.loadSettings();

            process.env["HF_HUB_CACHE"] = settings.huggingFaceCacheDirectory;
            process.env["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1";

            if (process.platform !== "win32" && !await App.tagger.hasVirtualEnv())
                return { error: true, message: "Install the tagger dependencies first" };

            const port = await this.findAvailablePort(settings.taggerPort);
            if (port !== settings.taggerPort)
                 App.logger.info(`[Tagger Manager] Preferred port ${settings.taggerPort} is in use, using ${port} instead`);

            App.logger.info(`[Tagger Manager] Starting server on port ${port}...`);
            App.tagger.runTaggerProcess(port);

            this.port = port;

            App.logger.info("[Tagger Manager] Server started successfully");
            return { error: false, port };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Error while installing the dependencies: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Failed to install the dependencies, check the logs for more information" };
        }
    }

    @IpcHandle("tagger:stop")
    stopTagger() {
        try {
            App.logger.info("[Tagger Manager] Stopping process...");
            this.port = null;
            App.tagger.cleanup();
            App.logger.info("[Tagger Manager] Process stopped successfully");

            return { error: false, message: "Process stopped successfully" };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to stop process: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to stop the process, check the logs for more information" };
        }
    }

    @IpcHandle("tagger:get_device")
    async getDevice() {
        try {
            this.port ??= (await App.settings.loadSettings()).taggerPort;
            const response = await APIClient.sendCommandWS<DeviceWSResponse>(this.port, {
                command: "device"
            }, 10000);

            return { error: false, device: response.device };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to get the tagger device: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Failed to get the tagger device, check the logs for more information" };
        }
    }

    @IpcHandle("tagger:tag_images")
    async tagImages(_event: IpcMainInvokeEvent, payload: TaggerWSPayload, removeRedundantTags: boolean) {
        try {
            const settings = await App.settings.loadSettings();

            this.port ??= settings.taggerPort;
            payload.tags_ignored = settings.tagsIgnored;

            const results = await APIClient.runTaggingWS(this.port, payload);

            if (removeRedundantTags) {
                for (const [file, tags] of results) {
                    const cleanedTags = Utilities.removeRedundantTags(tags, payload.remove_underscores);
                    results.set(file, cleanedTags);
                }
            }

            App.logger.info(`[Tagger Manager] Successfully tagged ${results.size} images`);
            return { error: false, message: `Successfully tagged ${results.size} images`, results };
        } catch (error) {
            this.port = null;

            const errorMessage = Utilities.getErrorMessage(error);
            if (errorMessage === "Tagging was aborted") {
                App.logger.info("[Tagger Manager] Stopped the tagging process");
                return { error: false, message: errorMessage };
            }

            console.error(error);
            App.logger.error(`[Tagger Manager] Error while tagging the images: ${errorMessage}`);
            return { error: true, message: "Error while tagging the images, check the logs for more information" };
        }
    }

    @IpcHandle("tagger:stop_tagging")
    stopTagging() {
        APIClient.cancelTagging();
    }

    @IpcHandle("tagger:resize_terminal")
    resizeTerminal(_event: IpcMainInvokeEvent, columns: number, rows: number) {
        App.tagger.resizeTerminal(columns, rows);
    }

    @IpcHandle("tagger:download_model")
    async downloadModel(_event: IpcMainInvokeEvent, modelRepo: string, modelFile: string, tagsFile: string) {
        try {
            this.port ??= (await App.settings.loadSettings()).taggerPort;

            App.logger.info(`[Tagger Manager] Attempting to download ${modelRepo}...`);
            const response = await APIClient.sendCommandWS<ModelActionWSResponse>(this.port, {
                command: "download_model",
                model: modelRepo,
                model_file: modelFile,
                tags_file: tagsFile
            });
            App.logger.info(`[Tagger Manager] Downloaded ${modelRepo} successfully`);

            return { error: false, message: "Model downloaded successfully", cacheSizeBytes: response.cache_size_bytes };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to download ${modelRepo}: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Failed to download the model, check the logs for more information" };
        }
    }

    @IpcHandle("tagger:models_status")
    async getModelsStatus() {
        try {
            this.port ??= (await App.settings.loadSettings()).taggerPort;
            const models = await App.taggerModels.loadConfiguration();

            const response = await APIClient.sendCommandWS<ModelsStatusWSResponse>(this.port, {
                command: "models_status",
                models
            });

            return { error: false, status: response.status, cacheSizeBytes: response.cache_size_bytes };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to check the status of the models: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Failed to get the status of the models, check the logs for more information" };
        }
    }

    @IpcHandle("tagger:delete_model")
    async deleteModel(_event: IpcMainInvokeEvent, modelRepo: string) {
        try {
            this.port ??= (await App.settings.loadSettings()).taggerPort;

            App.logger.info(`[Tagger Manager] Attempting to delete ${modelRepo}...`);
            const response = await APIClient.sendCommandWS<DeleteModelWSResponse>(this.port, {
                command: "delete_model",
                model: modelRepo
            });
            App.logger.info(`[Tagger Manager] Deleted ${modelRepo} successfully`);

            const message = response.success ? "Model deleted successfully" : "Model wasn't downloaded";
            return { error: false, success: response.success, message, cacheSizeBytes: response.cache_size_bytes };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to delete ${modelRepo}: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Failed to delete the model, check the logs for more information" };
        }
    }

    private isPortAvailable(port: number) {
        return new Promise<boolean>((resolve) => {
            const server = net.createServer();

            server.once("error", () => {
                resolve(false);
            });

            server.once("listening", () => {
                server.close(() => resolve(true));
            });

            server.listen(port, "127.0.0.1");
        });
    }

    private async findAvailablePort(startPort: number, maxAttempts = 100) {
        let port = startPort;

        for (let i = 0; i < maxAttempts; i++, port++) {
            if (await this.isPortAvailable(port))
                return port;
        }

        throw new Error(`No available port found starting from ${startPort} after ${maxAttempts} attempts`);
    }
}
