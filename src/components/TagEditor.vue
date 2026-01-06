<script setup lang="ts">
import AutocompletionComponent from "@/components/AutocompletionComponent.vue";

import { useDatasetStore } from "@/stores/datasetStore";
import { useTagGroupsStore } from "@/stores/tagGroupsStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTagOperations } from "@/composables/useTagOperations";
import { ref, shallowRef, computed, toRaw } from "vue";

import CopyIcon from "@/assets/icons/copy.svg";
import SortArrowIcon from "@/assets/icons/sort-arrow.svg";

const props = defineProps<{
    selectedImages: Set<string>;
    displayedTags: Set<string>;
    displayedGlobalTags: Set<string>;
    isFiltering: boolean;
    filterInput: string;
}>();

const sortOrder = defineModel<string>("sortOrder", { required: true });
const globalSortMode = defineModel<string>("globalSortMode", { required: true });
const globalSortOrder = defineModel<string>("globalSortOrder", { required: true });
const globalTagFilterInput = defineModel<string>("globalTagFilterInput", { required: true });

const tagInput = ref("");
const globalTagInput = ref("");
const editMode = ref<"individual" | "mass">("individual");
const tagPosition = ref(-1);
const highlightInput = ref("");
const selectedTagGroups = ref<Set<string>>(new Set());
const tagGroupFilterInput = ref("");
const replaceSourceInput = ref("");
const replaceTargetInput = ref("");
const mainSectionContainer = shallowRef<HTMLDivElement | null>(null);
const topSectionHeight = ref(50);
const tagGroupWidth = ref(30);
const areTagsCopied = ref(false);
const draggingTag = ref<string | null>(null);
const dropIndex = ref<number | null>(null);

const highlightRegexes = computed(() =>
    highlightInput.value
        .split(",")
        .map((word) => word.trim())
        .filter(Boolean)
        .map((word) => new RegExp(`(^|[^\\p{L}])${escapeRegExp(word)}([^\\p{L}]|$)`, "iu"))
);

const selectedImageId = computed(() => {
    const iterator = props.selectedImages.values().next();
    return iterator.done ? null : iterator.value;
});

const hasSingleSelection = computed(() => props.selectedImages.size === 1);

const filterTagsSet = computed(() => new Set(
    props.filterInput.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)
));

const highlightSet = computed(() => {
    const tagsSet = new Set<string>();
    if (highlightRegexes.value.length === 0)
        return tagsSet;

    for (const tag of props.displayedTags) {
        if (highlightRegexes.value.some((regex) => regex.test(tag)))
            tagsSet.add(tag);
    }

    return tagsSet;
});

const tagGroupsList = computed(() => {
    void tagGroupsStore.dataVersion;

    return Array.from(tagGroupsStore.tagGroups.entries());
});

const filteredTagGroups = computed(() => {
    const query = tagGroupFilterInput.value.trim().toLowerCase();
    if (!query)
        return tagGroupsList.value;

    return tagGroupsList.value.filter(([name]) => name.toLowerCase().includes(query));
});

const displayedTagsList = computed(() => {
    const list = Array.from(props.displayedTags);
    if (draggingTag.value)
        return list.filter(t => t !== draggingTag.value);

    return list;
});

const displayedGlobalTagsList = computed(() => Array.from(props.displayedGlobalTags));

const groupsWithMatches = computed(() => {
    void tagGroupsStore.dataVersion;

    const matches = new Set<string>();
    for (const [name, tags] of tagGroupsStore.tagGroups) {
        for (const tag of tags) {
            if (props.displayedTags.has(tag)) {
                matches.add(name);
                break;
            }
        }
    }

    return matches;
});

const isDraggable = computed(() => editMode.value === "individual" && hasSingleSelection.value);

const datasetStore = useDatasetStore();
const tagGroupsStore = useTagGroupsStore();
const settingsStore = useSettingsStore();
const tagOperations = useTagOperations();

