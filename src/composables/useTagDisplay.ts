import { computed, toRaw, type Ref } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';

export function useTagDisplay(
    selectedImages: Ref<Set<string>>,
    filterInput: Ref<string>,
    filterMode: Ref<string>,
    sortOrder: Ref<string>,
    globalSortMode: Ref<string>,
    globalSortOrder: Ref<string>,
    globalTagFilterInput: Ref<string>,
) {
    const datasetStore = useDatasetStore();

    const displayedTags = computed<Set<string>>(() => {
        void datasetStore.dataVersion;

        const rawDataset = toRaw(datasetStore.dataset);

        const allTags: string[] = [];
        for (const imageId of selectedImages.value) {
            const imageData = rawDataset.get(imageId);
            if (imageData?.tags)
                imageData.tags.forEach((tag) => allTags.push(tag));
        }

        const output = new Set<string>();

        if (allTags.length === 0)
            return output;

        const firstTag = allTags[0];
        let rest = allTags.length > 1 ? allTags.slice(1) : [];

        if (datasetStore.sortMode === 'alphabetical') {
            const keyed = rest.map((s) => [s, s.toLocaleLowerCase()]);
            keyed.sort((a, b) => a[1].localeCompare(b[1]));
            rest = keyed.map(([s]) => s);
        }

        if (sortOrder.value === "desc")
            rest.reverse();

        output.add(firstTag);
        for (const tag of rest)
            output.add(tag);

        return output;
    });

    const displayedGlobalTags = computed<Set<string>>(() => {
        void datasetStore.dataVersion;

        const rawGlobalTags = toRaw(datasetStore.globalTags);

        const output = new Set<string>();

        let allTags = Array.from(rawGlobalTags.keys());
        if (allTags.length === 0)
            return output;

        if (globalSortMode.value === 'alphabetical') {
            const keyed = allTags.map(s => [s, s.toLocaleLowerCase()]);
            keyed.sort((a, b) => a[1].localeCompare(b[1]));
            allTags = keyed.map(([s]) => s);
        } else {
            const keyed = allTags.map(s => [s, datasetStore.globalTags.get(s)?.size ?? 0]);
            keyed.sort((a, b) => (b[1] as number) - (a[1] as number));
            allTags = keyed.map(([s]) => s as string);
        }

        if (globalSortOrder.value === 'desc')
            allTags.reverse();

        const filterTags = globalTagFilterInput.value
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);

        if (filterTags.length === 0) {
            for (const tag of allTags)
                output.add(tag);

            return output;
        }

        for (const tag of allTags) {
            const lowerTag = tag.toLowerCase();

            for (const filterTag of filterTags) {
                if (lowerTag.includes(filterTag)) {
                    output.add(tag);
                    break;
                }
            }
        }

        return output;
    });

    const filteredImages = computed<Set<string>>(() => {
        void datasetStore.dataVersion;

        const rawDataset = toRaw(datasetStore.dataset);
        const rawGlobalTags = toRaw(datasetStore.globalTags);

        const result = new Set<string>();
        if (!filterInput.value)
            return result;

        const tags = filterInput.value
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);

        if (filterMode.value === 'or') {
            for (const tag of tags) {
                const globalSet = rawGlobalTags.get(tag);
                if (globalSet)
                    globalSet.forEach((imageId) => result.add(imageId));
            }
        } else if (filterMode.value === 'and') {
            const countMap = new Map<string, number>();

            for (const tag of tags) {
                const globalSet = rawGlobalTags.get(tag);
                if (!globalSet)
                    return result;

                globalSet.forEach((imageId) => countMap.set(imageId, (countMap.get(imageId) || 0) + 1));
            }

            for (const [imageId, count] of countMap.entries()) {
                if (count === tags.length)
                    result.add(imageId);
            }
        } else if (filterMode.value === 'no') {
            const excluded = new Set<string>();

            for (const tag of tags) {
                const globalSet = rawGlobalTags.get(tag);
                if (globalSet)
                    globalSet.forEach((imageId) => excluded.add(imageId));
            }

            for (const imageId of rawDataset.keys()) {
                if (!excluded.has(imageId))
                    result.add(imageId);
            }

            datasetStore.dataset.forEach((_image, name) => {
                if (!excluded.has(name)) result.add(name);
            });
        }

        return result;
    });

    return {
        displayedTags,
        displayedGlobalTags,
        filteredImages
    };
}
