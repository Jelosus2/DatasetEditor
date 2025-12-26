import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useDatasetStore } from '@/stores/datasetStore';

export async function applyBackgroundColor(imageKeys: string[], color: string) {
  const ipc = useIpcRenderer([]);
  const datasetStore = useDatasetStore();
  const paths = imageKeys
    .filter((key) => datasetStore.dataset.get(key)?.path.endsWith('.png'))
    .map((key) => datasetStore.dataset.get(key)?.path);

  const result = await ipc.invoke<{ error: boolean, message: string }>('apply_background_color', paths, color);

  const timestamp = Date.now();
  for (const key of imageKeys) {
    const img = datasetStore.dataset.get(key);
    if (img) {
      img.filePath = img.filePath.split('?')[0] + `?v=${timestamp}`;
    }
  }

  return result;
}

export async function cropImage(
  imageKey: string,
  crop: { x: number; y: number; width: number; height: number },
  overwrite: boolean,
) {
  const ipc = useIpcRenderer([]);
  const datasetStore = useDatasetStore();
  const path = datasetStore.dataset.get(imageKey)?.path;
  if (!path) return { error: true, message: 'Image not found' };

  const result = await ipc.invoke<{ error: boolean; message: string }>(
    'crop_image',
    path,
    crop,
    overwrite,
  );

  if (overwrite) {
    const img = datasetStore.dataset.get(imageKey);
    if (img) {
      img.filePath = img.filePath.split('?')[0] + `?v=${Date.now()}`;
    }
  }

  return result;
}
