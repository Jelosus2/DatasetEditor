import type { Image } from '@/stores/datasetStore';
import { useIpcRenderer } from '@/composables/useIpcRenderer';

export function sortTags(tags: Iterable<string>): string[] {
  const arr = [...tags];
  if (arr.length <= 1) return arr;
  const [first, ...rest] = arr;
  rest.sort((a, b) => a.localeCompare(b));
  return [first, ...rest];
}

export class DatasetService {
  private ipc = useIpcRenderer([]);

  async loadDataset(isAllSaved: boolean, directory?: string | null) {
    return this.ipc.invoke<{
      images: Map<string, Image>
      globalTags: Map<string, Set<string>>
      directoryPath: string
    }>('load_dataset', isAllSaved, directory);
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
