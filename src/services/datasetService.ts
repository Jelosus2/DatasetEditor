import type { Dataset } from "../../shared/dataset";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAlert } from "@/composables/useAlert";
import { toRaw } from "vue";

export class DatasetService {
    private ipc = useIpcRenderer([]);
    private alert = useAlert();

    constructor() {}

    private getRawDataset(dataset: Dataset) {
        const rawMap = toRaw(dataset);
        const cleanMap: Dataset = new Map();

        for (const [imageName, properties] of rawMap.entries()) {
            const rawProperties = toRaw(properties);

            cleanMap.set(imageName, {
                path: rawProperties.path,
                filePath: rawProperties.filePath,
                tags: toRaw(rawProperties.tags)
            });
        }

        return cleanMap;
    }

    async loadDataset(isAllSaved: boolean, reloadDataset: boolean = false) {
        const result = await this.ipc.invoke("dataset:load", isAllSaved, reloadDataset);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return null;
        }

        if (result.canceled) {
            this.alert.showAlert("info", "Dataset load was canceled");
            return null;
        }

        return result;
    }

    async saveDataset(dataset: Dataset) {
        const rawDataset = this.getRawDataset(dataset);
        const result = await this.ipc.invoke("dataset:save", rawDataset);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return;
        }

        this.alert.showAlert("success", "Dataset saved successfully");
    }

    async compareDatasets(dataset: Dataset) {
        const rawDataset = this.getRawDataset(dataset);
        return this.ipc.invoke("dataset:compare", rawDataset);
    }
}
