<script setup lang="ts">
import AutocompletionComponent from '@/components/AutocompletionComponent.vue';

import { ref, shallowRef, computed, type PropType } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useTagGroupStore } from '@/stores/tagGroupStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTagOperations } from '@/composables/useTagOperations';

import CopyIcon from '@/assets/icons/copy.svg';
import SortArrowIcon from '@/assets/icons/sort-arrow.svg';

const props = defineProps({
  selectedImages: { type: Object as PropType<Set<string>>, required: true },
  displayedTags: { type: Object as PropType<Set<string>>, required: true },
  displayedGlobalTags: { type: Object as PropType<Set<string>>, required: true },
  isFiltering: { type: Boolean, required: true },
  filterInput: { type: String, required: true },
});
const emit = defineEmits(['select-all-images', 'clear-selection']);

const sortOrder = defineModel<string>('sortOrder', { required: true });
const globalSortMode = defineModel<string>('globalSortMode', { required: true });
const globalSortOrder = defineModel<string>('globalSortOrder', { required: true });
const globalTagFilterInput = defineModel<string>('globalTagFilterInput', { required: true });

const tagInput = ref('');
const globalTagInput = ref('');
const editMode = ref<'individual' | 'mass'>('individual');
const tagPosition = ref(-1);
const highlightInput = ref('');
const selectedTagGroups = ref<Set<string>>(new Set());
const tagGroupFilterInput = ref('');
const replaceSourceInput = ref('');
const replaceTargetInput = ref('');
const mainSectionContainer = shallowRef<HTMLDivElement | null>(null);
const topSectionHeight = ref(50);
const tagGroupWidth = ref(30);
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

