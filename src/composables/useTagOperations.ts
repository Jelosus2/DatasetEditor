import { toRaw } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';

export function useTagOperations() {
  const datasetStore = useDatasetStore();

  function validateTagPosition(position: number): number {
    if (isNaN(position) || !position || position < -1) return -1;
    if (!Number.isInteger(position)) position = parseInt(position.toString());
    return position;
  }

  function addTag(tagsInput: string, images: Set<string>, tagPosition = -1) {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);
    if (tags.length === 0 || images.size === 0) return;

    tagPosition = validateTagPosition(tagPosition);
    const previousState = new Map<string, Set<string>>();

    for (const image of Array.from(images)) {
      const imageWithTags = datasetStore.images.get(image);
      if (!imageWithTags) {
        images.delete(image);
        continue;
      }

      const allTagsExist = tags.every((tag) => imageWithTags.tags.has(tag));
      const tagsCopy = [...imageWithTags.tags];
      let shouldSkip = false;

      if (allTagsExist) {
        if (tagPosition === -1) {
          const endIndex = tagsCopy.length - tags.length;
          shouldSkip = tags.every((tag, index) => tagsCopy[endIndex + index] === tag);
        } else {
          const targetIndex = tagPosition - 1;
          shouldSkip = tags.every((tag, index) => {
            const currentIndex = tagsCopy.indexOf(tag);
            return currentIndex === targetIndex + index;
          });
        }

        if (shouldSkip) {
          images.delete(image);
          continue;
        }
      }

      previousState.set(image, new Set(imageWithTags.tags));

      for (const tag of tags) {
        if (!imageWithTags.tags.has(tag)) {
          if (!datasetStore.globalTags.has(tag)) {
            datasetStore.globalTags.set(tag, new Set([image]));
          } else {
            datasetStore.globalTags.get(tag)!.add(image);
          }
        }

        const existingIndex = tagsCopy.indexOf(tag);
        if (existingIndex !== -1) tagsCopy.splice(existingIndex, 1);

        if (datasetStore.tagDiff.size > 0) {
          const diff = datasetStore.tagDiff.get(image);
          if (diff?.tagger.has(tag)) diff.tagger.delete(tag);
          else diff?.original.add(tag);
        }
      }

      if (tagPosition === -1) {
        imageWithTags.tags = new Set([...tagsCopy, ...tags]);
      } else {
        const insertIndex = Math.min(tagPosition - 1, tagsCopy.length);
        tagsCopy.splice(insertIndex, 0, ...tags);
        imageWithTags.tags = new Set(tagsCopy);
      }
    }

    if (images.size === 0) return;

    datasetStore.pushDatasetChange({
      type: 'add_tag',
      images: new Set(images),
      tags: new Set(tags),
      tagPosition: toRaw(tagPosition),
      previousState,
    });

    datasetStore.onChange.forEach((fn) => fn());
  }

  function addGlobalTag(tagsInput: string, tagPosition = -1) {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);
    if (tags.length === 0) return;

    tagPosition = validateTagPosition(tagPosition);

    const allImageKeys = [...datasetStore.images.keys()];
    for (const image of allImageKeys) {
      const imageWithTags = datasetStore.images.get(image);
      for (const tag of tags) {
        if (tagPosition === -1) {
          imageWithTags?.tags.add(tag);
        } else {
          const tagsCopy = [...imageWithTags!.tags];
          tagsCopy.splice(tagPosition - 1, 0, tag);
          imageWithTags!.tags = new Set(tagsCopy);
        }
      }
    }

    for (const tag of tags) {
      datasetStore.globalTags.set(tag, new Set(allImageKeys));
    }

    datasetStore.pushDatasetChange({
      type: 'add_global_tag',
      tags: new Set(tags),
      tagPosition: toRaw(tagPosition),
    });

    datasetStore.onChange.forEach((fn) => fn());
  }

  function removeTag(tag: string, images: Set<string>) {
    if (!images.size) return;
    const imagesWithTag = datasetStore.globalTags.get(tag);

    datasetStore.pushDatasetChange({
      type: 'remove_tag',
      images: new Set(images),
      tags: new Set([tag]),
    });

    for (const image of images) {
      datasetStore.images.get(image)?.tags.delete(tag);
      imagesWithTag?.delete(image);

      if (datasetStore.tagDiff.size > 0) {
        datasetStore.tagDiff.get(image)?.original.delete(tag);
      }
    }

    if (!imagesWithTag?.size) {
      datasetStore.globalTags.delete(tag);
    }

    datasetStore.onChange.forEach((fn) => fn());
  }

  function removeGlobalTag(tag: string) {
    const imagesWithTag = new Set(datasetStore.globalTags.get(tag) ?? []);
    for (const image of imagesWithTag) {
      datasetStore.images.get(image)?.tags.delete(tag);
    }

    datasetStore.pushDatasetChange({
      type: 'remove_global_tag',
      images: imagesWithTag,
      tags: new Set([tag]),
    });

    datasetStore.globalTags.delete(tag);
    datasetStore.onChange.forEach((fn) => fn());
  }

  function replaceTag(originalTag: string, newTag: string, images: Set<string>) {
    if (!newTag || !originalTag || newTag === originalTag || images.size === 0) return;

    const previousState = new Map<string, Set<string>>();

    for (const image of Array.from(images)) {
      const imageWithTags = datasetStore.images.get(image)!;
      if (!imageWithTags.tags.has(originalTag)) {
        images.delete(image);
        continue;
      }

      previousState.set(image, new Set(imageWithTags.tags));

      const tagsCopy = [...imageWithTags.tags];
      const tagIndex = tagsCopy.indexOf(originalTag);

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

      const originalImages = datasetStore.globalTags.get(originalTag);
      originalImages?.delete(image);
      if (originalImages?.size === 0) {
        datasetStore.globalTags.delete(originalTag);
      }

      datasetStore.globalTags.get(originalTag)?.delete(image);

      if (!datasetStore.globalTags.has(newTag)) {
        datasetStore.globalTags.set(newTag, new Set([image]));
      } else {
        datasetStore.globalTags.get(newTag)!.add(image);
      }

      if (datasetStore.tagDiff.size > 0) {
        const diff = datasetStore.tagDiff.get(image);
        if (diff?.tagger.has(newTag)) diff.tagger.delete(newTag);
        else diff?.original.add(newTag);
      }
    }

    if (images.size === 0) return;

    datasetStore.pushDatasetChange({
      type: 'replace_tag',
      images: new Set(images),
      tags: new Set([newTag]),
      originalTag,
      newTag,
      previousState,
    });

    datasetStore.onChange.forEach((fn) => fn());
  }

  return {
    addTag,
    removeTag,
    addGlobalTag,
    removeGlobalTag,
    replaceTag,
    validateTagPosition,
  };
}
