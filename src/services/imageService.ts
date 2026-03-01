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
