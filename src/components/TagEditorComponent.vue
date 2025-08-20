<script setup lang="ts">
import AutocompletionComponent from '@/components/AutocompletionComponent.vue';

import { ref, shallowRef, computed, type PropType } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useTagGroupStore } from '@/stores/tagGroupStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTagOperations } from '@/composables/useTagOperations';

import CopyIcon from '@/assets/icons/copy.svg';
import SortArrowIcon from '@/assets/icons/sort-arrow.svg';
import SwapIcon from '@/assets/icons/swap.svg';

const props = defineProps({
  selectedImages: { type: Object as PropType<Set<string>>, required: true },
  displayedTags: { type: Object as PropType<Set<string>>, required: true },
  displayedGlobalTags: { type: Object as PropType<Set<string>>, required: true },
  isFiltering: { type: Boolean, required: true },
  filterInput: { type: String, required: true },
});

const sortOrder = defineModel<string>('sortOrder', { required: true });
const globalSortMode = defineModel<string>('globalSortMode', { required: true });
const globalSortOrder = defineModel<string>('globalSortOrder', { required: true });
const globalTagFilterInput = defineModel<string>('globalTagFilterInput', { required: true });

const tagInput = ref('');
const globalTagInput = ref('');
const tagPosition = ref(-1);
const highlightInput = ref('');
const selectedTagGroups = ref<Set<string>>(new Set());
const tagGroupFilterInput = ref('');
const openReplaceTagSection = ref(false);
const tagReplaceContainer = shallowRef<HTMLLabelElement | null>(null);
const tagReplaceInput = ref('');
const tagGroupSectionTopHeight = ref(55);
const tagGroupSectionBottomHeight = ref(45);
const areTagsCopied = ref(false);

const highlightWords = computed(() =>
  highlightInput.value
    .split(',')
    .map((word) => word.trim())
    .filter((word) => word)
);

const datasetStore = useDatasetStore();
const tagGroupsStore = useTagGroupStore();
const settingsStore = useSettingsStore();
const tagOperations = useTagOperations();

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesHighlight(tag: string) {
  return highlightWords.value.some((word) => {
    const regex = new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}([^\\p{L}]|$)`, 'iu');
    return regex.test(tag);
  });
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
    <div v-if="settingsStore.showDiffSection" class="flex h-[50%]">
      <div :class="settingsStore.showCaptionDiffList ? 'flex w-[50%] flex-col' : 'flex w-full flex-col'">
        <div class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10">
          <p>Tags detected by autotagger but not in the captions</p>
        </div>
        <div v-if="selectedImages.size === 1" class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-2">
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
        v-if="settingsStore.showCaptionDiffList"
        class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400">
      </div>
      <div v-if="settingsStore.showCaptionDiffList" class="flex w-[50%] flex-col">
        <div class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10">
          <p>Tags in captions but not detected by the autotagger</p>
        </div>
        <div v-if="selectedImages.size === 1" class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-2">
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
    <div :class="[
      'flex flex-col border-t-2 border-gray-400 pt-1 dark:border-base-content/10',
      settingsStore.showDiffSection ? 'h-[50%]' : 'h-full'
    ]">
      <div class="border-b-2 border-gray-400 pb-1 dark:border-base-content/10">
        <div class="flex w-full gap-2">
          <label class="input input-sm gap-0 !outline-none">
            <span class="label">Tag Position</span>
            <input type="text" v-model.trim.number.lazy="tagPosition" @blur="validateTagPosition" />
          </label>
          <div class="tooltip" data-tip="Resets the tag position back to -1">
            <button class="btn btn-sm btn-outline btn-error" @click="tagPosition = -1">Reset</button>
          </div>
          <label class="input input-sm w-full !outline-none">
            <input v-model="globalTagFilterInput" type="text" placeholder="Filter global tags..." :disabled="!datasetStore.globalTags.size" />
          </label>
        </div>
        <label class="input input-sm w-full mt-1 !outline-none">
          <input v-model="highlightInput" type="text" placeholder="Highlight words..." :disabled="!displayedTags.size" />
        </label>
      </div>
      <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth pt-1">
        <div
          v-for="tag in displayedTags"
          :key="tag"
          class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
          :class="{
            'dark:bg-warning/50':
              (
                isFiltering &&
                filterInput
                  .split(',')
                  .map((tag) => tag.trim())
                  .includes(tag)
              ) || matchesHighlight(tag),
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
              <CopyIcon class="h-full w-full fill-none" />
            </button>
          </div>
          <label class="input relative input-sm w-full pl-1 !outline-none">
            <div class="tooltip" data-tip="Replace tags">
              <button class="btn btn-circle btn-ghost btn-xs border-none p-0.5" :disabled="!displayedTags.size" @click="openReplaceTagSection = !openReplaceTagSection">
                <SwapIcon class="h-full w-full fill-none" />
              </button>
            </div>
            <AutocompletionComponent
              v-model="tagInput"
              :disabled="!selectedImages.size"
              :id="'completion-list'"
              :placeholder="openReplaceTagSection ? 'Type a tag to replace...' : 'Type to add a tag...'"
              :multiple="openReplaceTagSection ? false : true"
              :custom-list="openReplaceTagSection ? [...displayedTags] : []"
              @on-complete="addTag()"
            />
          </label>
          <div class="not-focus-within:hover:tooltip" data-tip="Mode to sort the tags">
            <select v-model.lazy="datasetStore.sortMode" class="select relative w-fit select-sm !outline-none" :disabled="!displayedTags.size">
              <option value="none" selected>None</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
          <button class="btn btn-circle overflow-hidden border-none btn-sm dark:bg-[#323841]" :disabled="!displayedTags.size" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'">
            <SortArrowIcon
              class="swap-off h-full w-full fill-none transition-[transform] duration-[0.5s]"
              :class="{
                'transform-[rotate(180deg)]': sortOrder === 'desc'
              }"
            />
          </button>
        </div>
        <div v-if="openReplaceTagSection" class="flex gap-2">
          <label ref="tagReplaceContainer" class="input relative input-sm w-full pl-1 !outline-none">
            <AutocompletionComponent v-model="tagReplaceInput" :disabled="!selectedImages.size" :id="'replace-completion-list'" :placeholder="'Type the replacement of the tag...'" />
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
    <div
      v-if="settingsStore.showTagGroups"
      class="flex flex-col gap-2 overflow-auto pb-1"
      :style="{ height: tagGroupSectionTopHeight + '%' }"
    >
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
    <div
      class="flex flex-col"
      :style="{ height: settingsStore.showTagGroups ? tagGroupSectionBottomHeight + '%' : '100%' }"
    >
      <div
        v-if="settingsStore.showTagGroups"
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
          <SortArrowIcon
            class="swap-off h-full w-full fill-none transition-[transform] duration-[0.5s]"
            :class="{
              'transform-[rotate(180deg)]': globalSortOrder === 'desc'
            }"
          />
        </button>
      </div>
    </div>
  </div>
</template>
