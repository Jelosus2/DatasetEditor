<script setup lang="ts">
import ExpandCollapseAllButton from "@/components/ExpandCollapseAllButton.vue";
import AutocompletionInput from "@/components/AutocompletionInput.vue";
import EditableTagChip from "@/components/EditableTagChip.vue";

import { useTagGroupsOperations } from "@/composables/useTagGroupsOperations";
import { useTagGroupsStore } from "@/stores/tagGroupsStore";
import { ref, computed } from "vue";

import ExportIcon from "@/assets/icons/export.svg";
import ImportIcon from "@/assets/icons/import.svg";
import HandleIcon from "@/assets/icons/handle.svg";

const selectedGroup = ref("");
const groupNameInput = ref("");
const groupTags = ref("");
const tagInput = ref("");
const renameInput = ref("");
const tagGroupSearch = ref("");
const importGroupSearch = ref("");
const expandedGroups = ref<Set<string>>(new Set());
const importExpandedGroups = ref<Set<string>>(new Set());
const draggingGroupTag = ref<string | null>(null);
const groupTagDropIndex = ref<number | null>(null);

const tagGroupsOperations = useTagGroupsOperations();
const tagGroupsStore = useTagGroupsStore();

const importedGroups = computed(() => tagGroupsStore.importedGroups);

const tagGroupsList = computed(() => {
    void tagGroupsStore.dataVersion;

    return Array.from(tagGroupsStore.tagGroups.entries());
});

const tagGroupNames = computed(() => tagGroupsList.value.map(([name]) => name));
const importedGroupsList = computed(() => Array.from(importedGroups.value.entries()));
const importedGroupNames = computed(() => importedGroupsList.value.map(([name]) => name));

const selectedGroupTags = computed(() => {
    void tagGroupsStore.dataVersion;

    const tags = Array.from(tagGroupsStore.tagGroups.get(selectedGroup.value) ?? []);

    if (!draggingGroupTag.value)
        return tags;

    return tags.filter((tag) => tag !== draggingGroupTag.value);
});

const filteredTagGroups = computed(() => {
    const parts = parseFilterInput(tagGroupSearch.value);
    if (parts.length === 0)
        return tagGroupsList.value;

    return tagGroupsList.value.filter(([name]) => filterMatchesAny(name, parts));
});

const filteredImportedGroups = computed(() => {
    const parts = parseFilterInput(importGroupSearch.value)
    if (parts.length === 0)
        return importedGroupsList.value;

    return importedGroupsList.value.filter(([name]) => filterMatchesAny(name, parts));
});

const canReorderSelectedGroupTags = computed(() => {
    if (!selectedGroup.value)
        return false;

    return (tagGroupsStore.tagGroups.get(selectedGroup.value)?.size ?? 0) > 1;
});

function createGroup() {
    if (!groupNameInput.value)
        return;

    const noLineBreaks = groupTags.value.split("\n").join("");
    tagGroupsOperations.addGroup(groupNameInput.value, noLineBreaks);

    groupNameInput.value = "";
    groupTags.value = "";
}

function deleteGroup(mode: "selected" | "all") {
    if (mode === "selected")
        tagGroupsOperations.removeGroup(selectedGroup.value);
    else
        tagGroupsOperations.clearGroups();

    selectedGroup.value = "";
    renameInput.value = "";
}

async function saveTagGroups() {
    await tagGroupsStore.saveTagGroups();
}

function addTag() {
    tagGroupsOperations.addTag(selectedGroup.value, tagInput.value);

    tagInput.value = "";
}

function removeTag(tag: string, group?: string) {
    tagGroupsOperations.removeTag(group || selectedGroup.value, tag);
}

async function importTagGroups() {
    await tagGroupsOperations.importTagGroups();
}

async function exportGroupToJSON(mode: "one" | "all") {
    if (mode === "one" && !selectedGroup.value)
        return;

    await tagGroupsOperations.exportTagGroups(mode === "one" ? selectedGroup.value : undefined);
}

function addImportedGroupsToCurrent(override: boolean) {
    tagGroupsOperations.mergeTagGroups(importedGroups.value, override);

    clearImports();
}

function renameTagGroup() {
    const newName = renameInput.value.trim();
    const renamed = tagGroupsOperations.renameGroup(selectedGroup.value, newName);

    if (renamed)
        selectedGroup.value = newName;
    renameInput.value = "";
}

