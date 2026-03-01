import type { Ref } from "vue";

import { ref, toRaw } from "vue";

export function useImageSelection(imageKeys: Ref<string[]>, filteredImages: Ref<Set<string>>, isFiltering: Ref<boolean>) {
    const selectedImages = ref<Set<string>>(new Set());
    const lastSelectedIndex = ref(0);
    const rangeAnchorIndex = ref(0);

    function toggleSelection(imageId: string, event: MouseEvent) {
        const rawImageKeys = toRaw(imageKeys.value);

        const index = rawImageKeys.indexOf(imageId);
        if (index === -1)
            return;

        const newSelection = new Set(toRaw(selectedImages.value));

        if (event.shiftKey) {
            const start = Math.min(rangeAnchorIndex.value, index);
            const end = Math.max(rangeAnchorIndex.value, index);
            const rawFilteredImages = toRaw(filteredImages.value);

            newSelection.clear();

            for (let i = start; i <= end; i++) {
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

            rangeAnchorIndex.value = index;
        } else {
            newSelection.clear();
            newSelection.add(imageId);
            rangeAnchorIndex.value = index;
        }

        lastSelectedIndex.value = index;
        selectedImages.value = newSelection;
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
        clearSelection
    }
}
