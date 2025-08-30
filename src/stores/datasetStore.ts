import { defineStore } from 'pinia';
import { ref } from 'vue';
import { DatasetService } from '@/services/datasetService';
import { useSettingsStore } from '@/stores/settingsStore';

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
  const sortMode = ref('none');
  const onChange = ref<(() => void)[]>([]);
  const datasetService = new DatasetService();
  const settingsStore = useSettingsStore();

  function setImageTags(image: string, newTags: Set<string>) {
    const current = images.value.get(image)!.tags;
    for (const tag of current) {
      if (!newTags.has(tag)) {
        const imagesWithTag = globalTags.value.get(tag);
        imagesWithTag?.delete(image);
        if (imagesWithTag?.size === 0) globalTags.value.delete(tag);
      }
    }

    for (const tag of newTags) {
      if (!globalTags.value.has(tag)) {
        globalTags.value.set(tag, new Set([image]));
      } else {
        globalTags.value.get(tag)!.add(image);
      }
    }

    images.value.get(image)!.tags = new Set(newTags);
  }

  function addTagsToImages(imgs: Iterable<string>, tags: Set<string>, position = -1, previousState?: Map<string, Set<string>>) {
    for (const image of imgs) {
      const base = previousState?.get(image) ?? images.value.get(image)!.tags;
      const tagArray = [...base];
      if (position === -1) {
        images.value.get(image)!.tags = new Set([...tagArray, ...tags]);
      } else {
        const copy = [...tagArray];
        copy.splice(position - 1, 0, ...tags);
        images.value.get(image)!.tags = new Set(copy);
      }

      for (const tag of tags) {
        if (!globalTags.value.has(tag)) {
          globalTags.value.set(tag, new Set([image]));
        } else {
          globalTags.value.get(tag)!.add(image);
        }
      }
    }
  }

  function removeTagsFromImages(imgs: Iterable<string>, tags: Set<string>) {
    for (const image of imgs) {
      for (const tag of tags) {
        images.value.get(image)?.tags.delete(tag);
        const imagesWithTag = globalTags.value.get(tag);
        imagesWithTag?.delete(image);
        if (imagesWithTag?.size === 0) globalTags.value.delete(tag);
      }
    }
  }

  function replaceTagForImages(imgs: Iterable<string>, originalTag: string, newTag: string) {
    for (const image of imgs) {
      const imageWithTags = images.value.get(image)!;
      const tagsCopy = [...imageWithTags.tags];
      const tagIndex = tagsCopy.indexOf(originalTag);
      if (tagIndex === -1) continue;

      tagsCopy.splice(tagIndex, 1);
      const existingIndex = tagsCopy.indexOf(newTag);
      if (existingIndex !== -1) {
        tagsCopy.splice(existingIndex, 1);
        if (existingIndex < tagIndex) {
          tagsCopy.splice(tagIndex - 1, 0, newTag);
        } else {
          tagsCopy.splice(tagIndex, 0, newTag);
        }
      } else {
        tagsCopy.splice(tagIndex, 0, newTag);
      }
      imageWithTags.tags = new Set(tagsCopy);

      const originalImages = globalTags.value.get(originalTag);
      originalImages?.delete(image);
      if (originalImages?.size === 0) globalTags.value.delete(originalTag);

      if (!globalTags.value.has(newTag)) {
        globalTags.value.set(newTag, new Set([image]));
      } else {
        globalTags.value.get(newTag)!.add(image);
      }
    }
  }

  function pushDatasetChange(change: DatasetChangeRecord) {
    datasetUndoStack.value.push(change);
    datasetRedoStack.value = [];
  }

  function undoDatasetAction() {
    const change = datasetUndoStack.value.pop();
    if (!change) return;

    switch (change.type) {
      case 'add_tag':
        for (const [image, previousTags] of change.previousState!.entries()) {
          setImageTags(image, previousTags);
        }
        break;
      case 'add_global_tag':
        removeTagsFromImages(images.value.keys(), change.tags);
        break;
      case 'remove_tag':
        for (const [image, previousTags] of change.previousState!.entries()) {
          setImageTags(image, previousTags);
        }
        break;
      case 'remove_global_tag':
        for (const [image, previousTags] of change.previousState!.entries()) {
          setImageTags(image, previousTags);
        }
        break;
      case 'replace_tag':
        for (const [image, previousTags] of change.previousState!.entries()) {
          setImageTags(image, previousTags);
        }
        break;
    }

    datasetRedoStack.value.push(change);
    onChange.value.forEach((fn) => fn());
  }

  function redoDatasetAction() {
    const change = datasetRedoStack.value.pop();
    if (!change) return;

    switch (change.type) {
      case 'add_tag':
        addTagsToImages(change.images!, change.tags, change.tagPosition, change.previousState);
        break;
      case 'add_global_tag':
        addTagsToImages(images.value.keys(), change.tags, change.tagPosition);
        break;
      case 'remove_tag':
        removeTagsFromImages(change.images!, change.tags);
        break;
      case 'remove_global_tag':
        removeTagsFromImages(change.images!, change.tags);
        break;
      case 'replace_tag':
        replaceTagForImages(change.images!, change.originalTag!, change.newTag!);
        break;
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
      reload ? directory.value : null,
      settingsStore.recursiveDatasetLoad,
      settingsStore.sortImagesAlphabetically,
    );

    if (!dataset) return false;

    images.value = dataset.images;
    globalTags.value = dataset.globalTags;
    directory.value = dataset.directoryPath;
    resetDatasetStatus();

    return true;
  }

  async function saveDataset() {
    if (images.value.size === 0) {
      throw new Error('The dataset has not been loaded yet');
    }

    const shouldSort = sortMode.value === 'alphabetical';
    const datasetObj = datasetService.datasetToSaveFormat(images.value, shouldSort);
    await datasetService.saveDataset(datasetObj, shouldSort);
  }

  async function isDatasetSaved() {
    const shouldSort = sortMode.value === 'alphabetical';
    return datasetService.compareDatasetChanges(
      datasetService.imagesToObject(images.value, shouldSort)
    );
  }

  return {
    images,
    globalTags,
    directory,
    sortMode,
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
