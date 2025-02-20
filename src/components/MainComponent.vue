<script setup lang="ts">
import ModalComponent from '@/components/ModalComponent.vue';

import { ref, watch, computed } from 'vue';

const props = defineProps({
  images: {
    type: Map<string, { tags: Set<string>; path: string }>,
    required: true,
  },
});

const selectedImages = ref(new Set());
const lastSelectedIndex = ref<number | null>(null);
const modalHtml = ref('');

const imageKeys = computed(() => Array.from(props.images.keys()));

watch(
  imageKeys,
  (newKeys) => {
    if (newKeys.length > 0) {
      const firstImage = newKeys[0];
      if (!selectedImages.value.has(firstImage)) selectedImages.value.add(firstImage);
    }
  },
  { immediate: true },
);

function toggleSelection(id: string, event: MouseEvent) {
  const index = imageKeys.value.indexOf(id);

  if (event.shiftKey && lastSelectedIndex.value != null) {
    const start = Math.min(lastSelectedIndex.value, index);
    const end = Math.max(lastSelectedIndex.value, index);
    const range = imageKeys.value.slice(start, end + 1);
    range.forEach((img) => selectedImages.value.add(img));
  } else if (event.ctrlKey || event.metaKey) {
    if (selectedImages.value.has(id) && selectedImages.value.size > 1)
      selectedImages.value.delete(id);
    else selectedImages.value.add(id);
  } else {
    selectedImages.value = new Set([id]);
  }

  lastSelectedIndex.value = index;
}

function displayFullImage(id: string) {
  modalHtml.value = `
    <div class="flex justify-center">
      <img src="file://${props.images.get(id)?.path}" />
    </div>
  `;
}
</script>

<template>
  <div class="tabs-lift tabs h-[calc(100vh-86px)]">
    <input type="radio" name="dataset_tabs" class="tab" aria-label="Dataset" checked />
    <div class="tab-content !flex overflow-auto border-t-base-300 bg-base-100">
      <div class="flex flex-1 flex-col flex-nowrap overflow-auto">
        <div class="w-fit">
          <div
            v-for="[name, image] in images"
            :key="name"
            @click="toggleSelection(name, $event)"
            class="flex h-60 cursor-pointer items-center justify-start border-1 border-red-500 select-none"
            :class="{
              'bg-[#323841]': selectedImages.has(name),
            }"
          >
            <div
              class="relative h-full w-60 border-r-1 border-r-red-500"
              @click="displayFullImage(name)"
              onclick="my_modal_1.showModal()"
            >
              <img
                :src="'file://' + image.path"
                :alt="name"
                class="h-full object-contain"
                draggable="false"
              />
            </div>
            <div>
              <p class="mx-4 text-sm whitespace-nowrap">{{ name }}</p>
            </div>
          </div>
          <p class="mt-4 h-20">Selected images: {{ selectedImages }}</p>
        </div>
      </div>
      <div class="divider m-1 ml-0 divider-horizontal"></div>
      <div class="flex flex-1 overflow-auto">
        <div class="flex w-full flex-col">
          <div>c</div>
          <div>d</div>
        </div>
        <ul class="menu bg-base-200 px-0">
          <li>
            <a>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </a>
          </li>
          <li>
            <a>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </a>
          </li>
          <li>
            <a>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </a>
          </li>
        </ul>
      </div>
      <div class="divider m-1 ml-0 divider-horizontal"></div>
      <div class="flex flex-1 overflow-auto">
        <div class="flex w-full flex-col">
          <div>c</div>
          <div>d</div>
        </div>
        <ul class="menu bg-base-200 px-0">
          <li>
            <a>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </a>
          </li>
          <li>
            <a>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </a>
          </li>
          <li>
            <a>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
            </a>
          </li>
        </ul>
      </div>
    </div>
  </div>
  <ModalComponent :html="modalHtml" />
</template>
