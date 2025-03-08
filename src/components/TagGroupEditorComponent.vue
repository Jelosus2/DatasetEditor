<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps({
  tagGroups: {
    type: Map<string, Set<string>>,
    required: true,
  },
});

const selectedGroup = ref('');
const groupNameInput = ref('');
const groupTags = ref('');
const isUserInput = ref(true);
const isUserSelection = ref(true);
const tagInput = ref('');

function test() {
  props.tagGroups.set('General tags', new Set(['test', 'works']));
  props.tagGroups.set(
    'Character tags',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    'Character tags',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '1',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '2',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '3',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '4',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '5',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '6',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '7',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '8',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '9',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '10',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '11',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '12',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '14',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '15',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '16',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
  props.tagGroups.set(
    '17aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
}

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
</script>

<template>
  <input type="radio" name="dataset_tabs" class="tab" aria-label="Tag Groups" />
  <div class="tab-content border-t-base-300 bg-base-100">
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
                @submit.prevent="(tagGroups.delete(selectedGroup), (isUserSelection = false))"
              >
                <select
                  v-model.lazy="selectedGroup"
                  class="select text-center select-sm !outline-none"
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
                <button class="btn btn-info btn-outline" type="button">
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
                  Export to JSON
                </button>
                <button class="btn btn-error btn-outline">Delete Group</button>
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
                  class="input input-sm px-2 !outline-none"
                  :class="{
                    validator: isUserInput,
                  }"
                >
                  Group Name
                  <input
                    :key="'groupName'"
                    v-model.trim="groupNameInput"
                    type="text"
                    @input="isUserInput = true"
                    placeholder="Name for the tag group..."
                    required
                  />
                </label>
                <p class="validator-hint mt-0 hidden">The name for the group is required.</p>
                <textarea
                  v-model.trim="groupTags"
                  class="textarea flex-1 resize-none !outline-none"
                  placeholder="Tags to be added to the group..."
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
        <div class="w-[35%]">
          <div @click="test">Test</div>
        </div>
      </div>
    </div>
  </div>
</template>
