<script setup lang="ts">
import ModalComponent from '@/components/ModalComponent.vue';
import ImageGridComponent from '@/components/ImageGridComponent.vue';
import TagEditorComponent from '@/components/TagEditorComponent.vue';
import BackgroundColorModalComponent from '@/components/BackgroundColorModalComponent.vue';

import { ref, watch, computed, shallowRef, onMounted } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useTagDisplay } from '@/composables/useTagDisplay';

const props = defineProps({
  arePreviewsEnabled: { type: Boolean, required: true },
});
const emit = defineEmits(['trigger_alert']);

const selectedImages = ref<Set<string>>(new Set());
const lastSelectedIndex = ref<number>(0);
const modalHtml = ref('');
const imageModal = ref(false);
const filterMode = ref('or');
const filterInput = ref('');
const isFiltering = computed(() => !!filterInput.value);
const container = shallowRef<HTMLDivElement | null>(null);
const containerWidth = ref(0);
const sortOrder = ref('asc');
const globalSortMode = ref('alphabetical');
const globalSortOrder = ref('asc');
const globalTagFilterInput = ref('');
const previewImage = ref('');

const datasetStore = useDatasetStore();
const {
  displayedTags,
  displayedGlobalTags,
  filteredImages,
  triggerUpdate
} = useTagDisplay(
  selectedImages,
  filterInput,
  filterMode,
  sortOrder,
  globalSortMode,
  globalSortOrder,
  globalTagFilterInput,
);

const imageKeys = computed(() => Array.from(datasetStore.images.keys()));

watch(
  imageKeys,
  (newKeys) => {
    if (newKeys.length > 0) {
      const firstImage = newKeys[0];
      selectedImages.value = new Set([firstImage]);
      triggerUpdate();
      datasetStore.resetDatasetStatus();
    }
  },
  { immediate: true },
);

watch(filteredImages, (newSet) => {
  if (isFiltering.value) {
    const keptSelection = [...selectedImages.value].filter((id) => newSet.has(id));
    selectedImages.value = new Set(
      keptSelection.length ? keptSelection : newSet.size ? [[...newSet][0]] : []
    );
    lastSelectedIndex.value = !newSet.has(imageKeys.value[lastSelectedIndex.value])
      ? 0
      : lastSelectedIndex.value;
  }
});

watch(filterInput, (val) => {
  if (!val && !selectedImages.value.size && datasetStore.images.size) {
    const first = datasetStore.images.keys().next().value as string | undefined;
    if (first) selectedImages.value.add(first);
  }
});

function toggleSelection(id: string, event: MouseEvent) {
  const index = imageKeys.value.indexOf(id);

  if (event.shiftKey) {
    const start = Math.min(lastSelectedIndex.value, index);
    const end = Math.max(lastSelectedIndex.value, index);
    const range = imageKeys.value.slice(start, end + 1);
    range.forEach((img) => {
      if (!isFiltering.value || filteredImages.value.has(img)) selectedImages.value.add(img);
    });
  } else if (event.ctrlKey) {
    if (selectedImages.value.has(id) && selectedImages.value.size > 1)
      selectedImages.value.delete(id);
    else selectedImages.value.add(id);
  } else {
    selectedImages.value = new Set([id]);
  }

  lastSelectedIndex.value = index;
  selectedImages.value = new Set(selectedImages.value);
}

function selectAllImages() {
  const images = filteredImages.value.size
    ? filteredImages.value
    : datasetStore.images.keys();
  selectedImages.value = new Set(images);
}

function displayFullImage(id: string) {
  if (props.arePreviewsEnabled) return;

  const modal = document.getElementById('my_modal_1') as HTMLDialogElement;

  if (modal) {
    imageModal.value = true;
    modalHtml.value = `
      <div class="flex justify-center">
        <img src="${datasetStore.images.get(id)?.filePath}" class="max-h-screen" />
      </div>
    `;
    modal.showModal();
  }
}

function resizeContainer(event: MouseEvent) {
  const startX = event.clientX;
  const startWidth = container.value?.offsetWidth || 0;

  function onMouseMove(moveEvent: MouseEvent) {
    const newWidth = startWidth + (moveEvent.clientX - startX);
    containerWidth.value = Math.max(100, newWidth);
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function clearImageFilter() {
  if (filterInput.value) return;

  if (!filteredImages.value.size && !selectedImages.value.size) {
    const first = datasetStore.images.keys().next().value as string | undefined;
    if (first) selectedImages.value.add(first);
  }
}

onMounted(() => {
  datasetStore.onChange = [triggerUpdate];
});

defineExpose({ selectAllImages });
</script>

<template>
  <input type="radio" name="editor_tabs" class="tab" aria-label="Dataset" checked />
  <div class="tab-content border-t-base-300 bg-base-100">
    <div class="flex h-full">
      <div
        class="flex w-[20%] max-w-[40%] min-w-[20%] flex-col pt-1 pl-1"
        :style="{ width: containerWidth + 'px' }"
        ref="container"
      >
        <ImageGridComponent
          v-model:selected-images="selectedImages"
          v-model:filter-input="filterInput"
          v-model:filter-mode="filterMode"
          :filtered-images="filteredImages"
          :is-filtering="isFiltering"
          @toggle-selection="toggleSelection"
          @hover-image="(id) => (previewImage = id || '')"
          @display-full-image="displayFullImage"
          @clear-filter="clearImageFilter"
        />
      </div>
      <div class="relative flex flex-1">
        <div
          class="divider m-0 divider-horizontal cursor-ew-resize not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
          @mousedown.prevent="resizeContainer"
        ></div>
        <div
          v-if="arePreviewsEnabled && previewImage"
          class="absolute inset-0 z-2 flex items-center justify-center"
        >
          <div class="bg-transparent p-2">
            <img
              :src="datasetStore.images.get(previewImage)?.filePath"
              class="max-h-[80vh] max-w-[80vw] object-contain"
            />
          </div>
        </div>
        <div class="flex w-[30%] items-center justify-center">
          <img
            v-if="selectedImages.size"
            :src="datasetStore.images.get([...selectedImages][0])?.filePath"
            class="max-h-full"
          />
        </div>
        <TagEditorComponent
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
  <ModalComponent :html="modalHtml" :is-image="imageModal" />
  <BackgroundColorModalComponent :selected-images="selectedImages" @trigger_alert="(t, m) => emit('trigger_alert', t, m)" />
</template>
