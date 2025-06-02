import { computed, ref, type Ref } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';

export function useTagDisplay(
  selectedImages: Ref<Set<string>>,
  filterInput: Ref<string>,
  filterMode: Ref<string>,
  sortOrder: Ref<string>,
  globalSortMode: Ref<string>,
  globalSortOrder: Ref<string>
) {
  const datasetStore = useDatasetStore();
  const updateTrigger = ref(0);

  const triggerUpdate = () => {
    updateTrigger.value++;
  };

  const displayedTags = computed<Set<string>>(() => {
    void updateTrigger.value;

    const allTags: string[] = [];
    for (const imageName of selectedImages.value) {
      const image = datasetStore.images.get(imageName);
      if (image && image.tags) image.tags.forEach((tag) => allTags.push(tag));
    }

    if (!allTags.length) return new Set();

    const [firstTag, ...remainingTags] = allTags;

    let rest = remainingTags;
    if (datasetStore.sortMode === 'alphabetical') {
      rest = [...rest].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    }

    const sorted = [firstTag, ...(sortOrder.value === 'desc' ? rest.reverse() : rest)];
    return new Set(sorted);
  });

  const displayedGlobalTags = computed<Set<string>>(() => {
    void updateTrigger.value;

    const allTags = Array.from(datasetStore.globalTags.keys());
    if (!allTags.length) return new Set();

    if (globalSortMode.value === 'alphabetical') {
      allTags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    } else {
      allTags.sort(
        (a, b) => datasetStore.globalTags.get(b)!.size - datasetStore.globalTags.get(a)!.size
      );
    }

    if (globalSortOrder.value === 'desc') allTags.reverse();

    return new Set(allTags);
  });

  const filteredImages = computed<Set<string>>(() => {
    void updateTrigger.value;
    const result = new Set<string>();
    if (!filterInput.value) return result;

    const tags = filterInput.value
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t);

    if (filterMode.value === 'or') {
      for (const tag of tags) {
        datasetStore.globalTags.get(tag)?.forEach((img) => result.add(img));
      }
    } else if (filterMode.value === 'and') {
      const count = new Map<string, number>();
      for (const tag of tags) {
        const images = datasetStore.globalTags.get(tag);
        if (!images) return result;
        images.forEach((img) => count.set(img, (count.get(img) || 0) + 1));
      }
      for (const [img, c] of count.entries()) {
        if (c === tags.length) result.add(img);
      }
    } else if (filterMode.value === 'no') {
      const excluded = new Set<string>();
      for (const tag of tags) {
        datasetStore.globalTags.get(tag)?.forEach((img) => excluded.add(img));
      }
      datasetStore.images.forEach((_image, name) => {
        if (!excluded.has(name)) result.add(name);
      });
    }

    return result;
  });

  return { displayedTags, displayedGlobalTags, filteredImages, triggerUpdate };
}