const tagEditorMainWidth = computed(() => 70 - tagGroupWidth.value);
const showTopSection = computed(() =>
    editMode.value === "mass" ? true : settingsStore.showDiffSection
);

function escapeRegExp(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function resizeMainSection(moveEvent: MouseEvent) {
    const startY = moveEvent.clientY;
    const containerHeight = mainSectionContainer.value?.getBoundingClientRect().height || 0;
    const startTopHeight = topSectionHeight.value;

    function onMouseMove(event: MouseEvent) {
        if (!containerHeight)
            return;

        const delta = event.clientY - startY;
        const deltaPercent = (delta / containerHeight) * 100;
        topSectionHeight.value = clamp(startTopHeight + deltaPercent, 25, 70);
    }

    function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
}

function resizeTagGroupWidth(moveEvent: MouseEvent) {
    const startX = moveEvent.clientX;
    const divider = moveEvent.currentTarget as HTMLElement | null;
    const parentWidth = divider?.parentElement?.getBoundingClientRect().width || 0;
    const startWidthPx = (tagGroupWidth.value / 100) * parentWidth;

    function onMouseMove(event: MouseEvent) {
        if (!parentWidth)
            return;

        const delta = event.clientX - startX;
        const newWidthPx = startWidthPx - delta;
        const newWidthPercent = (newWidthPx / parentWidth) * 100;
        tagGroupWidth.value = clamp(newWidthPercent, 24, 34);
    }

    function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
}

function addTag(tag?: string, imageId?: string) {
    const newTag = tag || tagInput.value;
    if (!newTag)
        return;

    const imageIds = imageId ? new Set([imageId]) : new Set(props.selectedImages);
    const position = editMode.value === "mass" ? tagOperations.validateTagPosition(tagPosition.value) : -1;

    tagOperations.addTag(newTag, imageIds, position);
    tagInput.value = "";
}

function addGlobalTag() {
    if (!globalTagInput.value)
        return;

    const position = editMode.value === "mass" ? tagOperations.validateTagPosition(tagPosition.value) : -1;

    tagOperations.addGlobalTag(globalTagInput.value, position);
    globalTagInput.value = "";
}

function removeTag(tag: string, imageId?: string) {
    const images = imageId ? new Set([imageId]) : new Set(props.selectedImages);
    tagOperations.removeTag(tag, images);
}

function removeGlobalTag(tag: string) {
    tagOperations.removeGlobalTag(tag);
}

function addOrRemoveTag(tag: string) {
    const toAdd = new Set<string>();
    const toRemove = new Set<string>();

    const rawDataset = toRaw(datasetStore.dataset);

    for (const imageId of props.selectedImages.values()) {
        if (rawDataset.get(imageId)?.tags.has(tag)) {
            toRemove.add(imageId);
        } else {
            toAdd.add(imageId);
        }
    }

    const position = editMode.value === "mass" ? tagOperations.validateTagPosition(tagPosition.value) : -1;

    if (toRemove.size > 0)
        tagOperations.removeTag(tag, toRemove);
    if (toAdd.size > 0)
        tagOperations.addTag(tag, toAdd, position);
}

function copyTextToClipboard(tags: Set<string>) {
    navigator.clipboard.writeText([...tags].join(", "));
    areTagsCopied.value = true;

    setTimeout(() => {
        areTagsCopied.value = false;
    }, 1000);
}

function validateTagPosition() {
    tagPosition.value = tagOperations.validateTagPosition(tagPosition.value);
}

function handleTagGroupChange(tagGroup: string) {
    if (selectedTagGroups.value.has(tagGroup))
        selectedTagGroups.value.delete(tagGroup);
    else
        selectedTagGroups.value.add(tagGroup);
}

function replaceTag(mode: "selected" | "all") {
    const originalTag = replaceSourceInput.value.trim();
    const tag = replaceTargetInput.value.trim();
    if (!tag || !originalTag || tag === originalTag)
        return;

    const rawDataset = toRaw(datasetStore.dataset);

    const images = mode === "selected" ? new Set(props.selectedImages) : new Set(rawDataset.keys());
    tagOperations.replaceTag(originalTag, tag, images);

    replaceSourceInput.value = "";
    replaceTargetInput.value = "";
}

function onTagListDragOver(event: DragEvent) {
    if (!isDraggable.value)
        return;

    if (event.dataTransfer)
        event.dataTransfer.dropEffect = "move";
}

function onTagListDrop() {
    onTagDrop();
}

function onTagDragStart(tag: string, event: DragEvent) {
    if (event.dataTransfer && event.target instanceof HTMLElement) {
        const chip = event.target.closest(".h-fit.w-fit");
        if (chip)
            event.dataTransfer.setDragImage(chip, 0, 0);

        event.dataTransfer.setData("text/plain", tag);
        event.dataTransfer.effectAllowed = "move";
    }

    requestAnimationFrame(() => {
        draggingTag.value = tag;
        dropIndex.value = null;
    });
}

function onTagDragEnd() {
    draggingTag.value = null;
    dropIndex.value = null;
}

function setDropIndex(event: DragEvent, tag: string, index: number) {
    if (!isDraggable.value || draggingTag.value === tag)
        return;

    const element = event.currentTarget as HTMLElement;
    const bounds = element.getBoundingClientRect();
    const after = event.clientX >= bounds.left + bounds.width / 2;

    const nextIndex = after ? index + 1 : index;
    if (nextIndex !== dropIndex.value)
        dropIndex.value = nextIndex;
}

function setDropIndexToEnd() {
    if (!isDraggable.value)
        return;

    dropIndex.value = displayedTagsList.value.length;
}

function onTagDrop() {
    if (!isDraggable.value || !draggingTag.value || !selectedImageId.value || dropIndex.value === null)
        return;

    tagOperations.reorderTag(selectedImageId.value, draggingTag.value, dropIndex.value);
    draggingTag.value = null;
    dropIndex.value = null;
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
                        <div v-if="hasSingleSelection" class="mb-2 flex min-h-0 flex-1 flex-wrap gap-2 overflow-auto scroll-smooth pt-2">
                            <div
                                v-for="tag in datasetStore.tagDiff.get(selectedImageId!)?.tagger"
                                :key="tag"
                                class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer dark:bg-gray-700"
                                @click="addTag(tag, selectedImageId!)"
                            >
                                {{ tag }}
                            </div>
                        </div>
                    </div>
                    <div
                        v-if="settingsStore.showCaptionDiffList"
                        class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
                    ></div>
                    <div v-if="settingsStore.showCaptionDiffList" class="flex min-h-0 w-[50%] flex-col">
                        <div class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10">
                            <p>Tags in captions but not detected by the autotagger</p>
                        </div>
                        <div v-if="hasSingleSelection" class="mb-2 flex min-h-0 flex-1 flex-wrap gap-2 overflow-auto scroll-smooth pt-2">
                            <div
                                v-for="tag in datasetStore.tagDiff.get(selectedImageId!)?.original"
                                :key="tag"
                                class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer dark:bg-rose-900"
                                @click="removeTag(tag, selectedImageId!)"
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
                                :disabled="datasetStore.dataset.size === 0"
                                :id="'replace-source-list'"
                                :placeholder="'Type the tag to replace...'"
                                :multiple="false"
                                :custom-list="displayedGlobalTagsList"
                            />
                        </label>
                        <label class="input w-full outline-none!">
                            <span class="label">To</span>
                            <AutocompletionComponent
                                v-model="replaceTargetInput"
                                :disabled="datasetStore.dataset.size === 0"
                                :id="'replace-target-list'"
                                :placeholder="'Type the replacement tag...'"
                                :multiple="false"
                            />
                        </label>
                    </div>
                    <div class="flex gap-2">
                        <button class="btn btn-outline w-[50%]" :disabled="selectedImages.size === 0" @click="replaceTag('selected')">
                            Replace Selected
                        </button>
                        <button class="btn btn-outline w-[50%]" :disabled="datasetStore.dataset.size === 0" @click="replaceTag('all')">
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
            <div class="flex min-h-0 flex-1 flex-col">
                <div v-if="editMode === 'individual'" class="flex min-h-0 h-full flex-col border-gray-400 py-1 dark:border-base-content/10">
                    <div class="border-b-2 border-gray-400 pb-3 dark:border-base-content/10">
                        <label class="input w-full outline-none!">
                            <input v-model="highlightInput" type="text" placeholder="Highlight words..." :disabled="displayedTagsList.length === 0" />
                        </label>
                    </div>
                    <div
                        class="mb-2 flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-auto scroll-smooth pt-1"
                        data-role="tag-list"
                        @dragover.prevent="onTagListDragOver($event)"
                        @drop.prevent="onTagListDrop"
                    >
                        <template v-for="(tag, index) in displayedTagsList" :key="tag">
                            <div
                                v-if="draggingTag && dropIndex === index"
                                class="h-fit w-fit rounded px-1.5 border border-success text-success bg-success/20 pointer-events-none"
                            >
                                {{ draggingTag }}
                            </div>
                            <div
                                class="h-fit w-fit bg-[#a6d9e2] px-1.5 hover:cursor-pointer dark:bg-gray-700"
                                :class="{
                                    'dark:bg-warning/50': (isFiltering && filterTagsSet.has(tag.toLowerCase())) || highlightSet.has(tag),
                                    'hover:bg-rose-900': !draggingTag
                                }"
                                @dragover.stop.prevent="setDropIndex($event, tag, index)"
                                @drop.stop.prevent="onTagDrop"
                                @click="removeTag(tag)"
                            >
                                <span
                                    v-show="isDraggable"
                                    class="cursor-grab select-none opacity-70 pr-2"
                                    draggable="true"
                                    @mousedown.stop
                                    @click.stop
                                    @dragstart="onTagDragStart(tag, $event)"
                                    @dragend="onTagDragEnd"
                                >⋮⋮</span>
                                <span>{{ tag }}</span>
                            </div>
                        </template>
                        <div
                            v-if="draggingTag && dropIndex === displayedTagsList.length"
                            class="h-fit w-fit rounded px-1.5 border border-success text-success bg-success/20 pointer-events-none"
                        >
                            {{ draggingTag }}
                        </div>
                        <div
                            class="h-6 w-full"
                            @dragenter.prevent="setDropIndexToEnd"
                            @dragover.prevent="setDropIndexToEnd"
                            @drop.prevent="onTagDrop">
                        </div>
                    </div>
                    <div class="mt-auto flex flex-col gap-2 border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
                        <div class="flex gap-2">
                            <div class="tooltip" :class="{ 'tooltip-success': areTagsCopied }" :data-tip="areTagsCopied ? 'Tags copied!' : 'Click to copy the tags'">
                                <button class="btn btn-circle border-none p-0.5 btn-ghost dark:hover:bg-[#323841]" :disabled="displayedTagsList.length === 0" @click="copyTextToClipboard(displayedTags)">
                                    <CopyIcon class="h-full w-full fill-none" />
                                </button>
                            </div>
                            <label class="input relative w-full pl-1 outline-none!">
                                <AutocompletionComponent
                                    v-model="tagInput"
                                    :disabled="selectedImages.size === 0"
                                    :id="'completion-list'"
                                    :placeholder="'Type to add a tag...'"
                                    :multiple="true"
                                    @on-complete="addTag()"
                                />
                            </label>
                            <div class="not-focus-within:hover:tooltip" data-tip="Mode to sort the tags">
                                <select v-model.lazy="datasetStore.sortMode" class="select relative w-fit outline-none!" :disabled="displayedTagsList.length === 0">
                                    <option value="none" selected>None</option>
                                    <option value="alphabetical">Alphabetical</option>
                                </select>
                            </div>
                            <button class="btn btn-circle overflow-hidden border-none dark:bg-[#323841]" :disabled="displayedTagsList.length === 0" @click="sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'">
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
                    <div class="flex items-center gap-2 pb-3">
                        <label class="input w-full outline-none!">
                            <span class="label">Filter Global Tags</span>
                            <input v-model="globalTagFilterInput" type="text" placeholder="Type to filter..." :disabled="datasetStore.globalTags.size === 0" />
                        </label>
                        <div class="not-focus-within:hover:tooltip" data-tip="Mode to sort the tags">
                            <select v-model.lazy="globalSortMode" class="select relative w-fit outline-none!" :disabled="displayedGlobalTagsList.length === 0">
                                <option value="alphabetical" selected>Alphabetical</option>
                                <option value="tag_count">Tag Count</option>
                            </select>
                        </div>
                        <button class="btn btn-circle overflow-hidden border-none dark:bg-[#323841]" :disabled="displayedGlobalTagsList.length === 0" @click="globalSortOrder = globalSortOrder === 'asc' ? 'desc' : 'asc'">
                            <SortArrowIcon
                                class="swap-off h-full w-full fill-none transition-[transform] duration-500"
                                :class="{
                                    'transform-[rotate(180deg)]': globalSortOrder === 'desc'
                                }"
                            />
                        </button>
                    </div>
                    <div class="flex w-full gap-2 pb-3 border-b-2 border-gray-400 dark:border-base-content/10">
                        <label class="input gap-0 outline-none! w-full">
                            <span class="label">Tag Position</span>
                            <input type="text" v-model.trim.number.lazy="tagPosition" @blur="validateTagPosition" />
                        </label>
                        <div class="tooltip" data-tip="Resets the tag position back to -1">
                            <button class="btn btn-outline btn-error" @click="tagPosition = -1">Reset</button>
                        </div>
                    </div>
                    <div class="mb-2 flex min-h-0 flex-1 flex-wrap content-start gap-2 overflow-auto scroll-smooth pt-1">
                        <div
                            v-for="tag in displayedGlobalTagsList"
                            :key="tag"
                            class="h-fit w-fit bg-[#a6d9e2] px-1.5 hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
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
                                    :disabled="datasetStore.dataset.size === 0"
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
            <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                    <input
                        class="input w-full outline-none!"
                        v-model="tagGroupFilterInput"
                        :disabled="tagGroupsStore.tagGroups.size === 0"
                        placeholder="Search groups..."
                    />
                    <button
                        class="btn btn-outline"
                        :disabled="tagGroupsStore.tagGroups.size === 0"
                        @click="selectedTagGroups = new Set()"
                    >
                        Collapse All
                    </button>
                </div>
                <div class="text-sm uppercase text-base-content/60">Tag Groups</div>
                <div class="flex flex-col gap-2 overflow-auto">
                    <div
                        v-for="[name, tags] in filteredTagGroups"
                        :key="name"
                        class="collapse collapse-arrow rounded-box border border-base-content/30 bg-base-200/40"
                        :class="{ 'collapse-open': selectedTagGroups.has(name) }"
                    >
                        <div class="collapse-title flex items-center pr-6" @click="handleTagGroupChange(name)">
                            <span
                                class="truncate"
                                :class="{ 'border border-accent px-2': groupsWithMatches.has(name) }"
                            >
                                {{ name }}
                            </span>
                            <span class="px-2 rounded-full bg-info text-info-content font-semibold tabular-nums border border-info ml-3">
                                {{ tagGroupsStore.tagGroups.get(name)?.size ?? 0 }}
                            </span>
                        </div>
                        <div v-if="selectedTagGroups.has(name)" class="collapse-content">
                            <div class="flex flex-wrap gap-2">
                                <div
                                    v-for="tag in tags"
                                    :key="tag"
                                    class="h-fit w-fit px-1.5 hover:cursor-pointer"
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
        </div>
    </div>
</template>
