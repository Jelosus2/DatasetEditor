<script setup lang="ts">
import AutocompletionComponent from '@/components/AutocompletionComponent.vue';

import { ref, shallowRef, type PropType } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useTagGroupStore } from '@/stores/tagGroupStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTagOperations } from '@/composables/useTagOperations';

const props = defineProps({
  selectedImages: { type: Object as PropType<Set<string>>, required: true },
  displayedTags: { type: Object as PropType<Set<string>>, required: true },
  displayedGlobalTags: { type: Object as PropType<Set<string>>, required: true },
  isFiltering: { type: Boolean, required: true },
  filterInput: { type: String, required: true },
});

const sortMode = defineModel<string>('sortMode', { required: true });
const sortOrder = defineModel<string>('sortOrder', { required: true });
const globalSortMode = defineModel<string>('globalSortMode', { required: true });
const globalSortOrder = defineModel<string>('globalSortOrder', { required: true });

const tagInput = ref('');
const globalTagInput = ref('');
const tagPosition = ref(-1);
const selectedTagGroups = ref<Set<string>>(new Set());
const tagGroupFilterInput = ref('');
const openReplaceTagSection = ref(false);
const tagReplaceContainer = shallowRef<HTMLLabelElement | null>(null);
const tagReplaceInput = ref('');
const tagGroupSectionTopHeight = ref(55);
const tagGroupSectionBottomHeight = ref(45);
const areTagsCopied = ref(false);

const datasetStore = useDatasetStore();
const tagGroupsStore = useTagGroupStore();
const settingsStore = useSettingsStore();
const tagOperations = useTagOperations();

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
  if (!newTags || (openReplaceTagSection.value && !_tag)) return;

  const images = image ? new Set([image]) : new Set(props.selectedImages);
  tagPosition.value = tagOperations.validateTagPosition(tagPosition.value);
  tagOperations.addTag(newTags, images, tagPosition.value);
  tagInput.value = '';
}

function addGlobalTag() {
  if (!globalTagInput.value) return;
  tagPosition.value = tagOperations.validateTagPosition(tagPosition.value);
  tagOperations.addGlobalTag(globalTagInput.value, tagPosition.value);
  globalTagInput.value = '';
}

function removeTag(tag: string, image?: string) {
  const images = image ? new Set([image]) : new Set(props.selectedImages);
  tagOperations.removeTag(tag, images);
}

function removeGlobalTag(tag: string) {
  tagOperations.removeGlobalTag(tag);
}

