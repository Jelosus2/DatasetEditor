<script setup lang="ts">
import AutocompletionComponent from '@/components/AutocompletionComponent.vue';
import VirtualImage from './VirtualImage.vue';

import { useDatasetStore } from '@/stores/datasetStore';
import { computed, toRaw } from 'vue';

const selectedImages = defineModel<Set<string>>('selectedImages', { required: true });
const filterInput = defineModel<string>('filterInput', { required: true });
const filterMode = defineModel<string>('filterMode', { required: true });

const props = defineProps({
    filteredImages: { type: Set<string>, required: true },
    isFiltering: { type: Boolean, required: true },
});

const emit = defineEmits<{
  (e: 'toggle-selection', id: string, event: MouseEvent): void;
  (e: 'hover-image', id: string | null): void;
  (e: 'display-full-image', id: string): void;
  (e: 'clear-filter'): void;
}>();

const datasetStore = useDatasetStore();
const visibleImages = computed(() => {
    void datasetStore.dataVersion;

    const rawDataset = toRaw(datasetStore.dataset);

    if (!props.isFiltering)
        return Array.from(rawDataset.entries());

    return Array.from(rawDataset.entries())
        .filter(([imageId]) => props.filteredImages.has(imageId));
});
</script>

<template>
  <div
    v-if="datasetStore.dataset.size > 0"
    class="grid h-fit grid-cols-[repeat(auto-fit,minmax(100px,1fr))] gap-1 overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-stable"
  >
    <VirtualImage
      v-for="[name, image] in visibleImages"
      :key="name"
      :name="name"
      :image="image"
      :selected="selectedImages.has(name)"
      @click="emit('toggle-selection', name, $event)"
      @mouseenter="emit('hover-image', name)"
      @mouseleave="emit('hover-image', null)"
      @dblclick="emit('display-full-image', name)"
    />
  </div>
  <div v-else class="flex flex-1 items-center justify-center">
    <p class="text-center text-lg text-base-content/50">Start by clicking<br />File &gt; Load Dataset</p>
  </div>
  <div class="mt-auto border-t-2 border-gray-400 pt-1 pb-1 dark:border-base-content/10">
    <label class="input w-full border-r-0 pr-0 pl-1 outline-none!">
      <AutocompletionComponent
        v-model="filterInput"
        :disabled="datasetStore.dataset.size === 0"
        :id="'filter-completion-list'"
        :placeholder="'Type a tag to filter the images...'"
        :multiple="true"
        :custom-list="[...datasetStore.globalTags.keys()]"
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
          <option value="no">NO</option>
          <option value="and">AND</option>
        </select>
      </div>
    </label>
  </div>
</template>
