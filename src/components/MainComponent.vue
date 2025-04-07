<script setup lang="ts">
import ModalComponent from '@/components/ModalComponent.vue';
import AutocompletionComponent from '@/components/AutocompletionComponent.vue';

import { ref, watch, computed, shallowRef, onMounted, toRaw } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useTagGroupStore } from '@/stores/tagGroupStore';
import { useSettingsStore } from '@/stores/settingsStore';

const props = defineProps({
  os: { type: String, required: true },
  arePreviewsEnabled: { type: Boolean, required: true },
});

const selectedImages = ref<Set<string>>(new Set());
const lastSelectedIndex = ref<number>(0);
const displayedTags = ref<Set<string>>(new Set());
const displayedGlobalTags = ref<Set<string>>(new Set());
const modalHtml = ref('');
const imageModal = ref(false);
const tagInput = ref('');
const globalTagInput = ref('');
const filterMode = ref('or');
const filterInput = ref('');
const isFiltering = ref(false);
const filteredImages = ref<Set<string>>(new Set());
const container = shallowRef<HTMLDivElement | null>(null);
const containerWidth = ref(0);
const tagGroupSectionTopHeight = ref(55);
const tagGroupSectionBottomHeight = ref(45);
const areTagsCopied = ref(false);
const sortMode = ref('none');
const sortOrder = ref('asc');
const globalSortMode = ref('alphabetical');
const globalSortOrder = ref('asc');
const previewImage = ref('');
const tagPosition = ref(-1);
const selectedTagGroups = ref<Set<string>>(new Set());
const tagGroupFilterInput = ref('');

const datasetStore = useDatasetStore();
const tagGroupsStore = useTagGroupStore();
const settingsStore = useSettingsStore();

const imageKeys = computed(() => Array.from(datasetStore.images.keys()));

watch(
  imageKeys,
  (newKeys) => {
    if (newKeys.length > 0) {
      const firstImage = newKeys[0];
      selectedImages.value = new Set([firstImage]);
      updateDisplayedTags();
      updateGlobalTags();
      datasetStore.resetDatasetStatus();
    }
  },
  { immediate: true },
);

