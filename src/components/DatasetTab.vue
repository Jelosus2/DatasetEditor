<script setup lang="ts">
import ModalComponent from "@/components/ModalComponent.vue";
import ImageGrid from "@/components/ImageGrid.vue";
import TagEditor from "@/components/TagEditor.vue";
import BackgroundColorModalComponent from "@/components/BackgroundColorModalComponent.vue";
import CropImageModalComponent from "@/components/CropImageModalComponent.vue";

import { useImageSelection } from "@/composables/useImageSelection";
import { useGridNavigation } from "@/composables/useGridNavigation";
import { useResizablePane } from "@/composables/useResizablePane";
import { useTagDisplay } from "@/composables/useTagDisplay";
import { useDatasetStore } from "@/stores/datasetStore";
import { ref, watch, computed, shallowRef, onActivated, onDeactivated } from "vue";

const props = defineProps<{
    arePreviewsEnabled: boolean;
}>();

const filterMode = ref("or");
const filterInput = ref("");
const isFiltering = computed(() => !!filterInput.value);
const container = shallowRef<HTMLDivElement | null>(null);
const sortOrder = ref<"asc" | "desc">("asc");
const globalSortMode = ref<"alphabetical" | "tag_count">("alphabetical");
const globalSortOrder = ref<"asc" | "desc">("asc");
const globalTagFilterInput = ref("");
const previewImage = ref("");
const activeModalImageId = ref<string | null>(null);
const gridMetrics = ref({ columns: 1 });
const imageModalZoom = ref(1);
const imageModalPanX = ref(0);
const imageModalPanY = ref(0);

const datasetStore = useDatasetStore();
const imageKeys = computed(() => {
    void datasetStore.dataVersion;

    return Array.from(datasetStore.dataset.keys());
});

const activeModalImage = computed(() => activeModalImageId.value ? datasetStore.dataset.get(activeModalImageId.value) : undefined);

const {
    selectedImages,
    lastSelectedIndex,
    toggleSelection,
    clearSelection
} = useImageSelection(imageKeys, computed(() => filteredImages.value), isFiltering);

const selectedImageId = computed(() => selectedImages.value.values().next().value);
const selectedImage = computed(() => selectedImageId.value ? datasetStore.dataset.get(selectedImageId.value) : undefined);
const selectedTitle = computed(() => selectedImageId.value?.split("/").pop());

const { containerWidth, startResize } = useResizablePane(container, 300, {
    minPercent: 0.2,
    maxPercent: 0.4
});

const {
    displayedTags,
    displayedGlobalTags,
    filteredImages
} = useTagDisplay(
    selectedImages,
    filterInput,
    filterMode,
    sortOrder,
    globalSortMode,
    globalSortOrder,
    globalTagFilterInput,
);

const { setSingleSelection } = useGridNavigation(
    imageKeys,
    selectedImages,
    lastSelectedIndex,
    filteredImages,
    isFiltering,
    computed(() => gridMetrics.value.columns)
);

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;
const ZOOM_STEP = 0.1;

let isPanning = false;
let panStartX = 0;
let panStartY = 0;
let panOriginX = 0;
let panOriginY = 0;

watch(imageKeys, (newKeys) => {
    if (newKeys.length === 0) {
        selectedImages.value = new Set();
        return;
    }

    const newKeySet = new Set(newKeys);
    const hasValidSelection = [...selectedImages.value].some((imageId) => newKeySet.has(imageId));

    if (!hasValidSelection) {
        clearSelection();
        datasetStore.resetDatasetStatus();
    }
}, { immediate: true });

watch(filteredImages, (newSet) => {
    if (isFiltering.value) {
        const keptSelection = [...selectedImages.value].filter((id) => newSet.has(id));

        if (keptSelection.length > 0) {
            setSingleSelection(keptSelection[0]);
        } else if (newSet.size > 0) {
            setSingleSelection(newSet.values().next().value!);
        } else {
            selectedImages.value = new Set();
        }
    }
});

watch(filterInput, (val) => {
    if (!val && selectedImages.value.size === 0 && datasetStore.dataset.size > 0) {
        const first = datasetStore.dataset.keys().next().value as string | undefined;
        if (first)
            setSingleSelection(first);
    }
});

function getImageModal() {
    return document.getElementById("my_modal_1") as HTMLDialogElement | null;
}

function displayFullImage(id: string) {
    if (props.arePreviewsEnabled)
        return;

    activeModalImageId.value = id;
    resetModalView();

    const modal = getImageModal();
    modal?.showModal();
}

function isImageModalOpen() {
    return !!getImageModal()?.open;
}

function clampZoom(value: number) {
    return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(value.toFixed(2))));
}

function setModalZoom(next: number) {
    imageModalZoom.value = clampZoom(next);

    if (imageModalZoom.value <= 1) {
        imageModalPanX.value = 0;
        imageModalPanY.value = 0;
    }
}

function resetModalView() {
    imageModalZoom.value = 1;
    imageModalPanX.value = 0;
    imageModalPanY.value = 0;
}

function handleModalWheel(event: WheelEvent) {
    if (!isImageModalOpen() || !activeModalImage.value)
        return;

    const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    setModalZoom(imageModalZoom.value + delta);
}

function handleModalZoomKey(event: KeyboardEvent) {
    if (!event.ctrlKey || !isImageModalOpen() || !activeModalImage.value)
        return;
    event.preventDefault();

    const isZoomIn = event.key === "+";
    const isZoomOut = event.key === "-";

    if (!isZoomIn && !isZoomOut)
        return;

    setModalZoom(imageModalZoom.value + (isZoomIn ? ZOOM_STEP : -ZOOM_STEP));
}