const tagEditorMainWidth = computed(() => 70 - tagGroupWidth.value);
const showTopSection = computed(() =>
  editMode.value === 'mass' ? true : settingsStore.showDiffSection
);

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesHighlight(tag: string) {
  return highlightWords.value.some((word) => {
    const regex = new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}([^\\p{L}]|$)`, 'iu');
    return regex.test(tag);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function resizeMainSection(moveEvent: MouseEvent) {
  const startY = moveEvent.clientY;
  const containerHeight = mainSectionContainer.value?.getBoundingClientRect().height || 0;
  const startTopHeight = topSectionHeight.value;

  function onMouseMove(event: MouseEvent) {
    if (!containerHeight) return;
    const delta = event.clientY - startY;
    const deltaPercent = (delta / containerHeight) * 100;
    topSectionHeight.value = clamp(startTopHeight + deltaPercent, 25, 70);
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}

function resizeTagGroupWidth(moveEvent: MouseEvent) {
  const startX = moveEvent.clientX;
  const divider = moveEvent.currentTarget as HTMLElement | null;
  const parentWidth = divider?.parentElement?.getBoundingClientRect().width || 0;
  const startWidthPx = (tagGroupWidth.value / 100) * parentWidth;

  function onMouseMove(event: MouseEvent) {
    if (!parentWidth) return;
    const delta = event.clientX - startX;
    const newWidthPx = startWidthPx - delta;
    const newWidthPercent = (newWidthPx / parentWidth) * 100;
    tagGroupWidth.value = clamp(newWidthPercent, 24, 34);
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
  const originalTag = replaceSourceInput.value.trim();
  const tag = replaceTargetInput.value.trim();
  if (!tag || !originalTag || tag === originalTag) return;

  const images = mode === 'selected' ? new Set(props.selectedImages) : new Set(datasetStore.images.keys());
  tagOperations.replaceTag(originalTag, tag, images);

  replaceSourceInput.value = '';
  replaceTargetInput.value = '';
}
</script>

<template>
  <div class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"></div>
  <div class="flex h-full min-h-0 flex-col" :style="{ width: tagEditorMainWidth + '%' }">
    <div class="flex items-center justify-between border-b-2 border-gray-400 px-2 py-1 dark:border-base-content/10">
      <span class="font-medium">Edit Mode</span>
      <div class="flex items-center gap-2">
        <span class="text-sm font-bold" :class="editMode === 'individual' ? 'text-primary' : 'text-base-content/50'">Individual</span>
        <input
          type="checkbox"
          class="toggle toggle-primary"
          :checked="editMode === 'mass'"
          @change="editMode = editMode === 'individual' ? 'mass' : 'individual'"
        />
        <span class="text-sm font-bold" :class="editMode === 'mass' ? 'text-primary' : 'text-base-content/50'">Mass Edit</span>
      </div>
    </div>
    <div ref="mainSectionContainer" class="flex min-h-0 flex-1 flex-col">
    <div
      v-if="showTopSection"
      class="flex min-h-0 flex-col"
      :style="editMode === 'individual' ? { flexBasis: topSectionHeight + '%' } : undefined"
    >
      <div v-if="editMode === 'individual'" class="flex min-h-0 h-full">
        <div :class="settingsStore.showCaptionDiffList ? 'flex min-h-0 w-[50%] flex-col' : 'flex min-h-0 w-full flex-col'">
          <div class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10">
            <p>Tags detected by autotagger but not in the captions</p>
          </div>
          <div v-if="selectedImages.size === 1" class="mb-2 flex min-h-0 flex-1 flex-wrap gap-2 overflow-auto scroll-smooth pt-2">
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
        <div v-if="settingsStore.showCaptionDiffList" class="flex min-h-0 w-[50%] flex-col">
          <div class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10">
            <p>Tags in captions but not detected by the autotagger</p>
          </div>
          <div v-if="selectedImages.size === 1" class="mb-2 flex min-h-0 flex-1 flex-wrap gap-2 overflow-auto scroll-smooth pt-2">
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
      <div v-else class="flex flex-col gap-2 border-b-2 border-gray-400 p-2 dark:border-base-content/10">
        <div class="text-center font-medium">Replace tags across images</div>
        <div class="flex gap-3">
          <label class="input w-full outline-none!">
            <span class="label">From</span>
            <AutocompletionComponent
              v-model="replaceSourceInput"
              :disabled="!datasetStore.images.size"
              :id="'replace-source-list'"
              :placeholder="'Type the tag to replace...'"
              :multiple="false"
              :custom-list="[...displayedGlobalTags]"
            />
          </label>
          <label class="input w-full outline-none!">
            <span class="label">To</span>
            <AutocompletionComponent
              v-model="replaceTargetInput"
              :disabled="!datasetStore.images.size"
              :id="'replace-target-list'"
              :placeholder="'Type the replacement tag...'"
              :multiple="false"
            />
          </label>
        </div>
        <div class="flex gap-2">
          <button class="btn btn-outline w-[50%]" :disabled="!selectedImages.size" @click="replaceTag('selected')">
            Replace Selected
          </button>
          <button class="btn btn-outline w-[50%]" :disabled="!datasetStore.images.size" @click="replaceTag('all')">
            Replace All
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="showTopSection && editMode === 'individual'"
      class="divider m-0 cursor-ns-resize not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
      @mousedown.prevent="resizeMainSection"
    ></div>
    <div
      class="flex min-h-0 flex-1 flex-col"
    >
      <div v-if="editMode === 'individual'" class="flex min-h-0 h-full flex-col border-gray-400 py-1 dark:border-base-content/10">
        <div class="border-b-2 border-gray-400 pb-3 dark:border-base-content/10">
          <div class="flex w-full gap-2">
            <label class="input gap-0 outline-none! w-full">
              <span class="label">Tag Position</span>
              <input type="text" v-model.trim.number.lazy="tagPosition" @blur="validateTagPosition" />
            </label>
            <div class="tooltip" data-tip="Resets the tag position back to -1">
              <button class="btn btn-outline btn-error" @click="tagPosition = -1">Reset</button>
            </div>
          </div>
          <label class="input w-full mt-2 outline-none!">
            <input v-model="highlightInput" type="text" placeholder="Highlight words..." :disabled="!displayedTags.size" />
          </label>
        </div>
        <div class="mb-2 flex min-h-0 flex-1 flex-wrap gap-2 overflow-auto scroll-smooth pt-1">
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
              <button class="btn btn-circle border-none p-0.5 btn-ghost dark:hover:bg-[#323841]" :disabled="!displayedTags.size" @click="copyTextToClipboard(displayedTags)">
                <CopyIcon class="h-full w-full fill-none" />
              </button>
            </div>
            <label class="input relative w-full pl-1 outline-none!">
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
              <select v-model.lazy="datasetStore.sortMode" class="select relative w-fit outline-none!" :disabled="!displayedTags.size">
                <option value="none" selected>None</option>
                <option value="alphabetical">Alphabetical</option>
              </select>
            </div>
            <button class="btn btn-circle overflow-hidden border-none dark:bg-[#323841]" :disabled="!displayedTags.size" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'">
              <SortArrowIcon
                class="swap-off h-full w-full fill-none transition-[transform] duration-500"
                :class="{
                  'transform-[rotate(180deg)]': sortOrder === 'desc'
                }"
              />
            </button>
          </div>
        </div>
      </div>
      <div v-else class="flex min-h-0 h-full flex-col border-gray-400 pt-3 pb-1 dark:border-base-content/10">
        <div class="flex items-center gap-2 border-b-2 border-gray-400 pb-3 dark:border-base-content/10">
          <label class="input w-full outline-none!">
            <span class="label">Filter Global Tags</span>
            <input v-model="globalTagFilterInput" type="text" placeholder="Type to filter..." :disabled="!datasetStore.globalTags.size" />
          </label>
          <div class="not-focus-within:hover:tooltip" data-tip="Mode to sort the tags">
            <select v-model.lazy="globalSortMode" class="select relative w-fit outline-none!" :disabled="!displayedGlobalTags.size">
              <option value="alphabetical" selected>Alphabetical</option>
              <option value="tag_count">Tag Count</option>
            </select>
          </div>
          <button class="btn btn-circle overflow-hidden border-none dark:bg-[#323841]" :disabled="!displayedGlobalTags.size" @click="globalSortOrder = globalSortOrder === 'asc' ? 'desc' : 'asc'">
            <SortArrowIcon
              class="swap-off h-full w-full fill-none transition-[transform] duration-500"
              :class="{
                'transform-[rotate(180deg)]': globalSortOrder === 'desc'
              }"
            />
          </button>
        </div>
        <div class="mb-2 flex min-h-0 flex-1 flex-wrap gap-2 overflow-auto scroll-smooth pt-1">
          <div
            v-for="tag in displayedGlobalTags"
            :key="tag"
            class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
            @click="removeGlobalTag(tag)"
          >
            {{ settingsStore.showTagCount ? tag + ' | ' + datasetStore.globalTags.get(tag)!.size : tag }}
          </div>
        </div>
        <div class="mt-auto flex flex-col gap-2 border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
          <div class="flex gap-2">
            <label class="input relative w-full pl-1 outline-none!">
              <AutocompletionComponent
                v-model="globalTagInput"
                :disabled="!datasetStore.images.size"
                :id="'global-completion-list'"
                :placeholder="'Type to add a global tag...'"
                :multiple="true"
                @on-complete="addGlobalTag"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
  <div
    class="divider m-0 divider-horizontal cursor-ew-resize not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
    @mousedown.prevent="resizeTagGroupWidth"
  ></div>
  <div class="flex h-full min-h-0 flex-col pt-1 pr-1" :style="{ width: tagGroupWidth + '%' }">
    <div v-if="settingsStore.showTagGroups" class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto pb-1">
      <div class="h-[40%] pb-1">
        <div class="flex gap-2 mb-1">
          <label class="input w-full outline-none!">
            <span class="label">Group Search</span>
            <input v-model="tagGroupFilterInput" type="text" placeholder="Type to seach for a group..." />
          </label>
          <button class="btn btn-outline btn-error" @click="selectedTagGroups.clear()">Close All</button>
        </div>
        <span>Tag Groups</span>
        <div class="flex h-[calc(100%-50px)] flex-wrap content-start gap-2 overflow-auto pb-1">
          <button
            v-for="name in tagGroupsStore.tagGroups.keys()"
            :key="name"
            class="btn text-sm font-normal"
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
            <span class="cursor-pointer border px-1 font-bold hover:text-error" @click="selectedTagGroups.delete(name)">X</span>
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
  </div>
</template>
