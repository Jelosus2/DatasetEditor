import { ref, type Ref } from "vue";

export function useImageSelection(imageKeys: Ref<string[]>, filteredImages: Ref<Set<string>>, isFiltering: Ref<boolean>) {
    const selectedImages = ref<Set<string>>(new Set());
    const lastSelectedIndex = ref<number>(0);

    const toggleSelection = (id: string, event: MouseEvent) => {
        const index = imageKeys.value.indexOf(id);

        if (event.shiftKey) {
            const start = Math.min(lastSelectedIndex.value, index);
            const end = Math.max(lastSelectedIndex.value, index);
            const range = imageKeys.value.slice(start, end + 1);

            for (const image of range) {
                if (!isFiltering.value || filteredImages.value.has(image)) {
                    selectedImages.value.add(image);
                }
            }
        } else if (event.ctrlKey) {
            if (selectedImages.value.has(id)) {
                if (selectedImages.value.size > 1) {
                    selectedImages.value.delete(id);
                }
            } else {
                selectedImages.value.add(id);
            }
        } else {
            selectedImages.value = new Set([id]);
        }

        lastSelectedIndex.value = index;
        selectedImages.value = new Set(selectedImages.value);
    }

    const selectAll = () => {
        const targetSet = isFiltering.value && filteredImages.value.size > 0
            ? filteredImages.value
            : new Set(imageKeys.value);

        selectedImages.value = new Set(targetSet);
    }

    const clearSelection = () => {
        if (imageKeys.value.length === 0) {
            selectedImages.value = new Set();
            return;
        }

        const first = imageKeys.value[0];
        selectedImages.value = new Set([first]);
        lastSelectedIndex.value = 0;
    }

    return {
        selectedImages,
        lastSelectedIndex,
        toggleSelection,
        selectAll,
        clearSelection
    }
}
