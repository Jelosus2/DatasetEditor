<script setup lang="ts">
import AutocompletionComponent from '@/components/AutocompletionComponent.vue';
import VirtualImage from './VirtualImage.vue';

import { useDatasetStore, type Image } from '@/stores/datasetStore';
import { computed } from 'vue';

const selectedImages = defineModel<Set<string>>('selectedImages', { required: true });
const filterInput = defineModel<string>('filterInput', { required: true });
const filterMode = defineModel<string>('filterMode', { required: true });

defineProps({
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
const imageEntries = computed(() => {
  return [...datasetStore.images] as Array<[string, Image]>;
});
</script>

<template>
  <div
    class="grid h-fit grid-cols-[repeat(auto-fit,_minmax(100px,_1fr))] gap-1 overflow-auto scroll-smooth"
  >
    <VirtualImage
      v-for="[name, image] in imageEntries"
      v-show="!isFiltering || filteredImages.has(name)"
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
  <div class="mt-auto border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
    <label class="input input-sm w-full border-r-0 pr-0 pl-1 !outline-none">
      <AutocompletionComponent
        v-model="filterInput"
        :disabled="!datasetStore.images.size"
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
        <select v-model.lazy="filterMode" class="select w-fit select-sm !outline-none">
          <option value="or" selected>OR</option>
          <option value="no">NO</option>
          <option value="and">AND</option>
        </select>
      </div>
    </label>
  </div>
</template>
