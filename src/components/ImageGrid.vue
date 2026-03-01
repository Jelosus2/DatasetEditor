<script setup lang="ts">
import AutocompletionInput from "@/components/AutocompletionInput.vue";
import VirtualImage from "@/components/VirtualImage.vue";

import { useDatasetStore } from "@/stores/datasetStore";
import { computed, onActivated, onDeactivated, ref, watch, toRaw } from "vue";

const selectedImages = defineModel<Set<string>>("selectedImages", { required: true });
const filterInput = defineModel<string>("filterInput", { required: true });
const filterMode = defineModel<string>("filterMode", { required: true });

const props = defineProps<{
    filteredImages: Set<string>;
    isFiltering: boolean
}>();

const emit = defineEmits<{
    (e: "toggle-selection", id: string, event: MouseEvent): void;
    (e: "hover-image", id: string | undefined): void;
    (e: "display-full-image", id: string): void;
    (e: "clear-filter"): void;
    (e: "grid-metrics", metrics: { columns: number }): void;
}>();

const datasetStore = useDatasetStore();

const autocompleteList = computed(() => {
    void datasetStore.dataVersion;

    return [...datasetStore.globalTags.keys()];
});

const selectedSet = computed(() => selectedImages.value);

const containerRef = ref<HTMLElement | null>(null);
const scrollTop = ref(0);
const containerWidth = ref(0);
const containerHeight = ref(0);

const MIN_COLUMN_WIDTH = 100;
const GAP = 4;
const BUFFER_ROWS = 6;

const allImages = computed(() => {
    void datasetStore.dataVersion;

    return Array.from(toRaw(datasetStore.dataset).entries());
});

const visibleImages = computed(() => {
    if (!props.isFiltering)
        return allImages.value;

    return allImages.value.filter(([imageId]) => props.filteredImages.has(imageId));
});

const layout = computed(() => {
    const width = containerWidth.value;
    if (width === 0)
        return { columns: 1, cellHeight: 150 }

    let columns = Math.floor((width + GAP) / (MIN_COLUMN_WIDTH + GAP));
    if (columns < 1)
        columns = 1;

    const availableWidth = width - (columns - 1) * GAP;
    const cellWidth = Math.floor(availableWidth / columns);

    return { columns, cellHeight: cellWidth }
});

const gridMetrics = computed(() => ({
    columns: layout.value.columns
}));

const virtualState = computed(() => {
    const totalItems = visibleImages.value.length;
    const { columns, cellHeight } = layout.value;
    const rowHeight = cellHeight + GAP;

    const totalRows = Math.ceil(totalItems / columns);
    const totalHeight = Math.max(0, totalRows * rowHeight - GAP);

    const startRow = Math.floor(scrollTop.value / rowHeight);
    const visibleRowCount = Math.ceil(containerHeight.value / rowHeight);

    const bufferedStartRow = Math.max(0, startRow - BUFFER_ROWS);
    const bufferedEndRow = Math.min(totalRows, startRow + visibleRowCount + BUFFER_ROWS);

    const startIndex = bufferedStartRow * columns;
    const endIndex = Math.min(totalItems, bufferedEndRow * columns);

    const paddingTop = bufferedStartRow * rowHeight;

    const visibleItems = visibleImages.value.slice(startIndex, endIndex);

    return {
        totalHeight,
        paddingTop,
        visibleItems,
        columns,
        cellHeight
    }
});

watch(gridMetrics, (metrics) => {
    emit("grid-metrics", metrics);
}, { immediate: true });

let rafId: number | null = null;

function onScroll(event: Event) {
    if (rafId !== null)
        return;

    rafId = requestAnimationFrame(() => {
        scrollTop.value = (event.target as HTMLElement).scrollTop;
        rafId = null;
    });
}

const clickTimers = new Map<string, number>();

function handleClick(imageKey: string, event: MouseEvent) {
    const existing = clickTimers.get(imageKey);
    if (existing) {
        clearTimeout(existing);
        clickTimers.delete(imageKey);
    }

    const timer = setTimeout(() => {
        emit("toggle-selection", imageKey, event);
        clickTimers.delete(imageKey);
    }, 200);

    clickTimers.set(imageKey, timer);
}

function handleDblClick(imageKey: string) {
    const existing = clickTimers.get(imageKey);
    if (existing) {
        clearTimeout(existing);
        clickTimers.delete(imageKey);
    }

    emit("display-full-image", imageKey);
}

let resizeObserver: ResizeObserver | null = null;

onActivated(() => {
    if (!containerRef.value)
        return;

    containerWidth.value = containerRef.value.clientWidth;
    containerHeight.value = containerRef.value.clientHeight;

    if (!resizeObserver) {
        resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    containerWidth.value = entry.contentRect.width;
                    containerHeight.value = entry.contentRect.height;
                }
            }
        });
    }

    resizeObserver.observe(containerRef.value);
    containerRef.value.addEventListener("scroll", onScroll, { passive: true });
});

onDeactivated(() => {
    if (rafId !== null)
        cancelAnimationFrame(rafId);
    if (resizeObserver)
        resizeObserver.disconnect();
    if (containerRef.value)
        containerRef.value.removeEventListener("scroll", onScroll);
});
</script>

<template>
    <div
        ref="containerRef"
        class="h-full w-full overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-stable"
    >
        <div v-if="datasetStore.dataset.size > 0" :style="{ height: virtualState.totalHeight + 'px', position: 'relative' }">
            <div
                :style="{
                    transform: `translateY(${virtualState.paddingTop}px)`,
                    display: 'grid',
                    gridTemplateColumns: `repeat(${virtualState.columns}, minmax(0, 1fr))`,
                    gap: `${GAP}px`
                }"
            >
                <VirtualImage
                    v-for="[imageKey, image] in virtualState.visibleItems"
                    v-memo="[imageKey, image.filePath, selectedSet.has(imageKey), layout.cellHeight]"
                    :key="imageKey"
                    :path="imageKey"
                    :image="image"
                    :selected="selectedSet.has(imageKey)"
                    :style="{ height: layout.cellHeight + 'px' }"
                    @click="handleClick(imageKey, $event)"
                    @dblclick="handleDblClick(imageKey)"
                    @mouseenter="emit('hover-image', imageKey)"
                    @mouseleave="emit('hover-image', undefined)"
                />
            </div>
        </div>
        <div v-else class="flex h-full items-center justify-center">
            <p class="text-center text-xl text-base-content/50">Start by clicking<br />File &gt; Load Dataset</p>
        </div>
    </div>
    <div class="mt-auto border-t-2 border-gray-400 pt-1 pb-1 dark:border-base-content/10">
        <label class="input w-full border-r-0 pr-0 pl-1 outline-none!">
            <AutocompletionInput
                v-model="filterInput"
                placeholder="Type tags… use -tag to exclude"
                :disabled="datasetStore.dataset.size === 0"
                :multiple="true"
                :custom-list="autocompleteList"
                :contains-mode="true"
                @on-input="emit('clear-filter')"
            />
            <span
                v-if="filterInput"
                class="cursor-pointer"
                @click="((filterInput = ''), emit('clear-filter'))"
                >X</span
            >
            <div class="not-focus-within:hover:tooltip" data-tip="Mode to filter the images">
                <select v-model.lazy="filterMode" class="select w-fit outline-none!">
                    <option value="or" selected>OR</option>
                    <option value="and">AND</option>
                </select>
            </div>
        </label>
    </div>
</template>
