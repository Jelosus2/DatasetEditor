import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DatasetService } from '@/services/datasetService';

interface DatasetChangeRecord {
  type: 'add_tag' | 'remove_tag' | 'add_global_tag' | 'remove_global_tag' | 'replace_tag';
  images?: Set<string>;
  tags: Set<string>;
  tagPosition?: number;
  previousState?: Map<string, Set<string>>;
  originalTag?: string;
  newTag?: string;
}

export interface Image {
  tags: Set<string>;
  path: string;
  filePath: string;
}

interface TagDiff {
  tagger: Set<string>;
  original: Set<string>;
}

export const useDatasetStore = defineStore('dataset', () => {
  const images = ref<Map<string, Image>>(new Map());
  const globalTags = ref<Map<string, Set<string>>>(new Map());
  const tagDiff = ref<Map<string, TagDiff>>(new Map());
  const datasetUndoStack = ref<DatasetChangeRecord[]>([]);
  const datasetRedoStack = ref<DatasetChangeRecord[]>([]);
  const directory = ref('');
  const onChange = ref<(() => void)[]>([]);
  const datasetService = new DatasetService()

  function pushDatasetChange(change: DatasetChangeRecord) {
    datasetUndoStack.value.push(change);
    datasetRedoStack.value = [];
  }

  function undoDatasetAction() {
    const change = datasetUndoStack.value.pop();
    if (!change) return;

    if (change.type === 'add_tag') {
      for (const [image, previousTags] of change.previousState!.entries()) {
        images.value.get(image)!.tags = previousTags;
      }

      for (const tag of change.tags) {
        const imagesWithTag = globalTags.value.get(tag);
        if (imagesWithTag) {
          change.images?.forEach((img) => imagesWithTag.delete(img));
          if (imagesWithTag.size === 0) globalTags.value.delete(tag);
        }
      }
    } else if (change.type === 'add_global_tag') {
      for (const image of images.value.values()) {
        for (const tag of change.tags) {
          image.tags.delete(tag);
          globalTags.value.delete(tag);
        }
      }
    } else if (change.type === 'remove_tag') {
      for (const image of change.images!) {
        for (const tag of change.tags) {
          images.value.get(image)!.tags.add(tag);

          if (!globalTags.value.has(tag)) {
            globalTags.value.set(tag, new Set([image]));
          } else {
            globalTags.value.get(tag)?.add(image);
          }
        }
      }
    } else if (change.type === 'remove_global_tag') {
      for (const image of change.images!) {
        const originalImage = images.value.get(image)!;

        for (const tag of change.tags) {
          originalImage.tags.add(tag);
          if (!globalTags.value.has(tag)) {
            globalTags.value.set(tag, new Set([image]));
          } else {
            globalTags.value.get(tag)?.add(image);
          }
        }
      }
    } else if (change.type === 'replace_tag') {
      for (const [image, previousTags] of change.previousState!.entries()) {
        images.value.get(image)!.tags = previousTags;
      }

      const originalTag = change.originalTag!;
      const newTag = change.newTag!;

      for (const image of change.images!) {
        globalTags.value.get(newTag)?.delete(image);
        if (globalTags.value.get(newTag)?.size === 0) {
          globalTags.value.delete(newTag);
        }

        if (!globalTags.value.has(originalTag)) {
          globalTags.value.set(originalTag, new Set([image]));
        } else {
          globalTags.value.get(originalTag)?.add(image);
        }
      }
    }

    datasetRedoStack.value.push(change);
    onChange.value.forEach((fn) => fn());
  }

  function redoDatasetAction() {
    const change = datasetRedoStack.value.pop();
    if (!change) return;

    if (change.type === 'add_tag') {
      for (const [image, previousTags] of change.previousState!.entries()) {
        if (change.tagPosition === -1) {
          images.value.get(image)!.tags = new Set([...previousTags, ...change.tags]);
        } else {
          const tagsCopy = [...previousTags];
          tagsCopy.splice(change.tagPosition! - 1, 0, ...change.tags);
          images.value.get(image)!.tags = new Set(tagsCopy);
        }

        for (const tag of change.tags) {
          if (!globalTags.value.has(tag)) {
            globalTags.value.set(tag, new Set([image]));
          } else {
            globalTags.value.get(tag)!.add(image);
          }
        }
      }
    } else if (change.type === 'add_global_tag') {
      for (const [image, props] of images.value.entries()) {
        if (change.tagPosition === -1) {
          images.value.get(image)!.tags = new Set([...props.tags, ...change.tags]);
        } else {
          const tagsCopy = [...props.tags];
          tagsCopy.splice(change.tagPosition! - 1, 0, ...change.tags);
          images.value.get(image)!.tags = new Set(tagsCopy);
        }

        for (const tag of change.tags) {
          if (!globalTags.value.has(tag)) {
            globalTags.value.set(tag, new Set([image]));
          } else {
            globalTags.value.get(tag)?.add(image);
          }
        }
      }
    } else if (change.type === 'remove_tag') {
      for (const image of change.images!) {
        for (const tag of change.tags) {
          images.value.get(image)!.tags.delete(tag);
          globalTags.value.get(tag)?.delete(image);
          if (globalTags.value.get(tag)?.size === 0) globalTags.value.delete(tag);
        }
      }
    } else if (change.type === 'remove_global_tag') {
      for (const image of change.images!) {
        for (const tag of change.tags) {
          images.value.get(image)?.tags.delete(tag);
          globalTags.value.delete(tag);
        }
      }
    } else if (change.type === 'replace_tag') {
      const originalTag = change.originalTag!;
      const newTag = change.newTag!;

      for (const image of change.images!) {
        const imageWithTags = images.value.get(image)!;
        const tagsCopy = [...imageWithTags.tags];
        const tagIndex = tagsCopy.indexOf(originalTag);
        tagsCopy.splice(tagIndex, 1, newTag);
        imageWithTags.tags = new Set(tagsCopy);

        globalTags.value.get(originalTag)?.delete(image);
        if (globalTags.value.get(originalTag)?.size === 0) {
          globalTags.value.delete(originalTag);
        }

        if (!globalTags.value.has(newTag)) {
          globalTags.value.set(newTag, new Set([image]));
        } else {
          globalTags.value.get(newTag)?.add(image);
        }
      }
    }

    datasetUndoStack.value.push(change);
    onChange.value.forEach((fn) => fn());
  }

  function resetDatasetStatus() {
    datasetUndoStack.value = [];
    datasetRedoStack.value = [];
  }

  async function loadDataset(reload = false) {
    const _isDatasetSaved = await isDatasetSaved();

    const dataset = await datasetService.loadDataset(
      _isDatasetSaved,
      reload ? directory.value : null
    );

    if (!dataset) return;

    images.value = dataset.images;
    globalTags.value = dataset.globalTags;
    directory.value = dataset.directoryPath;
    resetDatasetStatus();
  }

  async function saveDataset() {
    if (images.value.size === 0) {
      throw new Error('The dataset has not been loaded yet');
    }

    const datasetObj = datasetService.datasetToSaveFormat(images.value);
    await datasetService.saveDataset(datasetObj);
  }

  async function isDatasetSaved() {
    return datasetService.compareDatasetChanges(
      datasetService.imagesToObject(images.value)
    );
  }

  return {
    images,
    globalTags,
    directory,
    tagDiff,
    onChange,
    pushDatasetChange,
    undoDatasetAction,
    redoDatasetAction,
    resetDatasetStatus,
    loadDataset,
    saveDataset,
    isDatasetSaved
  };
});