function handleGroupHeaderClick(name: string) {
    if (selectedGroup.value !== name) {
        selectedGroup.value = name;
        expandedGroups.value.add(name);
        renameInput.value = name;

        return;
    }

    toggleGroupExpand(name);
}

function toggleGroupExpand(name: string) {
    if (expandedGroups.value.has(name))
        expandedGroups.value.delete(name);
    else
        expandedGroups.value.add(name);
}

function toggleImportedGroup(name: string) {
    if (importExpandedGroups.value.has(name))
        importExpandedGroups.value.delete(name);
    else
        importExpandedGroups.value.add(name);
}

function clearImports() {
    tagGroupsStore.clearImportedGroups();
    importExpandedGroups.value = new Set();
    importGroupSearch.value = "";
}

function parseFilterInput(input: string) {
    return input
        .split(",")
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean);
}

function filterMatchesAny(name: string, parts: string[]) {
    const lower = name.toLowerCase();
    return parts.some((part) => lower.includes(part));
}

function onGroupTagListDragOver(event: DragEvent) {
    if (!canReorderSelectedGroupTags.value)
        return;

    if (event.dataTransfer)
        event.dataTransfer.dropEffect = "move";
}

function onGroupTagDragStart(tag: string, event: DragEvent) {
    if (!canReorderSelectedGroupTags.value)
        return;

    if (event.dataTransfer && event.currentTarget instanceof HTMLElement) {
        const chip = event.currentTarget.closest("[data-role='group-tag-chip']");

        if (chip instanceof HTMLElement)
            event.dataTransfer.setDragImage(chip, 0, 0);

        event.dataTransfer.setData("text/plain", tag);
        event.dataTransfer.effectAllowed = "move";
    }

    requestAnimationFrame(() => {
        draggingGroupTag.value = tag;
        groupTagDropIndex.value = null;
    });
}

function onGroupTagDragEnd() {
    draggingGroupTag.value = null;
    groupTagDropIndex.value = null;
}

function setGroupTagDropIndex(event: DragEvent, tag: string, index: number) {
    if (!canReorderSelectedGroupTags.value || draggingGroupTag.value === tag)
        return;

    const element = event.currentTarget;
    if (!(element instanceof HTMLElement))
        return;

    const bounds = element.getBoundingClientRect();
    const after = event.clientX >= bounds.left + bounds.width / 2;
    const nextIndex = after ? index + 1 : index;

    if (nextIndex !== groupTagDropIndex.value)
        groupTagDropIndex.value = nextIndex;
}

function setGroupTagDropIndexToEnd() {
    if (!canReorderSelectedGroupTags.value)
        return;

    groupTagDropIndex.value = selectedGroupTags.value.length;
}

function onGroupTagDrop() {
    if (!canReorderSelectedGroupTags.value || !selectedGroup.value || !draggingGroupTag.value || groupTagDropIndex.value === null)
        return;

    tagGroupsOperations.reorderTag(selectedGroup.value, draggingGroupTag.value, groupTagDropIndex.value);

    draggingGroupTag.value = null;
    groupTagDropIndex.value = null;
}

function renameSelectedGroupTag(originalTag: string, newTag: string) {
    if (!selectedGroup.value)
        return;

    tagGroupsOperations.renameTag(selectedGroup.value, originalTag, newTag);
}
</script>

