import { defineStore } from 'pinia';
import { ref } from 'vue';

interface DatasetChangeRecord {
  type: 'add_tag' | 'remove_tag' | 'add_global_tag' | 'remove_global_tag';
  images?: Set<string>;
  tags: Set<string>;
  tagPosition?: number;
  previousState?: Map<string, Set<string>>;
}

interface Image {
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
    }

    datasetUndoStack.value.push(change);
    onChange.value.forEach((fn) => fn());
  }

  function resetDatasetStatus() {
    datasetUndoStack.value = [];
    datasetRedoStack.value = [];
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
  };
});
