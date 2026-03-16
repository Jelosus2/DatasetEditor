import { useIpcRenderer } from "@/composables/useIpcRenderer";

export class UpdateService {
    private ipc = useIpcRenderer([]);

    async checkForUpdates() {
        return this.ipc.invoke("update:check");
    }

    async downloadUpdate() {
        return this.ipc.invoke("update:download");
    }

    installUpdate() {
        this.ipc.invoke("update:install");
    }

    async canUpdate() {
        return this.ipc.invoke("update:availability");
    }
}
