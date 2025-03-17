import { defineStore } from 'pinia';
import { ref, type Ref } from 'vue';

interface ChangeRecord {
  type: 'add_tag' | 'remove_tag' | 'add_global_tag' | 'remove_global_tag';
  images?: Set<string>;
  tags: Set<string>;
  previousState?: Map<string, Set<string>>;
}

export const useHistoryStore = defineStore('history', () => {
  const undoStack = ref<ChangeRecord[]>([]);
  const redoStack = ref<ChangeRecord[]>([]);
  const onChange = ref<(() => void)[]>([]);

  function pushChange(change: ChangeRecord) {
    undoStack.value.push(change);
    redoStack.value = [];
  }

  function undo(
    images: Ref<Map<string, { tags: Set<string>; path: string }>>,
    globalTags: Ref<Map<string, Set<string>>>,
  ) {
    const change = undoStack.value.pop();
    console.log(change);
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

      redoStack.value.push({
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

      redoStack.value.push({
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

      redoStack.value.push({
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

      redoStack.value.push({
        type: 'remove_global_tag',
        tags: change.tags,
      });
    }

    onChange.value.forEach((fn) => fn());
  }

  function redo(
    images: Ref<Map<string, { tags: Set<string>; path: string }>>,
    globalTags: Ref<Map<string, Set<string>>>,
  ) {
    const change = redoStack.value.pop();
    console.log(change);
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

      undoStack.value.push({
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

      undoStack.value.push({
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

      undoStack.value.push({
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

      undoStack.value.push({
        type: 'remove_global_tag',
        tags: change.tags,
      });
    }

    onChange.value.forEach((fn) => fn());
  }

  return {
    undoStack,
    redoStack,
    onChange,
    pushChange,
    undo,
    redo,
  };
});
