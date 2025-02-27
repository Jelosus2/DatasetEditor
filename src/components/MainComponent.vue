<script setup lang="ts">
import ModalComponent from '@/components/ModalComponent.vue';

import { ref, watch, computed, shallowRef } from 'vue';

const props = defineProps({
  images: {
    type: Map<string, { tags: Set<string>; path: string }>,
    required: true,
  },
  globalTags: {
    type: Map<string, Set<string>>,
    required: true,
  },
  os: {
    type: String,
    required: true,
  },
});

const selectedImages = ref<Set<string>>(new Set());
const lastSelectedIndex = ref<number | null>(null);
const displayedTags = ref<Set<string>>(new Set());
const displayedGlobalTags = ref<Set<string>>(new Set());
const modalHtml = ref('');
const imageModal = ref(false);

const imageKeys = computed(() => Array.from(props.images.keys()));

watch(
  imageKeys,
  (newKeys) => {
    console.log(newKeys);
    if (newKeys.length > 0) {
      const firstImage = newKeys[0];
      if (!selectedImages.value.has(firstImage)) {
        selectedImages.value.add(firstImage);
        updateDisplayedTags();
        loadGlobalTags();
      }
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
  } else if (event.ctrlKey || (props.os === 'mac' && event.metaKey)) {
    if (selectedImages.value.has(id) && selectedImages.value.size > 1)
      selectedImages.value.delete(id);
    else selectedImages.value.add(id);
  } else {
    selectedImages.value = new Set([id]);
  }

  lastSelectedIndex.value = index;
  updateDisplayedTags();
}

function displayFullImage(id: string) {
  const modal = document.getElementById('my_modal_1') as HTMLDialogElement;

  if (modal) {
    imageModal.value = true;
    modalHtml.value = `
      <div class="flex justify-center">
        <img src="file://${props.images.get(id)?.path}" class="max-h-screen" />
      </div>
    `;
    modal.showModal();
  }
}

function updateDisplayedTags() {
  displayedTags.value.clear();

  const allTags = new Set<string>();
  for (const imageName of selectedImages.value) {
    const image = props.images.get(imageName);
    console.log(image);
    if (image && image.tags) image.tags.forEach((tag) => allTags.add(tag));
  }

  displayedTags.value = allTags;
}

function loadGlobalTags() {
  const allTags: string[] = [];
  for (const image of props.images.values()) {
    if (image?.tags.size > 0) image.tags.forEach((tag) => allTags.push(tag));
  }

  displayedGlobalTags.value = new Set(allTags.sort());
}

const container = shallowRef<HTMLDivElement | null>(null);
const containerWidth = ref(0);

function startResize(event: MouseEvent) {
  event.preventDefault();
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
</script>

<template>
  <div class="tabs-lift tabs h-[calc(100vh-86px)]">
    <input type="radio" name="dataset_tabs" class="tab" aria-label="Dataset" checked />
    <div class="tab-content !flex border-t-base-300 bg-base-100">
      <div
        class="grid h-fit max-h-[calc(100vh_-_90px)] w-[20%] max-w-[80%] min-w-[20%] grid-cols-[repeat(auto-fit,_minmax(100px,_1fr))] gap-1 overflow-auto pt-1"
        :style="{ width: containerWidth + 'px' }"
        ref="container"
      >
        <div
          v-for="[name, image] in images"
          :key="name"
          @click="toggleSelection(name, $event)"
          class="flex cursor-pointer items-center justify-center rounded-md border-1 border-black bg-base-200 select-none dark:border-white"
          :class="{
            'border-3 !border-blue-600 bg-blue-400': selectedImages.has(name),
          }"
        >
          <img
            :src="'file://' + image.path"
            :alt="name"
            @dblclick="displayFullImage(name)"
            draggable="false"
            class="h-full w-full rounded-md object-scale-down"
          />
        </div>
      </div>
      <div class="flex flex-1 overflow-auto">
        <div class="divider m-0 divider-horizontal cursor-ew-resize" @mousedown="startResize"></div>
        <div class="flex w-[30%] items-center justify-center">
          <img
            v-if="selectedImages.size"
            :src="images.get([...selectedImages][0])?.path"
            class="max-h-[100%]"
          />
        </div>
        <div class="divider m-0 divider-horizontal"></div>
        <div class="w-[50%]">
          <div class="flex h-[48%]">
            <div class="w-[50%] text-center">
              <div
                class="flex items-center justify-center border-2 border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent);] text-sm font-light xl:text-base"
              >
                <p>Tags detected by autotagger but not in the captions</p>
              </div>
            </div>
            <div class="divider m-0 divider-horizontal"></div>
            <div class="w-[50%] text-center">
              <div
                class="flex items-center justify-center border-2 border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent);] text-sm font-light xl:text-base"
              >
                <p>Tags in captions but not detected by the autotagger</p>
              </div>
            </div>
          </div>
          <div class="divider m-0"></div>
          <div class="h-[38%]"></div>
        </div>
        <div class="divider m-0 divider-horizontal"></div>
        <div class="w-[20%]">
          <div class="flex h-[54%]"></div>
          <div class="divider m-0"></div>
          <div class="h-[42%]"></div>
        </div>
        <!--<div class="flex w-full flex-col">
          <input
            v-for="tag in displayedTags"
            :key="tag"
            type="text"
            :value="tag"
            class="border-1 border-gray-400 pl-2"
          />
        </div>-->
      </div>
      <!--<div class="divider m-1 ml-0 divider-horizontal"></div>
      <div class="flex flex-2 overflow-auto">
        <div class="flex w-full flex-col">
          <input
            v-for="tag in displayedGlobalTags"
            :key="tag"
            type="text"
            :value="tag"
            class="border-1 border-gray-400 pl-2"
            :class="{
              'bg-[#323841]': globalTags.get(tag)?.has([...selectedImages][0]),
            }"
          />
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
      </div>-->
    </div>
  </div>
  <ModalComponent :html="modalHtml" :is-image="imageModal" />
</template>
