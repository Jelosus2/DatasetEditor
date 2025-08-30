import type { Image } from '@/stores/datasetStore';
import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useLogStore } from '@/stores/logStore';

export function sortTags(tags: Iterable<string>): string[] {
  const arr = [...tags];
  if (arr.length <= 1) return arr;
  const [first, ...rest] = arr;
  rest.sort((a, b) => a.localeCompare(b));
  return [first, ...rest];
}

export class DatasetService {
  private ipc = useIpcRenderer([]);
  private logStore = useLogStore();

  async loadDataset(isAllSaved: boolean, directory?: string | null, recursive = false, sortOnLoad = false) {
    this.logStore.addLog('info', 'Requesting dataset load');
    const result = await this.ipc.invoke<{
      images: Map<string, Image>
      globalTags: Map<string, Set<string>>
      directoryPath: string
    } | null>('load_dataset', isAllSaved, directory, recursive, sortOnLoad);
    if (result && result.images.size > 0) this.logStore.addLog('info', 'Dataset loaded');
    else if (result && result.images.size === 0) this.logStore.addLog('info', 'Attempted to load dataset but no images were found')
    else this.logStore.addLog('info', 'Dataset not loaded');
    return result;
  }

  async saveDataset(dataset: Record<string, { path: string; tags: string[] }>, sort = false) {
    return this.ipc.invoke('save_dataset', dataset, sort);
  }

  async compareDatasetChanges(images: Array<Array<string | { tags: string[]; path: string }>>) {
    return this.ipc.invoke<boolean>('compare_dataset_changes', images);
  }

  imagesToObject(images: Map<string, Image>, sort = false) {
    return [...images].map(([img, props]) => [
      img,
      { tags: sort ? sortTags(props.tags) : [...props.tags], path: props.path }
    ]);
  }

  datasetToSaveFormat(images: Map<string, Image>, sort = false) {
    const obj: Record<string, { path: string; tags: string[] }> = {};
    for (const [image, props] of images.entries()) {
      obj[image] = { path: props.path, tags: sort ? sortTags(props.tags) : [...props.tags] }
    }
    return obj;
  }
}
