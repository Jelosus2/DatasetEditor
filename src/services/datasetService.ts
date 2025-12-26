import type { Image } from '@/stores/datasetStore';

import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useAlert } from '@/composables/useAlert';
import { useLogStore } from '@/stores/logStore';
import { toRaw } from 'vue';

export class DatasetService {
    private ipc = useIpcRenderer([]);
    private logStore = useLogStore();
    private alert = useAlert();

    private getRawDataset(dataset: Map<string, Image>) {
        const rawMap = toRaw(dataset);
        const cleanMap = new Map<string, Image>();

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
        this.logStore.addLog('info', 'Requesting dataset load...');

        const result = await this.ipc.invoke<{
            error: boolean
            canceled?: boolean
            message?: string
            dataset?: Map<string, Image>
            globalTags?: Map<string, Set<string>>
            directoryPath?: string
        }>("dataset:load", isAllSaved, reloadDataset);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return null;
        }

        if (!result.error && result.canceled) {
            this.alert.showAlert("error", "Dataset load was canceled, check the logs for more information");
            return null;
        }

        return result;
    }

    async saveDataset(dataset: Map<string, Image>) {
        const rawDataset = this.getRawDataset(dataset);
        const result = await this.ipc.invoke<{ error: boolean, message?: string }>("dataset:save", rawDataset);

        if (result.error)
            this.alert.showAlert("error", result.message!);
    }

    async compareDatasets(dataset: Map<string, Image>) {
        if (dataset.size === 0)
            return true;

        const rawDataset = this.getRawDataset(dataset);
        return this.ipc.invoke<boolean>("dataset:compare", rawDataset);
    }
}