function onModalPointerDown(event: PointerEvent) {
    if (!isImageModalOpen() || !activeModalImage.value || imageModalZoom.value <= 1)
        return;

    isPanning = true;
    panStartX = event.clientX;
    panStartY = event.clientY;
    panOriginX = imageModalPanX.value;
    panOriginY = imageModalPanY.value;
}

function onModalPointerMove(event: PointerEvent) {
    if (!isPanning)
        return;

    imageModalPanX.value = panOriginX + (event.clientX - panStartX);
    imageModalPanY.value = panOriginY + (event.clientY - panStartY);
}

function onModalPointerUp() {
    isPanning = false;
}

function handleImageModalClose() {
    activeModalImageId.value = null;
    resetModalView();
}

function clearImageFilter() {
    if (filterInput.value)
        return;

    if (filteredImages.value.size === 0 && selectedImages.value.size === 0) {
        const first = datasetStore.dataset.keys().next().value as string | undefined;
        if (first)
            setSingleSelection(first);
    }
}

let previewTimer: number | null = null;
function handlePreviewHover(id?: string) {
    if (previewTimer)
        clearTimeout(previewTimer);

    previewTimer = setTimeout(() => {
        previewImage.value = id || "";
    }, 40);
}

function handleGridMetrics(metrics: { columns: number }) {
    gridMetrics.value = metrics;
}

function handleOpenImage(ev: Event) {
    const id = (ev as CustomEvent<string>).detail;
    if (id)
        displayFullImage(id);
}

onActivated(() => {
    window.addEventListener("open-image", handleOpenImage as EventListener);
    window.addEventListener("keydown", handleModalZoomKey);
    window.addEventListener("pointermove", onModalPointerMove);
    window.addEventListener("pointerup", onModalPointerUp);
    window.addEventListener("pointercancel", onModalPointerUp);

    getImageModal()?.addEventListener("close", handleImageModalClose);
});

onDeactivated(() => {
    window.removeEventListener("open-image", handleOpenImage as EventListener);
    window.removeEventListener("keydown", handleModalZoomKey);
    window.removeEventListener("pointermove", onModalPointerMove);
    window.removeEventListener("pointerup", onModalPointerUp);
    window.removeEventListener("pointercancel", onModalPointerUp);

    getImageModal()?.removeEventListener("close", handleImageModalClose);
});
</script>

<template>
    <div class="tab-content min-h-0 border-t-base-300 bg-base-100">
        <div class="flex h-full min-h-0">
            <div
                class="flex w-[20%] max-w-[40%] min-w-[20%] flex-col pt-1 pl-1 outline-none!"
                :style="{ width: containerWidth + 'px' }"
                ref="container"
            >
                <ImageGrid
                    v-model:selected-images="selectedImages"
                    v-model:filter-input="filterInput"
                    v-model:filter-mode="filterMode"
                    :filtered-images="filteredImages"
                    :is-filtering="isFiltering"
                    @toggle-selection="toggleSelection"
                    @hover-image="handlePreviewHover"
                    @display-full-image="displayFullImage"
                    @clear-filter="clearImageFilter"
                    @grid-metrics="handleGridMetrics"
                />
            </div>
            <div class="relative flex flex-1">
                <div
                    class="divider m-0 divider-horizontal cursor-ew-resize not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
                    @mousedown.prevent="startResize"
                ></div>
                <div
                    v-if="arePreviewsEnabled && previewImage"
                    class="absolute inset-0 z-30 flex items-center justify-center"
                >
                    <div class="bg-transparent p-2">
                        <img
                            :src="datasetStore.dataset.get(previewImage)?.filePath"
                            decoding="async"
                            draggable="false"
                            class="max-h-[80vh] max-w-[80vw] object-contain"
                        />
                    </div>
                </div>
                <div class="flex w-[30%] flex-col">
                    <template v-if="selectedImages.size > 0">
                        <div class="w-full truncate px-2 py-1 text-center font-medium">
                            {{ selectedTitle }}
                        </div>
                        <div class="flex flex-1 items-center justify-center">
                            <img
                                :src="selectedImage?.filePath"
                                :title="selectedTitle"
                                decoding="async"
                                draggable="false"
                                class="max-h-full"
                            />
                        </div>
                    </template>
                    <div v-else class="flex flex-1 items-center justify-center text-center text-lg opacity-60">
                        No image selected
                    </div>
                </div>
                <TagEditor
                    :selected-images="selectedImages"
                    :displayed-tags="displayedTags"
                    :displayed-global-tags="displayedGlobalTags"
                    :is-filtering="isFiltering"
                    :filter-input="filterInput"
                    v-model:sort-order="sortOrder"
                    v-model:global-sort-mode="globalSortMode"
                    v-model:global-sort-order="globalSortOrder"
                    v-model:global-tag-filter-input="globalTagFilterInput"
                />
            </div>
        </div>
    </div>
    <ModalComponent :is-image="true">
        <div
            class="flex max-h-[90vh] max-w-[90vw] items-center justify-center overflow-hidden"
            @wheel.prevent="handleModalWheel"
            @pointerdown="onModalPointerDown"
        >
            <img
                v-if="activeModalImage"
                :src="activeModalImage.filePath"
                draggable="false"
                decoding="async"
                class="max-h-screen select-none"
                :class="imageModalZoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''"
                :style="{
                    transform: `translate(${imageModalPanX}px, ${imageModalPanY}px) scale(${imageModalZoom})`,
                    transformOrigin: 'center center'
                }"
            />
        </div>
    </ModalComponent>
    <BackgroundColorModalComponent :selected-images="selectedImages" />
    <CropImageModalComponent :selected-images="selectedImages" />
</template>
