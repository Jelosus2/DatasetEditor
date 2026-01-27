import type { TaggerWSPayload, DeviceWSResponse, ModelsStatusWSResponse, DeleteModelWSResponse } from "../types/tagger.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { APIClient } from "../utils/APIClient.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";

@IpcClass()
export class TaggerController {
    port: number | null;

    constructor() {
        this.port = null;
    }

    @IpcHandle("tagger:install")
    async installDependencies() {
        try {
            App.logger.info("[Tagger Manager] Installing dependencies...");
            const exitCode = await App.tagger.runInstallProcess();

            if (exitCode === -1073741510)
                return { stopped: true };

            if (exitCode !== 0)
                throw new Error(`Dependency installation failed with exit code ${exitCode}`);

            App.logger.info("[Tagger Manager] Dependencies installed successfully");
            return { error: false, message: "Dependencies installed successfully" };
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Error while installing dependencies: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to install dependencies, check the logs for more information" };
        }
    }

    @IpcHandle("tagger:start")
    async startTagger() {
        try {
            const settings = await App.settings.loadSettings();

            process.env["HF_HUB_CACHE"] = settings.huggingFaceCacheDirectory;

            App.logger.info("[Tagger Manager] Starting server...");
            App.tagger.runTaggerProcess(settings.taggerPort);

            this.port = settings.taggerPort;

            App.logger.info("[Tagger Manager] Server started successfully");
            return { error: false }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Error while installing the dependencies: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Failed to install the dependencies, check the logs for more information" }
        }
    }

    @IpcHandle("tagger:stop")
    stopTagger() {
        try {
            App.logger.info("[Tagger Manager] Stopping process...");
            App.tagger.cleanup();
            App.logger.info("[Tagger Manager] Process stopped successfully");

            return { error: false, message: "Process stopped successfully" }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to stop process: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to stop the process, check the logs for more information" }
        }
    }

    @IpcHandle("tagger:get_device")
    async getDevice() {
        try {
            this.port ??= (await App.settings.loadSettings()).taggerPort;
            const response = await APIClient.sendCommandWS<DeviceWSResponse>(this.port, {
                command: "device"
            }, 10000);

            return { error: false, device: response.device }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to get the tagger device: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Failed to get the tagger device, check the logs for more information" }
        }
    }

    @IpcHandle("tagger:tag_images")
    async tagImages(_event: IpcMainInvokeEvent, payload: TaggerWSPayload, removeRedundantTags: boolean) {
        try {
            this.port ??= (await App.settings.loadSettings()).taggerPort;
            const results = await APIClient.runTaggingWS(this.port, payload);

            if (removeRedundantTags) {
                for (const [file, tags] of results) {
                    const cleanedTags = Utilities.removeRedundantTags(tags, payload.remove_underscores);
                    results.set(file, cleanedTags);
                }
            }

            App.logger.info(`[Tagger Manager] Successfully tagged ${results.size} images`);
            return { error: false, message: `Successfully tagged ${results.size} images`, results }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Error while tagging the images: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Error while tagging the images, check the logs for more information" }
        }
    }

    @IpcHandle("tagger:stop_tagging")
    stopTagging() {
        try {
            APIClient.cancelTagging();
            App.logger.info(`[Tagger Manager] Stopped the tagging process`);

            return { error: false, message: 'Stopped the tagging process' }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to stop the tagging process: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to stop the tagging process, check the logs for more information" }
        }
    }

    @IpcHandle("tagger:resize_terminal")
    resizeTerminal(_event: IpcMainInvokeEvent, columms: number, rows: number) {
        App.tagger.resizeTerminal(columms, rows);
    }

    @IpcHandle("tagger:download_model")
    async downloadModel(_event: IpcMainInvokeEvent, modelRepo: string) {
        try {
            const settings = await App.settings.loadSettings();
            this.port ??= settings.taggerPort;

            App.logger.info(`[Tagger Manager] Attempting to download ${modelRepo}...`);
            await APIClient.sendCommandWS(this.port, {
                command: "download_model",
                model: modelRepo
            });
            App.logger.info(`[Tagger Manager] Downloaded ${modelRepo} successfully`);

            return { error: false, message: "Model downloaded successfully" }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to download ${modelRepo}: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Failed to download the model, check the logs for more information" }
        }
    }

    @IpcHandle("tagger:models_status")
    async getModelsStatus(_event: IpcMainInvokeEvent, modelRepos: string[]) {
        try {
            this.port ??= (await App.settings.loadSettings()).taggerPort;
            const response = await APIClient.sendCommandWS<ModelsStatusWSResponse>(this.port, {
                command: "models_status",
                models: modelRepos
            });

            return { error: false, status: response.status }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to check the status of the models: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Failed to get the status of the models, check the logs for more information" }
        }
    }

    @IpcHandle("tagger:delete_model")
    async deleteModel(_event: IpcMainInvokeEvent, modelRepo: string) {
        try {
            this.port ??= (await App.settings.loadSettings()).taggerPort;

            App.logger.info(`[Tagger Manager] Attempting to delete ${modelRepo}...`);
            await APIClient.sendCommandWS<DeleteModelWSResponse>(this.port, {
                command: "delete_model",
                model: modelRepo
            });
            App.logger.info(`[Tagger Manager] Deleted ${modelRepo} successfully`);

            return { error: false, message: "Model deleted successfully" }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to delete ${modelRepo}: ${Utilities.getErrorMessage(error)}`);
            this.port = null;
            return { error: true, message: "Failed to delete the model, check the logs for more information" }
        }
    }
}