<template>
    <div class="tab-content min-h-0 border-t-base-300 bg-base-100">
        <div class="flex h-full">
            <div class="flex w-[25%] flex-col gap-2 overflow-auto pt-1 pl-1">
                <div class="flex items-center gap-2 mt-2">
                    <label class="input z-2 w-full outline-none!">
                        <AutocompletionInput
                            v-model="tagGroupSearch"
                            placeholder="Search groups... (comma separated)"
                            :disabled="tagGroupsStore.tagGroups.size === 0"
                            :custom-list="tagGroupNames"
                            :multiple="true"
                            :contains-mode="true"
                            :dropdown-below="true"
                        />
                    </label>
                    <ExpandCollapseAllButton v-model="expandedGroups" :item-names="tagGroupNames" />
                </div>
                <div class="divider m-0"></div>
                <div
                    v-for="[name, tags] in filteredTagGroups"
                    :key="name"
                    class="collapse shrink-0 rounded-none border bg-base-100"
                    :class="{
                        'collapse-open': expandedGroups.has(name),
                        'border-primary': selectedGroup === name,
                        'border-base-content/30': selectedGroup !== name
                    }"
                >
                    <div class="collapse-title pr-4 text-center font-semibold break-all" @click="handleGroupHeaderClick(name)">
                        {{ name }}
                    </div>
                    <div v-if="expandedGroups.has(name)" class="collapse-content flex flex-wrap gap-2 overflow-auto scroll-smooth">
                        <div
                            v-for="tag in tags"
                            :key="tag"
                            class="h-fit w-fit bg-[#a6d9e2] px-1.5 hover:cursor-pointer hover:bg-red-300 dark:hover:bg-rose-900 dark:bg-gray-700"
                            @click="removeTag(tag, name)"
                        >
                            {{ tag }}
                        </div>
                    </div>
                </div>
            </div>
            <div class="flex flex-1 py-1">
                <div class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"></div>
                <div class="w-[65%]">
                    <div class="flex h-[50%]">
                        <div class="flex w-[50%] flex-col gap-2 pb-2">
                            <div class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10">
                                <p>Edit tag group</p>
                            </div>
                            <label class="input w-full px-2 outline-none!">
                                <span class="label">Rename Group</span>
                                <input
                                    v-model="renameInput"
                                    type="text"
                                    placeholder="New name for the tag group..."
                                    :disabled="!selectedGroup"
                                    @keyup.enter="renameTagGroup"
                                />
                            </label>
                            <button
                                class="btn btn-outline btn-info"
                                :disabled="!selectedGroup"
                                @click="exportGroupToJSON('one')"
                            >
                                <ExportIcon class="h-5 w-5 fill-none" />
                                Export This Group to JSON
                            </button>
                            <button
                                class="btn btn-outline btn-info"
                                :disabled="tagGroupsStore.tagGroups.size === 0"
                                @click="exportGroupToJSON('all')"
                            >
                                <ExportIcon class="h-5 w-5 fill-none" />
                                Export All Groups to JSON
                            </button>
                            <button
                                class="btn btn-outline btn-error"
                                :disabled="!selectedGroup"
                                @click="deleteGroup('selected')"
                            >
                                Delete This Group
                            </button>
                            <button
                                class="btn btn-outline btn-error"
                                type="button"
                                :disabled="tagGroupsStore.tagGroups.size === 0"
                                @click="deleteGroup('all')"
                            >
                                Delete All Groups
                            </button>
                            <button
                                class="btn btn-outline btn-success"
                                type="button"
                                @click="saveTagGroups"
                            >
                                Save Tag Groups
                            </button>
                        </div>
                        <div class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"></div>
                        <div class="flex w-[50%] flex-col gap-2 pb-2">
                            <div class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10">
                                <p>Create tag group</p>
                            </div>
                            <label class="input w-full px-2 outline-none!">
                                <span class="label">Group Name</span>
                                <input
                                    v-model.trim="groupNameInput"
                                    type="text"
                                    placeholder="Name for the tag group..."
                                    @keyup.enter="createGroup"
                                />
                            </label>
                            <div class="relative flex-1">
                                <AutocompletionInput
                                    v-model="groupTags"
                                    class="textarea w-full h-full resize-none outline-none!"
                                    placeholder="Tags separated by comma to be added to the group..."
                                    :textarea="true"
                                    :multiple="true"
                                    :dropdown-below="true"
                                    :key-enter-empty="true"
                                    @on-complete="createGroup"
                                />
                            </div>
                            <button
                                class="btn btn-outline btn-success"
                                :disabled="!groupNameInput || tagGroupsStore.tagGroups.has(groupNameInput)"
                                @click="createGroup"
                            >
                                Create Group
                            </button>
                        </div>
                    </div>
                    <div class="flex h-[50%] flex-col border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
                        <div
                            class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth"
                            data-role="group-tag-list"
                            @dragover.prevent="onGroupTagListDragOver"
                            @drop.prevent="onGroupTagDrop"
                        >
                            <template v-for="(tag, index) in selectedGroupTags" :key="tag">
                                <div
                                    v-if="draggingGroupTag && groupTagDropIndex === index"
                                    class="pointer-events-none h-fit w-fit rounded border border-success bg-success/20 px-1.5 text-success"
                                >
                                    {{ draggingGroupTag }}
                                </div>
                                <EditableTagChip
                                    :tag="tag"
                                    data-role="group-tag-chip"
                                    class="h-fit w-fit bg-[#a6d9e2] px-1.5 hover:cursor-pointer hover:bg-red-300 dark:bg-gray-700 dark:hover:bg-rose-900"
                                    @commit="renameSelectedGroupTag(tag, $event)"
                                    @remove="removeTag(tag)"
                                    @dragover.stop.prevent="setGroupTagDropIndex($event, tag, index)"
                                    @drop.stop.prevent="onGroupTagDrop"
                                >
                                    <template #prefix="{ editing }">
                                        <span
                                            v-if="canReorderSelectedGroupTags"
                                            class="cursor-grab select-none pr-2"
                                            :class="{
                                                'opacity-70': !editing,
                                                'pointer-events-none opacity-0': editing
                                            }"
                                            draggable="true"
                                            @mousedown.stop
                                            @click.stop
                                            @dragstart="onGroupTagDragStart(tag, $event)"
                                            @dragend="onGroupTagDragEnd"
                                        >
                                            <HandleIcon />
                                        </span>
                                    </template>
                                </EditableTagChip>
                            </template>
                            <div
                                v-if="draggingGroupTag && groupTagDropIndex === selectedGroupTags.length"
                                class="pointer-events-none h-fit w-fit rounded border border-success bg-success/20 px-1.5 text-success"
                            >
                                {{ draggingGroupTag }}
                            </div>
                            <div
                                v-if="canReorderSelectedGroupTags"
                                class="h-6 w-full"
                                @dragenter.prevent="setGroupTagDropIndexToEnd"
                                @dragover.prevent="setGroupTagDropIndexToEnd"
                                @drop.prevent="onGroupTagDrop"
                            ></div>
                        </div>
                        <div class="mt-auto border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
                            <label class="input w-full px-1 outline-none!">
                                <AutocompletionInput
                                    v-model="tagInput"
                                    placeholder="Type to add tags to the current group..."
                                    :disabled="!selectedGroup"
                                    :multiple="true"
                                    @on-complete="addTag"
                                />
                            </label>
                        </div>
                    </div>
                </div>
                <div class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"></div>
                <div class="w-[35%] pr-1">
                    <div class="flex h-[30%]">
                        <div class="flex w-full flex-col gap-2">
                            <div class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10">
                                <p>Import tag groups</p>
                            </div>
                            <button class="btn btn-outline btn-info" @click="importTagGroups">
                                <ImportIcon class="h-5 w-5 fill-none" />
                                Import Groups from JSON File
                            </button>
                            <button
                                class="btn btn-outline btn-success"
                                :disabled="importedGroups.size === 0"
                                @click="addImportedGroupsToCurrent(false)"
                            >
                                Add to Current Groups
                            </button>
                            <button
                                class="btn btn-outline btn-error"
                                :disabled="importedGroups.size === 0"
                                @click="addImportedGroupsToCurrent(true)"
                            >
                                Override Current Groups
                            </button>
                            <button
                                class="btn btn-outline btn-error"
                                :disabled="importedGroups.size === 0"
                                @click="clearImports"
                            >
                                Clear Imports
                            </button>
                        </div>
                    </div>
                    <div class="flex h-[70%] w-full flex-col gap-2">
                        <div class="flex items-center justify-center border-y-2 border-gray-400 text-center dark:border-base-content/10 mb-2">
                            <p>Import Preview</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <label class="input z-2 w-full outline-none!">
                                <AutocompletionInput
                                    v-model="importGroupSearch"
                                    placeholder="Search imported groups... (comma separated)"
                                    :disabled="importedGroups.size === 0"
                                    :custom-list="importedGroupNames"
                                    :multiple="true"
                                    :contains-mode="true"
                                    :dropdown-below="true"
                                />
                            </label>
                            <ExpandCollapseAllButton v-model="importExpandedGroups" :item-names="importedGroupNames" />
                        </div>
                        <div class="divider m-0"></div>
                        <div class="flex flex-col gap-2 overflow-auto">
                            <div
                                v-for="[name, tags] in filteredImportedGroups"
                                :key="name"
                                class="collapse shrink-0 rounded-none border border-base-content/30 bg-base-100"
                                :class="{ 'collapse-open': importExpandedGroups.has(name) }"
                            >
                                <div class="collapse-title pr-4 text-center font-semibold break-all cursor-pointer" @click="toggleImportedGroup(name)">
                                    {{ name }}
                                </div>
                                <div v-if="importExpandedGroups.has(name)" class="collapse-content flex flex-wrap gap-2 overflow-auto scroll-smooth">
                                    <div
                                        v-for="tag in tags"
                                        :key="tag"
                                        class="h-fit w-fit bg-[#a6d9e2] px-1.5 dark:bg-gray-700"
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
    </div>
</template>
