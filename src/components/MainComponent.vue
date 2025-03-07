<script setup lang="ts">
import ModalComponent from '@/components/ModalComponent.vue';
import TagGroupEditorComponent from '@/components/TagGroupEditorComponent.vue';

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
const tagInput = ref('');
const globalTagInput = ref('');
const filterMode = ref('or');
const filterInput = ref('');
const filteredImages = ref<Set<string>>(new Set());
const container = shallowRef<HTMLDivElement | null>(null);
const containerWidth = ref(0);
const tagGroups = ref<Map<string, Set<string>>>(new Map());
const tagGroupSectionTopHeight = ref(55);
const tagGroupSectionBottomHeight = ref(45);

const imageKeys = computed(() => Array.from(props.images.keys()));

watch(
  imageKeys,
  (newKeys) => {
    if (newKeys.length > 0) {
      const firstImage = newKeys[0];
      selectedImages.value = new Set<string>([firstImage]);
      updateDisplayedTags();
      updateGlobalTags();
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
    if (image && image.tags) image.tags.forEach((tag) => allTags.add(tag));
  }

  displayedTags.value = allTags;
}

function updateGlobalTags() {
  const allTags: string[] = [];
  for (const image of props.images.values()) {
    if (image?.tags.size > 0) image.tags.forEach((tag) => allTags.push(tag));
  }

  displayedGlobalTags.value = new Set(allTags.sort());
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

function resizeTagGroupSection(moveEvent: MouseEvent) {
  const startY = moveEvent.clientY;
  const maxHeight = window.innerHeight - 90;
  const startTopHeightPx = (tagGroupSectionTopHeight.value / 100) * maxHeight;

  function onMouseMove(event: MouseEvent) {
    const delta = event.clientY - startY;
    const newTopHeightPx = startTopHeightPx + delta;
    let newTopHeight = (newTopHeightPx / maxHeight) * 100;
    newTopHeight = Math.max(20, Math.min(90, newTopHeight));
    tagGroupSectionTopHeight.value = newTopHeight;
    tagGroupSectionBottomHeight.value = 100 - newTopHeight;
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function addTag() {
  if (!tagInput.value) return;

  for (const image of selectedImages.value.values()) {
    props.images.get(image)?.tags.add(tagInput.value);
  }

  updateDisplayedTags();
  if (!props.globalTags.has(tagInput.value)) {
    props.globalTags.set(tagInput.value, new Set([...selectedImages.value.values()]));
    updateGlobalTags();
  }

  tagInput.value = '';
}

function addGlobalTag() {
  if (!globalTagInput.value) return;

  for (const image of props.images.keys()) {
    props.images.get(image)?.tags.add(globalTagInput.value);
  }

  updateDisplayedTags();
  if (!props.globalTags.has(globalTagInput.value)) {
    props.globalTags.set(globalTagInput.value, new Set([...props.images.keys()]));
    updateGlobalTags();
  }

  globalTagInput.value = '';
}

function removeTag(tag: string) {
  const images = props.globalTags.get(tag);

  for (const image of selectedImages.value.values()) {
    props.images.get(image)?.tags.delete(tag);
    images?.delete(image);
  }

  updateDisplayedTags();

  if (!images?.size) {
    props.globalTags.delete(tag);
    updateGlobalTags();
  }
}

function removeGlobalTag(tag: string) {
  for (const image of props.images.keys()) {
    props.images.get(image)?.tags.delete(tag);
  }

  updateDisplayedTags();
  props.globalTags.delete(tag);
  updateGlobalTags();
}

let isFiltering = false;

function filterImages() {
  filteredImages.value.clear();
  isFiltering = false;
  if (!filterInput.value) return;

  const tags = filterInput.value.split(',').map((tag) => tag.trim());

  if (filterMode.value === 'or') {
    tags.forEach((tag) => {
      props.globalTags.get(tag)?.forEach((image) => filteredImages.value.add(image));
    });
  } else if (filterMode.value === 'and') {
    const imageCount = new Map();
    const requiredTagCount = tags.length;

    for (const tag of tags) {
      const imagesWithTag = props.globalTags.get(tag);
      if (!imagesWithTag) {
        isFiltering = true;
        selectedImages.value.clear();
        filteredImages.value.clear();
        updateDisplayedTags();
        return;
      }

      imagesWithTag.forEach((image) => {
        imageCount.set(image, (imageCount.get(image) || 0) + 1);
      });
    }

    filteredImages.value = new Set(
      [...imageCount.entries()]
        .filter(([, count]) => count === requiredTagCount)
        .map(([image]) => image),
    );
  } else if (filterMode.value === 'no') {
    const excludedImages = new Set();

    tags.forEach((tag) => {
      props.globalTags.get(tag)?.forEach((image) => excludedImages.add(image));
    });

    filteredImages.value = new Set(
      [...props.images.keys()].filter((image) => !excludedImages.has(image)),
    );
  }

  isFiltering = true;
  selectedImages.value = new Set([[...filteredImages.value][0]]);
  updateDisplayedTags();
}

function clearImageFilter() {
  if (filterInput.value) return;

  isFiltering = false;
  filteredImages.value.clear();
}
</script>

<template>
  <div class="tabs-lift tabs h-[calc(100vh-86px)]">
    <input type="radio" name="dataset_tabs" class="tab" aria-label="Dataset" checked />
    <div class="tab-content border-t-base-300 bg-base-100">
      <div class="flex h-full">
        <div
          class="flex w-[20%] max-w-[80%] min-w-[20%] flex-col pt-1 pl-1"
          :style="{ width: containerWidth + 'px' }"
          ref="container"
        >
          <div
            class="grid h-fit grid-cols-[repeat(auto-fit,_minmax(100px,_1fr))] gap-1 overflow-auto scroll-smooth"
          >
            <div
              v-for="[name, image] in images"
              :key="name"
              @click="toggleSelection(name, $event)"
              class="flex cursor-pointer items-center justify-center rounded-md border-1 border-black bg-base-200 select-none dark:border-white"
              :class="{
                'border-3 !border-blue-600 bg-blue-400': selectedImages.has(name),
                hidden: !filteredImages.has(name) && isFiltering,
              }"
            >
              <img
                :src="'file://' + image.path"
                :alt="name"
                @dblclick="displayFullImage(name)"
                draggable="false"
                loading="lazy"
                class="h-full w-full rounded-md object-scale-down"
              />
            </div>
          </div>
          <div
            class="mt-auto border-t-2 border-gray-400 pt-1 dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
          >
            <label class="input input-xs w-full border-r-0 px-1 pr-0 !outline-none">
              <input
                v-model.trim="filterInput"
                type="text"
                placeholder="Type a tag to filter the images..."
                @keyup.enter="filterImages"
                @input="clearImageFilter"
              />
              <span
                v-if="filterInput"
                class="cursor-pointer"
                @click="((filterInput = ''), clearImageFilter())"
                >X</span
              >
              <select v-model.lazy="filterMode" class="select w-fit select-xs !outline-none">
                <option value="or" selected>OR</option>
                <option value="no">NO</option>
                <option value="and">AND</option>
              </select>
            </label>
          </div>
        </div>
        <div class="flex flex-1">
          <div
            class="divider m-0 divider-horizontal cursor-ew-resize not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
            @mousedown.prevent="resizeContainer"
          ></div>
          <div class="flex w-[30%] items-center justify-center">
            <img
              v-if="selectedImages.size"
              :src="images.get([...selectedImages][0])?.path"
              class="max-h-full"
            />
          </div>
          <div
            class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
          ></div>
          <div class="w-[45%]">
            <div class="flex h-[50%]">
              <div class="w-[50%] text-center">
                <div
                  class="flex items-center justify-center border-b-2 border-gray-400 dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
                >
                  <p>Tags detected by autotagger but not in the captions</p>
                </div>
              </div>
              <div
                class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
              ></div>
              <div class="w-[50%] text-center">
                <div
                  class="flex items-center justify-center border-b-2 border-gray-400 dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
                >
                  <p>Tags in captions but not detected by the autotagger</p>
                </div>
              </div>
            </div>
            <div
              class="flex h-[50%] flex-col border-t-2 border-gray-400 pt-1 dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
            >
              <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth">
                <div
                  v-for="tag in displayedTags"
                  :key="tag"
                  class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
                  @click="removeTag(tag)"
                >
                  {{ tag }}
                </div>
              </div>
              <div
                class="mt-auto border-t-2 border-gray-400 pt-1 dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
              >
                <label class="input input-xs w-[50%] px-1 !outline-none">
                  <input
                    v-model.trim="tagInput"
                    type="text"
                    placeholder="Type to add a tag..."
                    @keyup.enter="addTag"
                  />
                </label>
              </div>
            </div>
          </div>
          <div
            class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
          ></div>
          <div class="w-[25%] pr-1">
            <div class="flex" :style="{ height: tagGroupSectionTopHeight + '%' }">
              <div v-for="[name, tags] in tagGroups" :key="name">
                <span>{{ name }}</span>
                <div v-for="tag in tags" :key="tag">
                  {{ tag }}
                </div>
              </div>
            </div>
            <div class="flex flex-col" :style="{ height: tagGroupSectionBottomHeight + '%' }">
              <div
                class="divider m-0 cursor-ns-resize not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
                @mousedown.prevent="resizeTagGroupSection"
              ></div>
              <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-1">
                <div
                  v-for="tag in displayedGlobalTags"
                  :key="tag"
                  class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
                  @click="removeGlobalTag(tag)"
                >
                  {{ tag }}
                </div>
              </div>
              <div
                class="mt-auto border-t-2 border-gray-400 pt-1 dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent);]"
              >
                <label class="input input-xs w-[50%] px-1 !outline-none">
                  <input
                    v-model.trim="globalTagInput"
                    type="text"
                    placeholder="Type to add a tag..."
                    @keyup.enter="addGlobalTag"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <TagGroupEditorComponent :tag-groups="tagGroups" />
  </div>
  <ModalComponent :html="modalHtml" :is-image="imageModal" />
</template>
