import type { ArrowDirection } from "@/types/composables";
import type { Ref } from "vue";

import { onActivated, onDeactivated, watch } from "vue";

export function useGridNavigation(
    imageKeys: Ref<string[]>,
    selectedImages: Ref<Set<string>>,
    lastSelectedIndex: Ref<number>,
    filteredImages: Ref<Set<string>>,
    isFiltering: Ref<boolean>,
    columns: Ref<number>
) {
    function getVisibleKeys() {
        if (!isFiltering.value)
            return imageKeys.value;

        return imageKeys.value.filter((imageId) => filteredImages.value.has(imageId));
    }

    function setSingleSelection(id: string) {
        selectedImages.value = new Set([id]);

        const visibleKeys = getVisibleKeys();
        const index = visibleKeys.indexOf(id);
        if (index !== -1)
            lastSelectedIndex.value = index;
    }

    function shouldIgnoreArrowKeys() {
        const element = document.activeElement as HTMLElement;
        if (!element)
            return false;

        const tag = element.tagName.toLowerCase();
        if (tag === "input" || tag === "select")
            return true;
        if (element.isContentEditable)
            return true;

        return false;
    }

    function navigateSelection(direction: ArrowDirection) {
        const visibleKeys = getVisibleKeys();
        const total = visibleKeys.length;
        if (total === 0)
            return;

        const cols = Math.max(1, columns.value);
        const currentIndex = Math.min(lastSelectedIndex.value, total - 1);

        let step = 0;
        if (direction === "left")
            step = -1;
        else if (direction === "right")
            step = 1;
        else if (direction === "up")
            step = -cols;
        else
            step = cols;

        let newIndex = currentIndex + step;
        newIndex = Math.min(total - 1, Math.max(0, newIndex));

        const id = visibleKeys[newIndex];
        if (!id)
            return;

        setSingleSelection(id);
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (shouldIgnoreArrowKeys())
            return;

        const isArrow = event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp" || event.key === "ArrowDown";
        if (!isArrow)
            return;

        event.preventDefault();
        if (event.key === "ArrowLeft")
            navigateSelection("left");
        else if (event.key === "ArrowRight")
            navigateSelection("right");
        else if (event.key === "ArrowUp")
            navigateSelection("up");
        else
            navigateSelection("down");
    }

    watch(isFiltering, (active) => {
        if (active)
            return;

        const imageId = selectedImages.value.values().next().value;
        if (!imageId)
            return;

        const index = imageKeys.value.indexOf(imageId);
        if (index !== -1)
            lastSelectedIndex.value = index;
    });

    onActivated(() => window.addEventListener("keydown", handleKeyDown));
    onDeactivated(() => window.removeEventListener("keydown", handleKeyDown));

    return { setSingleSelection }
}
