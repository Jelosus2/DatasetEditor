<script setup lang="ts">
import AutocompletionComponent from "@/components/AutocompletionComponent.vue";

import type { TagGroups } from "../../shared/tag-groups";

import { useTagGroupsOperations } from "@/composables/useTagGroupsOperations";
import { useTagGroupsStore } from "@/stores/tagGroupsStore";
import { ref, computed } from "vue";

import ExportIcon from "@/assets/icons/export.svg";
import ImportIcon from "@/assets/icons/import.svg";

const selectedGroup = ref("");
const groupNameInput = ref("");
const groupTags = ref("");
const tagInput = ref("");
const importedGroups = ref<TagGroups>(new Map());

const tagGroupsOperations = useTagGroupsOperations();
const tagGroupsStore = useTagGroupsStore();

const tagGroupsList = computed(() => {
    void tagGroupsStore.dataVersion;

    return Array.from(tagGroupsStore.tagGroups.entries());
});

const tagGroupNames = computed(() => {
    void tagGroupsStore.dataVersion;

    return Array.from(tagGroupsStore.tagGroups.keys());
})

const selectedGroupTags = computed(() => {
    void tagGroupsStore.dataVersion;

    return Array.from(tagGroupsStore.tagGroups.get(selectedGroup.value) ?? []);
})

function createGroup() {
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
}

function addTag() {
    tagGroupsOperations.addTag(selectedGroup.value, tagInput.value);

    tagInput.value = "";
}

function removeTag(tag: string, group?: string) {
    tagGroupsOperations.removeTag(group || selectedGroup.value, tag);
}

async function importTagGroups() {
    const result = await tagGroupsOperations.importTagGroups();
    if (!result)
        return;

    importedGroups.value = result;
}

async function exportGroupToJSON(mode: "one" | "all") {
    if (mode === "one" && !selectedGroup.value)
        return;

    await tagGroupsOperations.exportTagGroups(mode === "one" ? selectedGroup.value : undefined);
}

function addImportedGroupsToCurrent(override: boolean) {
    tagGroupsOperations.mergeTagGroups(importedGroups.value, override);

    importedGroups.value.clear();
}

function renameTagGroup(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement;
    const newName = target.value?.trim();

    const renamed = tagGroupsOperations.renameGroup(selectedGroup.value, newName);

    if (renamed)
        selectedGroup.value = newName;
    target.value = "";
}
</script>

<template>
    <div class="tab-content min-h-0 border-t-base-300 bg-base-100">
        <div class="flex h-full">
            <div class="flex w-[25%] flex-col gap-2 overflow-auto pt-1 pl-1">
                <div
                    v-for="[name, tags] in tagGroupsList"
                    v-memo="[name, tags.size]"
                    :key="name"
                    class="collapse shrink-0 rounded-none border border-base-300 bg-base-100"
                >
                    <input type="checkbox" />
                    <div class="collapse-title pr-4 text-center font-semibold break-all">
                        {{ name }}
                    </div>
                    <div class="collapse-content flex flex-wrap gap-2 overflow-auto scroll-smooth">
                        <div
                            v-for="tag in tags"
                            :key="tag"
                            class="h-fit w-fit bg-[#a6d9e2] px-1.5 hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
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
                            <select
                                v-model.lazy="selectedGroup"
                                class="select w-full text-center outline-none!"
                            >
                                <option value="" selected></option>
                                <option
                                    v-for="name in tagGroupNames"
                                    :key="name"
                                    :value="name"
                                >
                                    {{ name }}
                                </option>
                            </select>
                            <label class="input w-full px-2 outline-none!">
                                <span class="label">Rename Group</span>
                                <input
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
                                />
                            </label>
                            <div class="relative flex-1">
                                <AutocompletionComponent
                                    v-model="groupTags"
                                    class="textarea w-full h-full resize-none outline-none!"
                                    :id="'tag-group-creation-list'"
                                    :textarea="true"
                                    :multiple="true"
                                    :dropdown-below="true"
                                    :placeholder="'Tags separated by comma to be added to the group...'"
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
                        <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth">
                            <div
                                v-for="tag in selectedGroupTags"
                                v-memo="[tag]"
                                :key="tag"
                                class="h-fit w-fit bg-[#a6d9e2] px-1.5 hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
                                @click="removeTag(tag)"
                            >
                                {{ tag }}
                            </div>
                        </div>
                        <div class="mt-auto border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
                            <label class="input w-full px-1 outline-none!">
                                <AutocompletionComponent
                                    v-model="tagInput"
                                    :disabled="!selectedGroup"
                                    :id="'group-completion-list'"
                                    :placeholder="'Type to add a global tag...'"
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
                        </div>
                    </div>
                    <div class="flex h-[70%] w-full flex-col gap-2">
                        <div class="flex items-center justify-center border-y-2 border-gray-400 text-center dark:border-base-content/10">
                            <p>Import Preview</p>
                        </div>
                        <div class="flex flex-col gap-2 overflow-auto">
                            <div
                                v-for="[name, tags] in importedGroups"
                                :key="name"
                                class="collapse shrink-0 rounded-none border border-base-300 bg-base-100"
                            >
                                <input type="checkbox" />
                                <div class="collapse-title pr-4 text-center font-semibold break-all">
                                    {{ name }}
                                </div>
                                <div class="collapse-content flex flex-wrap gap-2 overflow-auto scroll-smooth">
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
