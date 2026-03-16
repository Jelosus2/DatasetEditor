import type { Rect, DuplicateMethod } from "../../shared/image";
import type { IpcListener } from "@/types/ipc";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useDatasetStore } from "@/stores/datasetStore";
import { useAlert } from "@/composables/useAlert";

export class ImageService {
    private ipc;
    private datasetStore = useDatasetStore();
    private alert = useAlert();

    constructor(listeners: IpcListener[] = []) {
        this.ipc = useIpcRenderer(listeners);
    }

    async applyBackgroundColor(images: string[], color: string) {
        const supportedExtensions = [".png", ".webp"];

        const paths = images
            .map((key) => this.datasetStore.dataset.get(key)?.path)
            .filter((path): path is string => !!path && supportedExtensions.some((extension) => path.toLowerCase().endsWith(extension)));

        if (paths.length === 0) {
            this.alert.showAlert("warning", "No PNG or WebP images selected");
            return true;
        }

        const result = await this.ipc.invoke("image:set_background", images, color);

        const processed = new Set(paths);
        const timestamp = Date.now();

        for (const image of this.datasetStore.dataset.values()) {
            if (!processed.has(image.path))
                continue;

            image.filePath = image.filePath.split("?")[0] + `?v=${timestamp}`;
        }

        this.alert.showAlert(result.error ? "error" : "success", result.message);

        return result.error;
    }

    async cropImage(imageKey: string, cropRects: Rect[], overwrite: boolean) {
        const image = this.datasetStore.dataset.get(imageKey);
        if (!image) {
            this.alert.showAlert("error", "Image not found in the dataset");
            return true;
        }

        const result = await this.ipc.invoke("image:crop", image.path, cropRects, overwrite);

        if (result.canceled) {
            this.alert.showAlert("info", "Saving cropped image was canceled");
            return true;
        }

        if (!result.error && overwrite)
            image.filePath = image.filePath.split('?')[0] + `?v=${Date.now()}`;

        this.alert.showAlert(result.error ? "error" : "success", result.message!);
        return result.error;
    }

    async getDuplicateGroups(imagePaths: string[], method: DuplicateMethod = "dhash", threshold: number) {
        const result = await this.ipc.invoke("image:find_duplicates", imagePaths, method, threshold);

        if (result.error)
            this.alert.showAlert("error", result.message!);

        return result;
    }

    async getImageDimensions(imagePath: string) {
        return this.ipc.invoke("image:dimensions", imagePath);
    }
}
