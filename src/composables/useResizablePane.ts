import type { ResizablePaneOptions } from "@/types/composables";
import type { Ref } from "vue";

import { ref } from "vue";

export function useResizablePane(containerRef: Ref<HTMLElement | null>, initialWidth: number, options: ResizablePaneOptions) {
    const containerWidth = ref(initialWidth);
    const isResizing = ref(false);

    function startResize (event: MouseEvent) {
        event.preventDefault();
        isResizing.value = true;

        const startX = event.clientX;
        const startWidth = containerRef.value?.getBoundingClientRect().width ?? containerWidth.value;
        const parentWidth = containerRef.value?.parentElement?.getBoundingClientRect().width ?? window.innerWidth;

        const minWidth = parentWidth * options.minPercent;
        const maxWidth = Math.max(minWidth, parentWidth * options.maxPercent);

        function onMouseMove(mouseEvent: MouseEvent) {
            const delta = mouseEvent.clientX - startX;
            const newWidth = startWidth + delta;

            containerWidth.value = Math.min(maxWidth, Math.max(minWidth, newWidth));
        }

        function onMouseUp() {
            isResizing.value = false;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }

    return {
        containerWidth,
        startResize
    };
}
