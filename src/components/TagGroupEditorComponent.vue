<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps({
  tagGroups: {
    type: Map<string, Set<string>>,
    required: true,
  },
  os: {
    type: String,
    required: true,
  },
});

const selectedGroup = ref('');
const groupNameInput = ref('');
const groupTags = ref('');
const isUserInput = ref(true);
const isUserSelection = ref(true);
const tagInput = ref('');
const importedGroups = ref<Map<string, Set<string>>>(new Map());

function createGroup() {
  if (!groupNameInput.value) return;

  const noLineBreaks = groupTags.value.split('\n').join('');
  const tags = noLineBreaks
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag);

  if (props.tagGroups.has(groupNameInput.value)) return;

  props.tagGroups.set(groupNameInput.value, new Set(tags));

  isUserInput.value = false;
  groupNameInput.value = '';
  groupTags.value = '';
}

function addTag() {
  if (!tagInput.value) return;

  const tags = tagInput.value
    .split(',')
    .map((tag) => tag.trim())
    .filter((tag) => tag);

  if (tags.length === 1) {
    props.tagGroups.get(selectedGroup.value)?.add(tags[0]);
  } else {
    props.tagGroups.set(
      selectedGroup.value,
      new Set([...props.tagGroups.get(selectedGroup.value)!.values(), ...tags]),
    );
  }
  tagInput.value = '';
}

async function exportGroupToJSON(mode: 'one' | 'all') {
  if (!props.tagGroups.size || (mode === 'one' && !selectedGroup.value)) return;

  const obj: { [key: string]: string[] } = {};

  if (mode === 'all') {
    for (const [name, tags] of props.tagGroups.entries()) {
      obj[name] = [...tags];
    }

    await window.ipcRenderer.invoke('save_tag_group_file', obj);
  } else {
    obj[selectedGroup.value] = [...props.tagGroups.get(selectedGroup.value)!];

    await window.ipcRenderer.invoke('save_tag_group_file', obj);
  }
}

async function importGroup() {
  const result = (await window.ipcRenderer.invoke('import_tag_group')) as
    | Map<string, Set<string>>
    | null
    | false;
  if (result === null) return;
  if (!result) {
    console.log('Incorrect JSON format');
    return;
  }

  importedGroups.value = result;
}

function addImportedGroupToCurrent(override: boolean) {
  if (override) props.tagGroups.clear();

  for (const [name, tags] of importedGroups.value) {
    props.tagGroups.set(name, tags);
  }

  importedGroups.value.clear();
}

function saveTagGroups(e: KeyboardEvent | MouseEvent) {
  if (e instanceof KeyboardEvent && e.metaKey && props.os !== 'mac') return;

  const obj: { [key: string]: string[] } = {};
  for (const [name, tags] of props.tagGroups.entries()) {
    obj[name] = [...tags];
  }

  if (Object.keys(obj).length) window.ipcRenderer.invoke('save_tag_group', obj);
}
</script>

