import type { Ref } from "vue";

import { onMounted, onUnmounted } from "vue";

export function useDismissTagSelection(selectedTags: Ref<Set<string>>, scope: string) {
    const selector = `[data-reorder-selection="${scope}"]`;

    function handleDocumentClick(event: MouseEvent) {
        const target = event.target;
        const clickedTag = target instanceof Element
            ? target.closest<HTMLElement>(selector)?.dataset.tag
            : undefined;

        if (event.ctrlKey && !event.shiftKey && clickedTag)
            return;

        if (clickedTag && selectedTags.value.has(clickedTag))
            return;

        if (selectedTags.value.size > 0)
            selectedTags.value = new Set();
    }

    onMounted(() => {
        document.addEventListener("click", handleDocumentClick, true);
    });

    onUnmounted(() => {
        document.removeEventListener("click", handleDocumentClick, true);
    });
}
