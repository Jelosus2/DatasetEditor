import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useDatasetStore } from '@/stores/datasetStore';

export async function applyBackgroundColor(imageKeys: string[], color: string) {
  const ipc = useIpcRenderer([]);
  const datasetStore = useDatasetStore();
  const paths = imageKeys
    .filter((key) => datasetStore.images.get(key)?.path.endsWith('.png'))
    .map((key) => datasetStore.images.get(key)?.path);

  const result = await ipc.invoke<{ error: boolean, message: string }>('apply_background_color', paths, color);

  const timestamp = Date.now();
  for (const key of imageKeys) {
    const img = datasetStore.images.get(key);
    if (img) {
      img.filePath = img.filePath.split('?')[0] + `?v=${timestamp}`;
    }
  }

  return result;
}