<template>
  <input type="radio" name="dataset_tabs" class="tab" aria-label="Tag Groups" />
  <div
    tabindex="0"
    @keydown.ctrl.s.exact="saveTagGroups"
    @keydown.meta.s.exact="saveTagGroups"
    class="tab-content border-t-base-300 bg-base-100 focus:outline-none"
  >
    <div class="flex h-full">
      <div class="flex w-[25%] flex-col gap-2 overflow-auto pt-1 pl-1">
        <div
          v-for="[name, tags] in tagGroups"
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
              @click="tagGroups.get(name)?.delete(tag)"
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
                class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
              >
                <p>Edit tag group</p>
              </div>
              <form
                class="flex h-full flex-col gap-2"
                @submit.prevent="
                  (tagGroups.delete(selectedGroup),
                  ((selectedGroup = ''), (isUserSelection = false)))
                "
              >
                <select
                  v-model.lazy="selectedGroup"
                  class="select w-full text-center select-sm !outline-none"
                  :class="{
                    validator: isUserSelection,
                  }"
                  required
                  @change="isUserSelection = true"
                >
                  <option value="" selected></option>
                  <option v-for="name in tagGroups.keys()" :key="name" :value="name">
                    {{ name }}
                  </option>
                </select>
                <p class="validator-hint mt-0 hidden">You must select a group to edit.</p>
                <button
                  class="btn btn-info btn-outline"
                  type="button"
                  @click="exportGroupToJSON('one')"
                >
                  <svg
                    class="h-5 w-5 fill-none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.5 3H12H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H7.5M13.5 3L19 8.625M13.5 3V7.625C13.5 8.17728 13.9477 8.625 14.5 8.625H19M19 8.625V9.75V12V19C19 20.1046 18.1046 21 17 21H16.5"
                      class="stroke-current stroke-2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M12 12V20M12 20L9.5 17.5M12 20L14.5 17.5"
                      class="stroke-current stroke-2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  Export This Group to JSON
                </button>
                <button
                  class="btn btn-info btn-outline"
                  type="button"
                  @click="exportGroupToJSON('all')"
                >
                  <svg
                    class="h-5 w-5 fill-none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M13.5 3H12H7C5.89543 3 5 3.89543 5 5V19C5 20.1046 5.89543 21 7 21H7.5M13.5 3L19 8.625M13.5 3V7.625C13.5 8.17728 13.9477 8.625 14.5 8.625H19M19 8.625V9.75V12V19C19 20.1046 18.1046 21 17 21H16.5"
                      class="stroke-current stroke-2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M12 12V20M12 20L9.5 17.5M12 20L14.5 17.5"
                      class="stroke-current stroke-2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  Export All Groups to JSON
                </button>
                <button class="btn btn-error btn-outline">Delete This Group</button>
                <button
                  class="btn btn-error btn-outline"
                  type="button"
                  @click="(tagGroups.clear(), (selectedGroup = ''), (isUserSelection = false))"
                >
                  Delete All Groups
                </button>
                <button class="btn btn-outline btn-success" type="button" @click="saveTagGroups">
                  Save Tag Groups
                </button>
              </form>
            </div>
            <div
              class="divider m-0 divider-horizontal not-dark:before:bg-gray-400 not-dark:after:bg-gray-400"
            ></div>
            <div class="flex w-[50%] flex-col gap-2 pb-2">
              <div
                class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
              >
                <p>Create tag group</p>
              </div>
              <form class="flex h-full flex-col gap-2" @submit.prevent="createGroup">
                <label
                  class="input input-sm w-full px-2 !outline-none"
                  :class="{
                    validator: isUserInput,
                  }"
                >
                  <span class="label">Group Name</span>
                  <input
                    v-model.trim="groupNameInput"
                    type="text"
                    placeholder="Name for the tag group..."
                    required
                    @input="isUserInput = true"
                  />
                </label>
                <p class="validator-hint mt-0 hidden">The name for the group is required.</p>
                <textarea
                  v-model.trim="groupTags"
                  class="textarea w-full flex-1 resize-none !outline-none"
                  placeholder="Tags separated by comma to be added to the group..."
                ></textarea>
                <button class="btn btn-outline btn-success" type="submit">Create Group</button>
              </form>
            </div>
          </div>
          <div
            class="flex h-[50%] flex-col border-t-2 border-gray-400 pt-1 dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
          >
            <div class="mb-2 flex h-fit flex-wrap gap-2 overflow-auto scroll-smooth">
              <div
                v-for="tag in tagGroups.get(selectedGroup)?.values()"
                :key="tag"
                class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
                @click="tagGroups.get(selectedGroup)?.delete(tag)"
              >
                {{ tag }}
              </div>
            </div>
            <div
              class="mt-auto border-t-2 border-gray-400 pt-1 dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
            >
              <label class="input input-xs w-full px-1 !outline-none">
                <input
                  v-model.trim="tagInput"
                  type="text"
                  placeholder="Type to add tags separated by comma..."
                  :disabled="!selectedGroup"
                  @keyup.enter="addTag"
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
                class="flex items-center justify-center border-b-2 border-gray-400 text-center dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
              >
                <p>Import tag groups</p>
              </div>
              <button class="btn btn-info btn-outline" @click="importGroup">
                <svg
                  class="h-5 w-5 fill-none"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M13.5 3H12H8C6.34315 3 5 4.34315 5 6V18C5 19.6569 6.34315 21 8 21H12M13.5 3L19 8.625M13.5 3V7.625C13.5 8.17728 13.9477 8.625 14.5 8.625H19M19 8.625V11.8125"
                    class="stroke-current stroke-2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                  <path
                    d="M17.5 21L17.5 15M17.5 15L20 17.5M17.5 15L15 17.5"
                    class="stroke-current stroke-2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                Import Groups from JSON File
              </button>
              <button class="btn btn-outline btn-success" @click="addImportedGroupToCurrent(false)">
                Add to Current Groups
              </button>
              <button class="btn btn-error btn-outline" @click="addImportedGroupToCurrent(true)">
                Override Current Groups
              </button>
            </div>
          </div>
          <div class="flex h-[70%] w-full flex-col gap-2">
            <div
              class="flex items-center justify-center border-y-2 border-gray-400 text-center dark:border-[color-mix(in_oklab,_var(--color-base-content)_10%,_transparent)]"
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
