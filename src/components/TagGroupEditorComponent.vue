<script setup lang="ts">
import AutocompletionComponent from '@/components/AutocompletionComponent.vue';

import { ref, toRaw } from 'vue';
import { useTagGroupStore } from '@/stores/tagGroupStore';

import ExportIcon from '@/assets/icons/export.svg';
import ImportIcon from '@/assets/icons/import.svg';

const emit = defineEmits(['trigger_alert']);

const selectedGroup = ref('');
const groupNameInput = ref('');
const groupTags = ref('');
const tagInput = ref('');
const importedGroups = ref<Map<string, Set<string>>>(new Map());

const tagGroupsStore = useTagGroupStore();

function createGroup() {
  if (!groupNameInput.value) return;

  const noLineBreaks = groupTags.value.split('\n').join('');
  const tags = noLineBreaks
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag);

  tagGroupsStore.tagGroups.set(groupNameInput.value, new Set(tags));
  tagGroupsStore.pushTagGroupChange({
    type: 'add_group',
    group: toRaw(groupNameInput.value),
    tags,
  });

  groupNameInput.value = '';
  groupTags.value = '';
}

function deleteGroup(mode: 'selected' | 'all') {
  if (mode === 'selected') {
    tagGroupsStore.pushTagGroupChange({
      type: 'remove_group',
      group: toRaw(selectedGroup.value),
      tags: [...tagGroupsStore.tagGroups.get(selectedGroup.value)!]
    });

    tagGroupsStore.tagGroups.delete(selectedGroup.value);
  } else {
    const previousGroups = new Map(tagGroupsStore.tagGroups);
    tagGroupsStore.pushTagGroupChange({ type: 'clear_groups', previousGroups });
    tagGroupsStore.tagGroups.clear();
  }

  selectedGroup.value = '';
}

function addTag() {
  if (!tagInput.value) return;

  const tags = tagInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag);

  if (tags.length === 1) {
    tagGroupsStore.tagGroups.get(selectedGroup.value)?.add(tags[0]);
  } else {
    tagGroupsStore.tagGroups.set(
      selectedGroup.value,
      new Set([...tagGroupsStore.tagGroups.get(selectedGroup.value)!.values(), ...tags]),
    );
  }

  tagGroupsStore.pushTagGroupChange({
    type: 'add_tag',
    group: selectedGroup.value,
    tags,
  });

  tagInput.value = '';
}

function removeTag(tag: string, group?: string) {
  tagGroupsStore.tagGroups.get(group || selectedGroup.value)?.delete(tag);

  tagGroupsStore.pushTagGroupChange({
    type: 'remove_tag',
    group: group || selectedGroup.value,
    tags: [tag],
  });
}

async function exportGroupToJSON(mode: 'one' | 'all') {
  if (!tagGroupsStore.tagGroups.size || (mode === 'one' && !selectedGroup.value)) return;

  const obj: { [key: string]: string[] } = {};

  if (mode === 'all') {
    for (const [name, tags] of tagGroupsStore.tagGroups.entries()) {
      obj[name] = [...tags];
    }
  } else {
    obj[selectedGroup.value] = [...tagGroupsStore.tagGroups.get(selectedGroup.value)!];
  }

  const result = await window.ipcRenderer.invoke('save_tag_group_file', obj);
  if (result === false) {
    emit('trigger_alert', 'error', 'Failed to export tag groups, check the logs for more information.')
  }
}

async function importGroup() {
  const result = (await window.ipcRenderer.invoke('import_tag_group')) as
    | Map<string, Set<string>>
    | null
    | false;
  if (result === null) return;
  if (!result) {
    emit('trigger_alert', 'error', 'Invalid file: Invalid JSON structure');
    return;
  }

  importedGroups.value = result;
}

function addImportedGroupToCurrent(override: boolean) {
  if (override) tagGroupsStore.tagGroups.clear();

  for (const [name, tags] of importedGroups.value) {
    tagGroupsStore.tagGroups.set(name, tags);
  }

  importedGroups.value.clear();
}

function renameTagGroup(event: KeyboardEvent) {
  const target = event.target as HTMLInputElement;
  const newName = target.value?.trim();

  if (!newName) return;
  if (selectedGroup.value === newName) {
    emit('trigger_alert', 'error', 'Selected group already has that name.');
    return;
  }
  if (tagGroupsStore.tagGroups.has(newName)) {
    emit('trigger_alert', 'error', 'Group name already exists.');
    return;
  }

  const newGroup = new Map();
  for (const [name, tags] of tagGroupsStore.tagGroups.entries()) {
    if (name === selectedGroup.value) {
      newGroup.set(newName, tags);
    } else {
      newGroup.set(name, tags);
    }
  }

  tagGroupsStore.tagGroups = newGroup;
  selectedGroup.value = newName;
  target.value = '';
}
</script>

