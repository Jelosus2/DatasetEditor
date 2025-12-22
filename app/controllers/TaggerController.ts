import type { TaggerWSPayload } from "../types/tagger.js";
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

    @IpcHandle("tagger:start")
    async startTagger() {
        try {
            const { taggerPort } = await App.settings.loadSettings();

            App.logger.info("[Tagger Manager] Installing dependencies...");
            const exitCode = await App.tagger.runInstallProcess();

            if (exitCode !== 0)
                throw new Error(`Dependency installation failed with exit code ${exitCode}`);

            App.logger.info("[Tagger Maanager] Starting server...");
            App.tagger.runTaggerProcess(taggerPort);

            this.port = taggerPort;
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
            App.tagger.cleanup();
            App.logger.info("[Tagger Manager] Tagger server stopped successfully");

            return { error: false, message: "Tagger server stopped successfully" }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tagger Manager] Failed to stop tagger server: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to stop the tagger server, check the logs for more information" }
        }
    }

    @IpcHandle("tagger:get_device")
    async getDevice() {
        try {
            this.port ??= (await App.settings.loadSettings())?.taggerPort;
            const device = await APIClient.getTaggerDeviceWS(this.port);

            return { error: false, device }
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
            this.port ??= (await App.settings.loadSettings())?.taggerPort;
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
}
