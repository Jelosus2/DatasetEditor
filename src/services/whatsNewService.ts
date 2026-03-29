import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAlert } from "@/composables/useAlert";

export class WhatsNewService {
    private ipc = useIpcRenderer([]);
    private alert = useAlert();

    async getWhatsNew() {
        const result = await this.ipc.invoke("whats_new:get");

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return null;
        }

        return result.payload!;
    }

    async markSeen() {
        const result = await this.ipc.invoke("whats_new:mark_seen");
        if (result.error)
            this.alert.showAlert("error", result.message!);
    }
}
