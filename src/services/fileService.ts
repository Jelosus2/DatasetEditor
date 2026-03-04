import type { DatasetRenameOptions } from "../../shared/dataset";
import type { IpcListener } from "@/types/ipc";

import { useIpcRenderer } from "@/composables/useIpcRenderer";

export class FileService {
    private ipc;

    constructor(listeners: IpcListener[] = []) {
        this.ipc = useIpcRenderer(listeners);
    }

    async trashFiles(filePaths: string[]) {
        return this.ipc.invoke("dataset:trash", filePaths);
    }

    async renameFiles(imagePaths: string[], options: DatasetRenameOptions) {
        return this.ipc.invoke("dataset:rename", imagePaths, options);
    }
}
