import type { Ref } from "vue";

import { ref, toRaw } from "vue";

export function useImageSelection(imageKeys: Ref<string[]>, filteredImages: Ref<Set<string>>, isFiltering: Ref<boolean>) {
    const selectedImages = ref<Set<string>>(new Set());
    const lastSelectedIndex = ref<number>(0);

    function toggleSelection(imageId: string, event: MouseEvent) {
        const rawImageKeys = toRaw(imageKeys.value);

        const index = rawImageKeys.indexOf(imageId);
        if (index === -1)
            return;

        const newSelection = new Set(toRaw(selectedImages.value));

        if (event.shiftKey) {
            const start = Math.min(lastSelectedIndex.value, index);
            const end = Math.max(lastSelectedIndex.value, index);
            const rawFilteredImages = toRaw(filteredImages.value);

            for (let i = start; i < end; i++) {
                const imageId = rawImageKeys[i];
                if (!isFiltering.value || rawFilteredImages.has(imageId))
                    newSelection.add(imageId);
            }
        } else if (event.ctrlKey) {
            if (newSelection.has(imageId)) {
                if (newSelection.size > 1) {
                    newSelection.delete(imageId);
                }
            } else {
                newSelection.add(imageId);
            }
        } else {
            newSelection.clear();
            newSelection.add(imageId);
        }

        lastSelectedIndex.value = index;
        selectedImages.value = newSelection;
    }

    function selectAllImages() {
        const targetSet = isFiltering.value && filteredImages.value.size > 0
            ? toRaw(filteredImages.value)
            : toRaw(imageKeys.value);

        selectedImages.value = new Set(targetSet);
    }

    function clearSelection() {
        const rawImageKeys = toRaw(imageKeys.value);

        if (rawImageKeys.length === 0) {
            selectedImages.value = new Set();
            return;
        }

        const first = rawImageKeys[0];
        selectedImages.value = new Set([first]);
        lastSelectedIndex.value = 0;
    }

    return {
        selectedImages,
        lastSelectedIndex,
        toggleSelection,
        selectAllImages,
        clearSelection
    }
}
