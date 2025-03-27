import { defineStore } from 'pinia';
import { ref } from 'vue';

interface DatasetChangeRecord {
  type: 'add_tag' | 'remove_tag' | 'add_global_tag' | 'remove_global_tag';
  images?: Set<string>;
  tags: Set<string>;
  previousState?: Map<string, Set<string>>;
}

export const useDatasetStore = defineStore('dataset', () => {
  const images = ref<Map<string, { tags: Set<string>; path: string }>>(new Map());
  const globalTags = ref<Map<string, Set<string>>>(new Map());
  const tagDiff = ref<Map<string, { tagger: Set<string>; original: Set<string> }>>(new Map());

  const datasetUndoStack = ref<DatasetChangeRecord[]>([]);
  const datasetRedoStack = ref<DatasetChangeRecord[]>([]);
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

      datasetRedoStack.value.push({
        type: 'add_tag',
        images: change.images,
        tags: change.tags,
      });
    } else if (change.type === 'add_global_tag') {
      for (const image of images.value.values()) {
        for (const tag of change.tags) {
          image.tags.delete(tag);
          globalTags.value.delete(tag);
        }
      }

      datasetRedoStack.value.push({
        type: 'add_global_tag',
        tags: change.tags,
      });
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

      datasetRedoStack.value.push({
        type: 'remove_tag',
        images: change.images,
        tags: change.tags,
      });
    } else if (change.type === 'remove_global_tag') {
      for (const [image, props] of images.value.entries()) {
        for (const tag of change.tags) {
          props.tags.add(tag);
          if (!globalTags.value.has(tag)) {
            globalTags.value.set(tag, new Set([image]));
          } else {
            globalTags.value.get(tag)?.add(image);
          }
        }
      }

      datasetRedoStack.value.push({
        type: 'remove_global_tag',
        tags: change.tags,
      });
    }

    onChange.value.forEach((fn) => fn());
  }

  function redoDatasetAction() {
    const change = datasetRedoStack.value.pop();
    if (!change) return;

    const previousState = new Map<string, Set<string>>();
    if (change.type === 'add_tag') {
      for (const image of change.images!) {
        const imageTags = images.value.get(image);
        if (imageTags) previousState.set(image, new Set(imageTags.tags));

        for (const tag of change.tags) {
          images.value.get(image)!.tags.add(tag);
          if (!globalTags.value.has(tag)) {
            globalTags.value.set(tag, new Set([image]));
          } else {
            globalTags.value.get(tag)!.add(image);
          }
        }
      }

      datasetUndoStack.value.push({
        type: 'add_tag',
        images: change.images,
        tags: change.tags,
        previousState,
      });
    } else if (change.type === 'add_global_tag') {
      for (const [image, props] of images.value.entries()) {
        const tag = change.tags.values().next().value!;

        props.tags.add(tag);
        if (!globalTags.value.has(tag)) {
          globalTags.value.set(tag, new Set([image]));
        } else {
          globalTags.value.get(tag)?.add(image);
        }
      }

      datasetUndoStack.value.push({
        type: 'add_global_tag',
        tags: change.tags,
      });
    } else if (change.type === 'remove_tag') {
      for (const image of change.images!) {
        for (const tag of change.tags) {
          images.value.get(image)!.tags.delete(tag);
          globalTags.value.get(tag)?.delete(image);
          if (globalTags.value.get(tag)?.size === 0) globalTags.value.delete(tag);
        }
      }

      datasetUndoStack.value.push({
        type: 'remove_tag',
        images: change.images,
        tags: change.tags,
      });
    } else if (change.type === 'remove_global_tag') {
      for (const image of images.value.values()) {
        for (const tag of change.tags) {
          image.tags.delete(tag);
          globalTags.value.delete(tag);
        }
      }

      datasetUndoStack.value.push({
        type: 'remove_global_tag',
        tags: change.tags,
      });
    }

    onChange.value.forEach((fn) => fn());
  }

  return {
    images,
    globalTags,
    tagDiff,
    onChange,
    pushDatasetChange,
    undoDatasetAction,
    redoDatasetAction,
  };
});