function addOrRemoveTag(tag: string) {
  for (const image of props.selectedImages.values()) {
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
  tagPosition.value = tagOperations.validateTagPosition(tagPosition.value);
}

function handleTagGroupChange(tagGroup: string) {
  if (selectedTagGroups.value.has(tagGroup)) selectedTagGroups.value.delete(tagGroup);
  else selectedTagGroups.value.add(tagGroup);
}

function replaceTag(mode: 'selected' | 'all') {
  const originalTag = tagInput.value;
  const tag = tagReplaceInput.value;
  if (!tag || !originalTag || tag === originalTag) return;

  const images = mode === 'selected' ? new Set(props.selectedImages) : new Set(datasetStore.images.keys());
  tagOperations.replaceTag(originalTag, tag, images);

  tagInput.value = '';
  tagReplaceInput.value = '';
}
</script>

<template>
  <div class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"></div>
  <div class="w-[40%]">
    <div class="flex h-[50%]">
      <div class="flex w-[50%] flex-col">
        <div class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10">
          <p>Tags detected by autotagger but not in the captions</p>
        </div>
        <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-2">
          <div
            v-for="tag in datasetStore.tagDiff.get([...props.selectedImages][0])?.tagger"
            :key="tag"
            class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer dark:bg-gray-700"
            @click="addTag(tag, [...props.selectedImages][0])"
          >
            {{ tag }}
          </div>
        </div>
      </div>
      <div class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"></div>
      <div class="flex w-[50%] flex-col">
        <div class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10">
          <p>Tags in captions but not detected by the autotagger</p>
        </div>
        <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-2">
          <div
            v-for="tag in datasetStore.tagDiff.get([...props.selectedImages][0])?.original"
            :key="tag"
            class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer dark:bg-rose-900"
            @click="removeTag(tag, [...props.selectedImages][0])"
          >
            {{ tag }}
          </div>
        </div>
      </div>
    </div>
    <div class="flex h-[50%] flex-col border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
      <div class="border-b-2 border-gray-400 pb-1 dark:border-base-content/10">
        <div class="flex w-[50%] gap-2">
          <label class="input input-sm gap-0 !outline-none">
            <span class="label">Tag Position</span>
            <input type="text" v-model.trim.number.lazy="tagPosition" @blur="validateTagPosition" />
          </label>
          <div class="tooltip" data-tip="Resets the tag position back to -1">
            <button class="btn btn-sm btn-outline btn-error" @click="tagPosition = -1">Reset</button>
          </div>
        </div>
      </div>
      <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-1">
        <div
          v-for="tag in displayedTags"
          :key="tag"
          class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
          :class="{
            'dark:bg-warning/50':
              isFiltering &&
              filterInput
                .split(',')
                .map((tag) => tag.trim())
                .includes(tag),
          }"
          @click="removeTag(tag)"
        >
          {{ tag }}
        </div>
      </div>
      <div class="mt-auto flex flex-col gap-2 border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
        <div class="flex gap-2">
          <div class="tooltip" :class="{ 'tooltip-success': areTagsCopied }" :data-tip="areTagsCopied ? 'Tags copied!' : 'Click to copy the tags'">
            <button class="btn btn-circle border-none p-0.5 btn-sm btn-ghost dark:hover:bg-[#323841]" :disabled="!displayedTags.size" @click="copyTextToClipboard(displayedTags)">
              <svg class="h-full w-full fill-none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
            <div class="tooltip" data-tip="Click to open or close the tag replace section">
              <span class="inline-block cursor-pointer text-sm" :class="{ 'rotate-90': openReplaceTagSection }" @click="openReplaceTagSection = !openReplaceTagSection">></span>
            </div>
            <AutocompletionComponent
              v-model="tagInput"
              :disabled="!props.selectedImages.size"
              :id="'completion-list'"
              :placeholder="openReplaceTagSection ? 'Type a tag to replace...' : 'Type to add a tag...'"
              :multiple="openReplaceTagSection ? false : true"
              @on-complete="addTag()"
            />
          </label>
          <div class="not-focus-within:hover:tooltip" data-tip="Mode to sort the tags">
            <select v-model.lazy="sortMode" class="select relative w-fit select-sm !outline-none" :disabled="!displayedTags.size">
              <option value="none" selected>None</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
          <button class="btn btn-circle overflow-hidden border-none btn-sm dark:bg-[#323841]" :disabled="!displayedTags.size" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'">
            <svg class="swap-off h-full w-full fill-none transition-[transform] duration-[0.5s]" viewBox="0 0 24 24" :class="{ 'transform-[rotate(180deg)]': sortOrder === 'desc' }" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 4L12 20" class="stroke-current stroke-2" stroke-linecap="round" stroke-linejoin="round" />
              <path d="M18 10L12.0625 4.0625V4.0625C12.028 4.02798 11.972 4.02798 11.9375 4.0625V4.0625L6 10" class="stroke-current stroke-2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>
        </div>
        <div v-if="openReplaceTagSection" class="flex gap-2">
          <label ref="tagReplaceContainer" class="input relative input-sm w-full pl-1 !outline-none">
            <AutocompletionComponent v-model="tagReplaceInput" :disabled="!props.selectedImages.size" :id="'replace-completion-list'" :placeholder="'Type the replacement of the tag...'" />
          </label>
          <div class="tooltip shrink-0" data-tip="Replace the tags from the selected images">
            <button class="btn btn-sm btn-outline btn-info" @click="replaceTag('selected')">Replace Selected</button>
          </div>
          <div class="tooltip shrink-0" data-tip="Replace the tags from all images">
            <button class="btn btn-sm btn-outline btn-info" @click="replaceTag('all')">Replace All</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"></div>
  <div class="w-[30%] pt-1 pr-1">
    <div class="flex flex-col gap-2 overflow-auto pb-1" :style="{ height: tagGroupSectionTopHeight + '%' }">
      <div class="h-[40%] pb-1">
        <div class="flex gap-2">
          <label class="input input-sm w-full !outline-none">
            <span class="label">Group Search</span>
            <input v-model="tagGroupFilterInput" type="text" placeholder="Type to seach for a group..." />
          </label>
          <button class="btn btn-sm btn-outline btn-error" @click="selectedTagGroups.clear()">Close All</button>
        </div>
        <span class="text-sm">Tag Groups</span>
        <div class="flex h-[calc(100%_-_50px)] flex-wrap content-start gap-2 overflow-auto pb-1">
          <button
            v-for="name in tagGroupsStore.tagGroups.keys()"
            :key="name"
            class="btn !text-sm btn-xs font-normal"
            :class="{
              '[--btn-color:var(--color-rose-900)]': [...displayedTags].some((tag) => tagGroupsStore.tagGroups.get(name)?.has(tag)),
              '[--btn-color:#a6d9e2] dark:[--btn-color:var(--color-gray-700)]': ![...displayedTags].some((tag) => tagGroupsStore.tagGroups.get(name)?.has(tag)),
              hidden: tagGroupFilterInput && !name.toLowerCase().includes(tagGroupFilterInput.toLowerCase()),
            }"
            @click="handleTagGroupChange(name)"
          >
            {{ name }}
          </button>
        </div>
      </div>
      <div class="h-[60%] overflow-auto border-t-3 dark:border-base-content/50">
        <div v-for="name in selectedTagGroups" :key="name">
          <div class="divider my-2 text-sm">
            {{ name }}
            <span class="cursor-pointer border-1 px-1 font-bold hover:text-error" @click="selectedTagGroups.delete(name)">X</span>
          </div>
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
      <div class="divider m-0 cursor-ns-resize not-dark:before:bg-gray-400 not-dark:after:bg-gray-400" @mousedown.prevent="resizeTagGroupSection"></div>
      <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-1">
        <div
          v-for="tag in displayedGlobalTags"
          :key="tag"
          class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
          @click="removeGlobalTag(tag)"
        >
          {{ settingsStore.showTagCount ? tag + ' | ' + datasetStore.globalTags.get(tag)!.size : tag }}
        </div>
      </div>
      <div class="mt-auto flex gap-2 border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
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
          <select v-model.lazy="globalSortMode" class="select relative w-fit select-sm !outline-none" :disabled="!displayedGlobalTags.size">
            <option value="alphabetical" selected>Alphabetical</option>
            <option value="tag_count">Tag Count</option>
          </select>
        </div>
        <button class="btn btn-circle overflow-hidden border-none btn-sm dark:bg-[#323841]" :disabled="!displayedGlobalTags.size" @click="globalSortOrder = globalSortOrder === 'asc' ? 'desc' : 'asc'">
          <svg class="swap-off h-full w-full fill-none transition-[transform] duration-[0.5s]" viewBox="0 0 24 24" :class="{ 'transform-[rotate(180deg)]': globalSortOrder === 'desc' }" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L12 20" class="stroke-current stroke-2" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M18 10L12.0625 4.0625V4.0625C12.028 4.02798 11.972 4.02798 11.9375 4.0625V4.0625L6 10" class="stroke-current stroke-2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