function toggleSelection(id: string, event: MouseEvent) {
  const index = imageKeys.value.indexOf(id);

  if (event.shiftKey) {
    const start = Math.min(lastSelectedIndex.value, index);
    const end = Math.max(lastSelectedIndex.value, index);
    const range = imageKeys.value.slice(start, end + 1);
    range.forEach((img) => {
      if (!isFiltering.value || filteredImages.value.has(img)) selectedImages.value.add(img);
    });
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
  if (props.arePreviewsEnabled) return;

  const modal = document.getElementById('my_modal_1') as HTMLDialogElement;

  if (modal) {
    imageModal.value = true;
    modalHtml.value = `
      <div class="flex justify-center">
        <img src="file://${datasetStore.images.get(id)?.path}" class="max-h-screen" />
      </div>
    `;
    modal.showModal();
  }
}

function updateDisplayedTags() {
  displayedTags.value.clear();

  const allTags = new Set<string>();
  for (const imageName of selectedImages.value) {
    const image = datasetStore.images.get(imageName);
    if (image && image.tags) image.tags.forEach((tag) => allTags.add(tag));
  }

  if (allTags.size === 0) {
    displayedTags.value.clear();
    return;
  }

  const [firstTag, ...remainingTags] = allTags;

  if (remainingTags.length === 0) {
    displayedTags.value = new Set([firstTag]);
    return;
  }

  if (sortMode.value === 'alphabetical') {
    remainingTags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  const sortedTags = [
    firstTag,
    ...(sortOrder.value === 'desc' ? remainingTags.reverse() : remainingTags),
  ];
  displayedTags.value = new Set(sortedTags);
}

function updateGlobalTags() {
  const allTags: string[] = [];
  for (const image of datasetStore.images.values()) {
    if (image?.tags.size > 0)
      image.tags.forEach((tag) => {
        if (!allTags.includes(tag)) allTags.push(tag);
      });
  }

  if (allTags.length === 0) {
    displayedGlobalTags.value.clear();
    return;
  }

  if (globalSortMode.value === 'alphabetical') {
    allTags.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  } else {
    allTags.sort(
      (a, b) => datasetStore.globalTags.get(b)!.size - datasetStore.globalTags.get(a)!.size,
    );
  }

  if (globalSortOrder.value === 'desc') allTags.reverse();

  displayedGlobalTags.value = new Set(allTags);
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

function addTag(_tag?: string, image?: string) {
  const newTags = _tag || tagInput.value;
  if (!newTags) return;

  const images = image ? new Set([image]) : new Set(selectedImages.value);
  const tags = newTags.split(',').map((tag) => tag.trim());

  const previousState = new Map();

  validateTagPosition();
  for (const image of images.values()) {
    const imageWithTags = datasetStore.images.get(image);

    if (tags.every((tag) => imageWithTags?.tags.has(tag))) {
      images.delete(image);
      continue;
    }

    previousState.set(image, new Set(imageWithTags?.tags));

    for (const tag of tags) {
      if (!datasetStore.globalTags.has(tag)) {
        datasetStore.globalTags.set(tag, new Set(images));
      } else {
        const imagesWithTag = datasetStore.globalTags.get(tag)!;
        datasetStore.globalTags.set(tag, new Set([...imagesWithTag, ...images]));
      }

      if (datasetStore.tagDiff.size === 0) continue;

      const diff = datasetStore.tagDiff.get(image);
      if (diff?.tagger.has(tag)) {
        diff?.tagger.delete(tag);
      } else {
        diff?.original.add(tag);
      }
    }

    if (tagPosition.value === -1) {
      imageWithTags!.tags = new Set([...imageWithTags!.tags, ...tags]);
    } else {
      const tagsCopy = [...imageWithTags!.tags];
      tagsCopy.splice(tagPosition.value - 1, 0, ...tags);
      imageWithTags!.tags = new Set(tagsCopy);
    }
  }

  tagInput.value = '';
  if (images.size === 0) return;

  datasetStore.pushDatasetChange({
    type: 'add_tag',
    images: new Set(images.values()),
    tags: new Set(tags),
    tagPosition: toRaw(tagPosition.value),
    previousState,
  });

  updateDisplayedTags();
  updateGlobalTags();
}

function addGlobalTag() {
  const tags = globalTagInput.value.split(',').map((tag) => tag.trim());
  if (tags.length === 0) return;

  validateTagPosition();
  for (const image of datasetStore.images.keys()) {
    const imageWithTags = datasetStore.images.get(image);

    for (const tag of tags) {
      if (tagPosition.value === -1) {
        imageWithTags?.tags.add(tag);
      } else {
        const tagsCopy = [...imageWithTags!.tags];
        tagsCopy.splice(tagPosition.value - 1, 0, tag);
        imageWithTags!.tags = new Set(tagsCopy);
      }

      datasetStore.globalTags.set(tag, new Set([...datasetStore.images.keys()]));
    }
  }

  datasetStore.pushDatasetChange({
    type: 'add_global_tag',
    tags: new Set(tags),
    tagPosition: toRaw(tagPosition.value),
  });

  updateDisplayedTags();
  updateGlobalTags();

  globalTagInput.value = '';
}

function removeTag(tag: string, image?: string) {
  const imagesWithTag = datasetStore.globalTags.get(tag);
  const images = image ? new Set([image]) : selectedImages.value;

  datasetStore.pushDatasetChange({
    type: 'remove_tag',
    images,
    tags: new Set([tag]),
  });

  for (const image of images.values()) {
    datasetStore.images.get(image)?.tags.delete(tag);
    imagesWithTag?.delete(image);

    if (datasetStore.tagDiff.size > 0) {
      datasetStore.tagDiff.get(image)?.original.delete(tag);
    }
  }

  updateDisplayedTags();

  if (!imagesWithTag?.size) {
    datasetStore.globalTags.delete(tag);
    updateGlobalTags();
  }
}

function removeGlobalTag(tag: string) {
  for (const image of datasetStore.images.keys()) {
    datasetStore.images.get(image)?.tags.delete(tag);
  }

  datasetStore.pushDatasetChange({
    type: 'remove_global_tag',
    tags: new Set([tag]),
  });

  updateDisplayedTags();
  datasetStore.globalTags.delete(tag);
  updateGlobalTags();
}

function filterImages() {
  filteredImages.value.clear();
  isFiltering.value = false;
  if (!filterInput.value) return;

  const tags = filterInput.value.split(',').map((tag) => tag.trim());

  if (filterMode.value === 'or') {
    tags.forEach((tag) => {
      datasetStore.globalTags.get(tag)?.forEach((image) => filteredImages.value.add(image));
    });
  } else if (filterMode.value === 'and') {
    const imageCount = new Map();
    const requiredTagCount = tags.length;

    for (const tag of tags) {
      const imagesWithTag = datasetStore.globalTags.get(tag);
      if (!imagesWithTag) {
        isFiltering.value = true;
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
  }

  isFiltering.value = true;
  selectedImages.value = new Set(filteredImages.value.size ? [[...filteredImages.value][0]] : []);
  lastSelectedIndex.value = !filteredImages.value.has(imageKeys.value[lastSelectedIndex.value])
    ? 0
    : lastSelectedIndex.value;
  updateDisplayedTags();
}

function clearImageFilter() {
  if (filterInput.value) return;

  if (!filteredImages.value.size && !selectedImages.value.size) {
    selectedImages.value.add(datasetStore.images.keys().next().value!);
    updateDisplayedTags();
  }
  isFiltering.value = false;
  filteredImages.value.clear();
}

function addOrRemoveTag(tag: string) {
  for (const image of selectedImages.value.values()) {
    if (datasetStore.images.get(image)?.tags.has(tag)) removeTag(tag, image);
    else addTag(tag, image);
  }
}

function copyTextToClipboard(tags: Set<string>) {
  navigator.clipboard.writeText([...tags].join(', '));
  areTagsCopied.value = true;

  setTimeout(() => {
    areTagsCopied.value = false;
  }, 1000);
}

function validateTagPosition() {
  if (!tagPosition.value || tagPosition.value < -1) tagPosition.value = -1;
  if (!Number.isInteger(tagPosition.value))
    tagPosition.value = parseInt(tagPosition.value.toString());
}

function handleTagGroupChange(tagGroup: string) {
  if (selectedTagGroups.value.has(tagGroup)) selectedTagGroups.value.delete(tagGroup);
  else selectedTagGroups.value.add(tagGroup);
}

onMounted(() => {
  datasetStore.onChange = [updateDisplayedTags, updateGlobalTags];
});
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
        <div
          class="grid h-fit grid-cols-[repeat(auto-fit,_minmax(100px,_1fr))] gap-1 overflow-auto scroll-smooth"
        >
          <div
            v-for="[name, image] in datasetStore.images"
            :key="name"
            @click="toggleSelection(name, $event)"
            @mouseenter="previewImage = name"
            @mouseleave="previewImage = ''"
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
        <div class="mt-auto border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
          <label class="input input-sm w-full border-r-0 pr-0 pl-1 !outline-none">
            <AutocompletionComponent
              v-model="filterInput"
              :disabled="!datasetStore.images.size"
              :id="'filter-completion-list'"
              :placeholder="'Type a tag to filter the images...'"
              :multiple="true"
              :custom-list="[...datasetStore.globalTags.keys()]"
              @on-complete="filterImages"
              @on-input="clearImageFilter"
            />
            <span
              v-if="filterInput"
              class="cursor-pointer"
              @click="((filterInput = ''), clearImageFilter())"
              >X</span
            >
            <select v-model.lazy="filterMode" class="select w-fit select-sm !outline-none">
              <option value="or" selected>OR</option>
              <option value="and">AND</option>
            </select>
          </label>
        </div>
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
              :src="'file://' + datasetStore.images.get(previewImage)?.path"
              class="max-h-[80vh] max-w-[80vw] object-contain"
            />
          </div>
        </div>
        <div class="flex w-[30%] items-center justify-center">
          <img
            v-if="selectedImages.size"
            :src="datasetStore.images.get([...selectedImages][0])?.path"
            class="max-h-full"
          />
        </div>
        <div
          class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
        ></div>
        <div class="w-[40%]">
          <div class="flex h-[50%]">
            <div class="flex w-[50%] flex-col">
              <div
                class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10"
              >
                <p>Tags detected by autotagger but not in the captions</p>
              </div>
              <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-2">
                <div
                  v-for="tag in datasetStore.tagDiff.get([...selectedImages][0])?.tagger"
                  :key="tag"
                  class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer dark:bg-gray-700"
                  @click="addTag(tag, [...selectedImages][0])"
                >
                  {{ tag }}
                </div>
              </div>
            </div>
            <div
              class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
            ></div>
            <div class="flex w-[50%] flex-col">
              <div
                class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10"
              >
                <p>Tags in captions but not detected by the autotagger</p>
              </div>
              <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-2">
                <div
                  v-for="tag in datasetStore.tagDiff.get([...selectedImages][0])?.original"
                  :key="tag"
                  class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer dark:bg-rose-900"
                  @click="removeTag(tag, [...selectedImages][0])"
                >
                  {{ tag }}
                </div>
              </div>
            </div>
          </div>
          <div
            class="flex h-[50%] flex-col border-t-2 border-gray-400 pt-1 dark:border-base-content/10"
          >
            <div class="border-b-2 border-gray-400 pb-1 dark:border-base-content/10">
              <label class="input input-sm w-[40%] gap-0 !outline-none xl:w-[35%]">
                <span class="label">Tag Position</span>
                <input type="number" v-model.trim.lazy="tagPosition" @blur="validateTagPosition" />
              </label>
            </div>
            <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-1">
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
              class="mt-auto flex gap-2 border-t-2 border-gray-400 pt-1 dark:border-base-content/10"
            >
              <div
                class="tooltip"
                :class="{ 'tooltip-success': areTagsCopied }"
                :data-tip="areTagsCopied ? 'Tags copied!' : 'Click to copy the tags'"
              >
                <button
                  class="btn btn-circle border-none p-0.5 btn-sm btn-ghost dark:hover:bg-[#323841]"
                  :disabled="!displayedTags.size"
                  @click="copyTextToClipboard(displayedTags)"
                >
                  <svg
                    class="h-full w-full fill-none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M9.29289 3.29289C9.48043 3.10536 9.73478 3 10 3H14C15.6569 3 17 4.34315 17 6V15C17 16.6569 15.6569 18 14 18H7C5.34315 18 4 16.6569 4 15V9C4 8.73478 4.10536 8.48043 4.29289 8.29289L9.29289 3.29289ZM14 5H11V9C11 9.55228 10.5523 10 10 10H6V15C6 15.5523 6.44772 16 7 16H14C14.5523 16 15 15.5523 15 15V6C15 5.44772 14.5523 5 14 5ZM7.41421 8H9V6.41421L7.41421 8ZM19 5C19.5523 5 20 5.44772 20 6V18C20 19.6569 18.6569 21 17 21H7C6.44772 21 6 20.5523 6 20C6 19.4477 6.44772 19 7 19H17C17.5523 19 18 18.5523 18 18V6C18 5.44772 18.4477 5 19 5Z"
                      class="fill-current"
                    />
                  </svg>
                </button>
              </div>
              <label class="input relative input-sm w-full pl-1 !outline-none">
                <AutocompletionComponent
                  v-model="tagInput"
                  :disabled="!selectedImages.size"
                  :id="'completion-list'"
                  :placeholder="'Type to add a tag...'"
                  :multiple="true"
                  @on-complete="addTag()"
                />
              </label>
              <div class="not-focus-within:hover:tooltip" data-tip="Mode to sort the tags">
                <select
                  v-model.lazy="sortMode"
                  class="select relative w-fit select-sm !outline-none"
                  :disabled="!displayedTags.size"
                  @change="updateDisplayedTags"
                >
                  <option value="none" selected>None</option>
                  <option value="alphabetical">Alphabetical</option>
                </select>
              </div>
              <button
                class="btn btn-circle overflow-hidden border-none btn-sm dark:bg-[#323841]"
                :disabled="!displayedTags.size"
                @click="((sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'), updateDisplayedTags())"
              >
                <svg
                  class="swap-off h-full w-full fill-none transition-[transform] duration-[0.5s]"
                  viewBox="0 0 24 24"
                  :class="{
                    'transform-[rotate(180deg)]': sortOrder === 'desc',
                  }"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 4L12 20"
                    class="stroke-current stroke-2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M18 10L12.0625 4.0625V4.0625C12.028 4.02798 11.972 4.02798 11.9375 4.0625V4.0625L6 10"
                    class="stroke-current stroke-2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div
          class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
        ></div>
        <div class="w-[30%] pt-1 pr-1">
          <div
            class="flex flex-col gap-2 overflow-auto pb-1"
            :style="{ height: tagGroupSectionTopHeight + '%' }"
          >
            <div class="h-[40%] pb-1">
              <div class="flex gap-2">
                <label class="input input-sm w-full !outline-none">
                  <span class="label">Group Search</span>
                  <input
                    v-model="tagGroupFilterInput"
                    type="text"
                    placeholder="Type to seach for a group..."
                  />
                </label>
                <button class="btn btn-sm btn-outline btn-error" @click="selectedTagGroups.clear()">
                  Close All
                </button>
              </div>
              <span class="text-sm">Tag Groups</span>
              <div
                class="flex h-[calc(100%_-_50px)] flex-wrap content-start gap-2 overflow-auto pb-1"
              >
                <button
                  v-for="name in tagGroupsStore.tagGroups.keys()"
                  :key="name"
                  class="btn !text-sm btn-xs font-normal"
                  :class="{
                    '[--btn-color:var(--color-rose-900)]': [...displayedTags].some((tag) =>
                      tagGroupsStore.tagGroups.get(name)?.has(tag),
                    ),
                    '[--btn-color:#a6d9e2] dark:[--btn-color:var(--color-gray-700)]': ![
                      ...displayedTags,
                    ].some((tag) => tagGroupsStore.tagGroups.get(name)?.has(tag)),
                    hidden:
                      tagGroupFilterInput &&
                      !name.toLowerCase().includes(tagGroupFilterInput.toLowerCase()),
                  }"
                  @click="handleTagGroupChange(name)"
                >
                  {{ name }}
                </button>
              </div>
            </div>
            <div class="h-[60%] overflow-auto border-t-3 dark:border-base-content/50">
              <div v-for="name in selectedTagGroups" :key="name">
                <div class="divider my-2 text-sm">{{ name }}</div>
                <div class="flex flex-wrap content-start gap-2">
                  <div
                    v-for="tag in tagGroupsStore.tagGroups.get(name)"
                    :key="tag"
                    class="h-fit w-fit px-1.5 text-sm hover:cursor-pointer"
                    :class="{
                      'bg-rose-900': displayedTags.has(tag),
                      'bg-[#a6d9e2] dark:bg-gray-700': !displayedTags.has(tag),
                    }"
                    @click="addOrRemoveTag(tag)"
                  >
                    {{ tag }}
                  </div>
                </div>
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
                {{
                  settingsStore.showTagCount
                    ? tag + ' | ' + datasetStore.globalTags.get(tag)!.size
                    : tag
                }}
              </div>
            </div>
            <div
              class="mt-auto flex gap-2 border-t-2 border-gray-400 pt-1 dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent);]"
            >
              <div
                class="tooltip"
                :class="{ 'tooltip-success': areTagsCopied }"
                :data-tip="areTagsCopied ? 'Tags copied!' : 'Click to copy the global tags'"
              >
                <button
                  class="btn btn-circle border-none p-0.5 btn-sm btn-ghost dark:hover:bg-[#323841]"
                  :disabled="!displayedGlobalTags.size"
                  @click="copyTextToClipboard(displayedGlobalTags)"
                >
                  <svg
                    class="h-full w-full fill-none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M9.29289 3.29289C9.48043 3.10536 9.73478 3 10 3H14C15.6569 3 17 4.34315 17 6V15C17 16.6569 15.6569 18 14 18H7C5.34315 18 4 16.6569 4 15V9C4 8.73478 4.10536 8.48043 4.29289 8.29289L9.29289 3.29289ZM14 5H11V9C11 9.55228 10.5523 10 10 10H6V15C6 15.5523 6.44772 16 7 16H14C14.5523 16 15 15.5523 15 15V6C15 5.44772 14.5523 5 14 5ZM7.41421 8H9V6.41421L7.41421 8ZM19 5C19.5523 5 20 5.44772 20 6V18C20 19.6569 18.6569 21 17 21H7C6.44772 21 6 20.5523 6 20C6 19.4477 6.44772 19 7 19H17C17.5523 19 18 18.5523 18 18V6C18 5.44772 18.4477 5 19 5Z"
                      class="fill-current"
                    />
                  </svg>
                </button>
              </div>
              <label class="input relative input-sm w-full pl-1 !outline-none">
                <AutocompletionComponent
                  v-model="globalTagInput"
                  :disabled="!datasetStore.images.size"
                  :id="'global-completion-list'"
                  :placeholder="'Type to add a global tag...'"
                  :multiple="true"
                  @on-complete="addGlobalTag"
                />
              </label>
              <div class="not-focus-within:hover:tooltip" data-tip="Mode to sort the tags">
                <select
                  v-model.lazy="globalSortMode"
                  class="select relative w-fit select-sm !outline-none"
                  :disabled="!displayedGlobalTags.size"
                  @change="updateGlobalTags"
                >
                  <option value="alphabetical" selected>Alphabetical</option>
                  <option value="tag_count">Tag Count</option>
                </select>
              </div>
              <button
                class="btn btn-circle overflow-hidden border-none btn-sm dark:bg-[#323841]"
                :disabled="!displayedGlobalTags.size"
                @click="
                  ((globalSortOrder = globalSortOrder === 'asc' ? 'desc' : 'asc'),
                  updateGlobalTags())
                "
              >
                <svg
                  class="swap-off h-full w-full fill-none transition-[transform] duration-[0.5s]"
                  viewBox="0 0 24 24"
                  :class="{
                    'transform-[rotate(180deg)]': globalSortOrder === 'desc',
                  }"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 4L12 20"
                    class="stroke-current stroke-2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M18 10L12.0625 4.0625V4.0625C12.028 4.02798 11.972 4.02798 11.9375 4.0625V4.0625L6 10"
                    class="stroke-current stroke-2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ModalComponent :html="modalHtml" :is-image="imageModal" />
</template>
