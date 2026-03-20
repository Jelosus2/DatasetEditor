import type { DatasetRenameOptions } from "../../shared/dataset";
import type { IpcListener } from "@/types/ipc";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAlert } from "@/composables/useAlert";

export class FileService {
    private ipc;
    private alert = useAlert();

    constructor(listeners: IpcListener[] = []) {
        this.ipc = useIpcRenderer(listeners);
    }

    async trashFiles(filePaths: string[]) {
        return this.ipc.invoke("dataset:trash", filePaths);
    }

    async renameFiles(imagePaths: string[], options: DatasetRenameOptions) {
        return this.ipc.invoke("dataset:rename", imagePaths, options);
    }

    async openInExplorer(filePath: string) {
        const result = await this.ipc.invoke("dataset:open_in_explorer", filePath);

        if (result.error)
            this.alert.showAlert("error", result.message!);
    }
}
