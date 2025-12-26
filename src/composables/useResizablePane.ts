import { ref, type Ref } from "vue";

export function useResizablePane(containerRef: Ref<HTMLElement | null>, initialWidth: number) {
    const containerWidth = ref<number>(initialWidth);
    const isResizing = ref<boolean>(false);

    function startResize (event: MouseEvent) {
        event.preventDefault();
        isResizing.value = true;

        const startX = event.clientX;
        const startWidth = containerWidth.value;
        const parentWidth = containerRef.value?.parentElement?.getBoundingClientRect().width || window.innerWidth;

        const minWidth = Math.max(200, parentWidth * 0.15);
        const maxWidth = Math.max(minWidth, parentWidth * 0.4);

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
    }
}
