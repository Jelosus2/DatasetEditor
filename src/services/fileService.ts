import type { DatasetRenameOptions, RenameProgressPayload } from "../../shared/dataset";

import { useIpcRenderer } from "@/composables/useIpcRenderer";

export class FileService {
    private ipc;
    public onRenameProgress?: (progress: RenameProgressPayload) => void;

    constructor() {
        this.ipc = useIpcRenderer([
            {
                channel: "dataset:rename-progress",
                handler: (progress) => this.onRenameProgress?.(progress)
            }
        ]);
    }

    async trashFiles(filePaths: string[]) {
        return this.ipc.invoke("dataset:trash", filePaths);
    }

    async renameFiles(imagePaths: string[], options: DatasetRenameOptions) {
        return this.ipc.invoke("dataset:rename", imagePaths, options);
    }
}
