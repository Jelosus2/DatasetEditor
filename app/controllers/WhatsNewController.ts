import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";

@IpcClass()
export class WhatsNewController {

    @IpcHandle("whats_new:get")
    async getWhatsNew() {
        try {
            const payload = await App.whatsNew.getPayload();
            return { error: false, payload };
        } catch (error) {
            console.error(error);
            App.logger.error(`[What's New Manager] Failed to get What's New payload: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to load What's New, check the logs for more information" };
        }
    }

    @IpcHandle("whats_new:mark_seen")
    async markSeen() {
        try {
            await App.whatsNew.markCurrentVersionAsSeen();
            return { error: false };
        } catch (error) {
            console.error(error);
            App.logger.error(`[What's New Manager] Failed to mark current version as seen: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to update What's New state, check the logs for more information" };
        }
    }
}
