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
const sortOrder = ref("asc");
const globalSortMode = ref("alphabetical");
const globalSortOrder = ref("asc");
const globalTagFilterInput = ref("");
const previewImage = ref("");
const activeModalImageId = ref<string | null>(null);
const gridMetrics = ref({ columns: 1 });

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
    selectAllImages,
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

function displayFullImage(id: string) {
    if (props.arePreviewsEnabled)
        return;

    activeModalImageId.value = id;

    const modal = document.getElementById("my_modal_1") as HTMLDialogElement;
    modal?.showModal();
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
});

onDeactivated(() => {
    window.removeEventListener("open-image", handleOpenImage as EventListener);
});

defineExpose({ selectAllImages });
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
                <div class="flex w-[30%] items-center justify-center">
                    <template v-if="selectedImages.size > 0">
                        <img
                            :src="selectedImage?.filePath"
                            :title="selectedTitle"
                            decoding="async"
                            draggable="false"
                            class="max-h-full"
                        />
                    </template>
                    <div v-else class="text-center text-lg opacity-60">
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
        <div class="flex justify-center">
            <img
                v-if="activeModalImage"
                :src="activeModalImage.filePath"
                draggable="false"
                decoding="async"
                class="max-h-screen"
            />
        </div>
    </ModalComponent>
    <BackgroundColorModalComponent :selected-images="selectedImages" />
    <CropImageModalComponent :selected-images="selectedImages" />
</template>