<template>
  <input type="radio" name="editor_tabs" class="tab" aria-label="Tag Groups" />
  <div class="tab-content border-t-base-300 bg-base-100">
    <div class="flex h-full">
      <div class="flex w-[25%] flex-col gap-2 overflow-auto pt-1 pl-1">
        <div
          v-for="[name, tags] in tagGroupsStore.tagGroups"
          :key="name"
          class="collapse shrink-0 rounded-none border border-base-300 bg-base-100"
        >
          <input type="checkbox" />
          <div class="collapse-title pr-[16px] text-center font-semibold break-all">
            {{ name }}
          </div>
          <div class="collapse-content flex flex-wrap gap-2 overflow-auto scroll-smooth text-sm">
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
      <div class="flex flex-1 pt-1">
        <div
          class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
        ></div>
        <div class="w-[65%]">
          <div class="flex h-[50%]">
            <div class="flex w-[50%] flex-col gap-2 pb-2">
              <div
                class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10"
              >
                <p>Edit tag group</p>
              </div>
              <select
                v-model.lazy="selectedGroup"
                class="select w-full text-center select-sm !outline-none"
              >
                <option value="" selected></option>
                <option v-for="name in tagGroupsStore.tagGroups.keys()" :key="name" :value="name">
                  {{ name }}
                </option>
              </select>
              <label class="input input-sm w-full px-2 !outline-none">
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
                :disabled="!tagGroupsStore.tagGroups.size"
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
                :disabled="!tagGroupsStore.tagGroups.size"
                @click="deleteGroup('all')"
              >
                Delete All Groups
              </button>
            </div>
            <div
              class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
            ></div>
            <div class="flex w-[50%] flex-col gap-2 pb-2">
              <div
                class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10"
              >
                <p>Create tag group</p>
              </div>
              <label class="input input-sm w-full px-2 !outline-none">
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
                  class="textarea w-full h-full resize-none !outline-none"
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
          <div
            class="flex h-[50%] flex-col border-t-2 border-gray-400 pt-1 dark:border-base-content/10"
          >
            <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth">
              <div
                v-for="tag in tagGroupsStore.tagGroups.get(selectedGroup)?.values()"
                :key="tag"
                class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
                @click="tagGroupsStore.tagGroups.get(selectedGroup)?.delete(tag)"
              >
                {{ tag }}
              </div>
            </div>
            <div class="mt-auto border-t-2 border-gray-400 pt-1 dark:border-base-content/10">
              <label class="input input-sm w-full px-1 !outline-none">
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
        <div
          class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
        ></div>
        <div class="w-[35%] pr-1">
          <div class="flex h-[30%]">
            <div class="flex w-full flex-col gap-2">
              <div
                class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-base-content/10"
              >
                <p>Import tag groups</p>
              </div>
              <button class="btn btn-outline btn-info" @click="importGroup">
                <ImportIcon class="h-5 w-5 fill-none" />
                Import Groups from JSON File
              </button>
              <button
                class="btn btn-outline btn-success"
                :disabled="!importedGroups.size"
                @click="addImportedGroupToCurrent(false)"
              >
                Add to Current Groups
              </button>
              <button
                class="btn btn-outline btn-error"
                :disabled="!importedGroups.size"
                @click="addImportedGroupToCurrent(true)"
              >
                Override Current Groups
              </button>
            </div>
          </div>
          <div class="flex h-[70%] w-full flex-col gap-2">
            <div
              class="flex items-center justify-center border-y-2 border-gray-400 text-center dark:border-base-content/10"
            >
              <p>Import Preview</p>
            </div>
            <div class="flex flex-col gap-2 overflow-auto">
              <div
                v-for="[name, tags] in importedGroups"
                :key="name"
                class="collapse shrink-0 rounded-none border border-base-300 bg-base-100"
              >
                <input type="checkbox" />
                <div class="collapse-title pr-[16px] text-center font-semibold break-all">
                  {{ name }}
                </div>
                <div
                  class="collapse-content flex flex-wrap gap-2 overflow-auto scroll-smooth text-sm"
                >
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
