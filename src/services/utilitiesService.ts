import { useIpcRenderer } from "@/composables/useIpcRenderer";

export class UtilitiesService {
    private ipc = useIpcRenderer([]);

    openUrlInBrowser(url: string) {
        this.ipc.invoke("utilities:open_url", url);
    }
}
