import type { Dataset, DatasetPersistable } from "../../shared/dataset";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAlert } from "@/composables/useAlert";
import { toRaw } from "vue";

export class DatasetService {
    private ipc = useIpcRenderer([]);
    private alert = useAlert();

    constructor() {}

    private getPersistableDataset(dataset: Dataset) {
        const rawMap = toRaw(dataset);
        const cleanMap: DatasetPersistable = new Map();

        for (const [imageName, properties] of rawMap.entries()) {
            const rawProperties = toRaw(properties);

            cleanMap.set(imageName, {
                path: rawProperties.path,
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
        const persistableDataset = this.getPersistableDataset(dataset);
        const result = await this.ipc.invoke("dataset:save", persistableDataset);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return;
        }

        this.alert.showAlert("success", "Dataset saved successfully");
    }

    async compareDatasets(dataset: Dataset) {
        const persistableDataset = this.getPersistableDataset(dataset);
        return this.ipc.invoke("dataset:compare", persistableDataset);
    }
}
