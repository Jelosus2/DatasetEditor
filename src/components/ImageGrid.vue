<script setup lang="ts">
import AutocompletionInput from "@/components/AutocompletionInput.vue";
import VirtualImage from "@/components/VirtualImage.vue";
import AlertModal from "@/components/AlertModal.vue";

import { useDatasetStore } from "@/stores/datasetStore";
import { FileService } from "@/services/fileService";
import { useAlert } from "@/composables/useAlert";
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

const containerRef = ref<HTMLElement | null>(null);
const containerWidth = ref(0);
const containerHeight = ref(0);
const liveScrollTop = ref(0);
const virtualScrollTop = ref(0);
const isFastScrolling = ref(false);
const isDeleteImagesModalOpen = ref(false);
const imageContextMenu = ref({
    open: false,
    x: 0,
    y: 0,
    imageKey: "",
    targetKeys: [] as string[]
});

const fileService = new FileService();
const { showAlert } = useAlert();

const MIN_COLUMN_WIDTH = 100;
const GAP = 4;
const BUFFER_ROWS = 3;
const FAST_SCROLL_VELOCITY = 2.5;
const SCROLL_SETTLE_MS = 160;

let settleTimer: number | null = null;
let lastScrollTop = 0;
let lastScrollTs = 0;

const datasetStore = useDatasetStore();

const autocompleteList = computed(() => {
    void datasetStore.dataVersion;

    return [...datasetStore.globalTags.keys()];
});

const selectedSet = computed(() => selectedImages.value);

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

    const startRow = Math.floor(virtualScrollTop.value / rowHeight);
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

const deleteImagesMessage = computed(() => {
    const count = imageContextMenu.value.targetKeys.length;

    return count > 1
        ? `Are you sure you want to move ${count} images and their caption files to the trash?`
        : "Are you sure you want to move this image and its caption file to the trash?";
});

watch(gridMetrics, (metrics) => {
    emit("grid-metrics", metrics);
}, { immediate: true });

let rafId: number | null = null;

function onScroll(event: Event) {
    const element = event.target as HTMLElement;
    const nextTop = element.scrollTop;
    const now = performance.now();

    liveScrollTop.value = nextTop;

    const dt = Math.max(1, now - lastScrollTs);
    const dy = Math.abs(nextTop - lastScrollTop);
    const velocity = dy / dt;

    lastScrollTop = nextTop;
    lastScrollTs = now;

    const fastJump = dy > Math.max(containerHeight.value * 1.5, 600);
    if (velocity > FAST_SCROLL_VELOCITY || fastJump)
        isFastScrolling.value = true;

    if (settleTimer !== null)
        clearTimeout(settleTimer);

    settleTimer = window.setTimeout(() => {
        isFastScrolling.value = false;
        virtualScrollTop.value = liveScrollTop.value;
    }, SCROLL_SETTLE_MS);

    if (isFastScrolling.value)
        return;

    if (rafId !== null)
        return;

    rafId = requestAnimationFrame(() => {
        virtualScrollTop.value = liveScrollTop.value;
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

function openImageContextMenu(imageKey: string, event: MouseEvent) {
    const MENU_WIDTH = 240;
    const MENU_HEIGHT = 44;
    const PADDING = 8;

    let x = event.clientX;
    let y = event.clientY;

    if (x + MENU_WIDTH > window.innerWidth - PADDING)
        x = window.innerWidth - MENU_WIDTH - PADDING;
    if (y + MENU_HEIGHT > window.innerHeight - PADDING)
        y = window.innerHeight - MENU_HEIGHT - PADDING;

    const targetKeys = selectedImages.value.has(imageKey)
        ? Array.from(selectedImages.value)
        : [imageKey];

    if (!selectedImages.value.has(imageKey))
        selectedImages.value = new Set([imageKey]);

    imageContextMenu.value = {
        open: true,
        x: Math.max(PADDING, x),
        y: Math.max(PADDING, y),
        imageKey,
        targetKeys,
    };
}

function closeImageContextMenu() {
    imageContextMenu.value.open = false;
}

function openDeleteImagesModal() {
    if (imageContextMenu.value.targetKeys.length === 0)
        return;

    closeImageContextMenu();
    isDeleteImagesModalOpen.value = true;
}

function closeDeleteImagesModal() {
    isDeleteImagesModalOpen.value = false;
}

async function trashContextMenuImages() {
    const keys = imageContextMenu.value.targetKeys;
    if (keys.length === 0)
        return;

    const paths = keys
        .map((key) => datasetStore.dataset.get(key)?.path)
        .filter((key): key is string => !!key);

    if (paths.length === 0) {
        closeImageContextMenu();
        return;
    }

    const result = await fileService.trashFiles(paths);
    if (result.error) {
        showAlert("error", result.message);
        return;
    }

    if (keys.length === 1)
        datasetStore.removeImage(keys[0]);
    else
        datasetStore.removeImages(keys);

    closeDeleteImagesModal();
    showAlert("success", result.message);
}

let resizeObserver: ResizeObserver | null = null;

onActivated(() => {
    if (!containerRef.value)
        return;

    containerWidth.value = containerRef.value.clientWidth;
    containerHeight.value = containerRef.value.clientHeight;
    liveScrollTop.value = containerRef.value.scrollTop;
    virtualScrollTop.value = containerRef.value.scrollTop;
    lastScrollTop = containerRef.value.scrollTop;
    lastScrollTs = performance.now();

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
    if (settleTimer !== null)
        clearTimeout(settleTimer);

    closeImageContextMenu();
    closeDeleteImagesModal();

    isFastScrolling.value = false;
    liveScrollTop.value = 0;
    virtualScrollTop.value = 0;
});
</script>

<template>
    <div
        ref="containerRef"
        class="h-full w-full overflow-y-auto overflow-x-hidden scrollbar-stable"
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
                    :suspend-image="isFastScrolling"
                    :selected="selectedSet.has(imageKey)"
                    :style="{ height: layout.cellHeight + 'px' }"
                    @click="handleClick(imageKey, $event)"
                    @dblclick="handleDblClick(imageKey)"
                    @mouseenter="!isFastScrolling && emit('hover-image', imageKey)"
                    @mouseleave="!isFastScrolling && emit('hover-image', undefined)"
                    @contextmenu="openImageContextMenu(imageKey, $event)"
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
    <div
        v-if="imageContextMenu.open"
        class="fixed inset-0 z-70"
        @mousedown.prevent="closeImageContextMenu"
    >
        <div
            class="absolute z-71 min-w-60 rounded-box border border-base-content/20 bg-base-100 p-1 shadow-xl"
            :style="{
                left: `${imageContextMenu.x}px`,
                top: `${imageContextMenu.y}px`
            }"
            @mousedown.stop
        >
            <button
                class="btn btn-ghost btn-sm w-full justify-start text-error"
                @click="openDeleteImagesModal"
            >
                {{ imageContextMenu.targetKeys.length > 1
                    ? `Trash ${imageContextMenu.targetKeys.length} images + captions`
                    : "Trash image + caption" }}
            </button>
        </div>
    </div>
    <AlertModal
        :open="isDeleteImagesModalOpen"
        title="Image(s) deletion"
        :message="deleteImagesMessage"
        confirm-text="Move to trash"
        confirm-class="btn btn-error btn-outline"
        @confirm="trashContextMenuImages"
        @cancel="closeDeleteImagesModal"
        @update:open="(value) => !value && closeDeleteImagesModal()"
    />
</template>
