import type { Rect } from "../../shared/image";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useDatasetStore } from "@/stores/datasetStore";
import { useAlert } from "@/composables/useAlert";

export class ImageService {
    private ipc = useIpcRenderer([]);
    private datasetStore = useDatasetStore();
    private alert = useAlert();

    constructor() {}

    async applyBackgroundColor(images: string[], color: string) {
        const paths = images
            .map((key) => this.datasetStore.dataset.get(key)?.path)
            .filter((path): path is string => !!path && path.toLowerCase().endsWith(".png"));

        if (paths.length === 0) {
            this.alert.showAlert("warning", "No PNG images selected");
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
}
