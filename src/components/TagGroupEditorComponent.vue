<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps({
  tagGroups: {
    type: Map<string, Set<string>>,
    required: true,
  },
});

const selectedGroup = ref('');

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
    '1',
    new Set(['fubuki', 'cinderella', 'privaty', 'naga', 'helm', 'crown', 'scarlet: black shadow']),
  );
}
</script>

<template>
  <input type="radio" name="dataset_tabs" class="tab" aria-label="Tag Groups" />
  <div class="tab-content border-t-base-300 bg-base-100">
    <div class="flex h-full">
      <div class="flex w-[20%] flex-col gap-2 overflow-auto pt-1 pl-1">
        <div
          v-for="[name, tags] in tagGroups"
          :key="name"
          class="collapse rounded-none border border-base-300 bg-base-100"
        >
          <input type="checkbox" />
          <div class="collapse-title pr-[16px] text-center font-semibold break-all">
            {{ name }}
          </div>
          <div class="collapse-content flex flex-wrap gap-2 overflow-auto scroll-smooth text-sm">
            <div
              v-for="tag in tags"
              :key="tag"
              class="h-fit w-fit bg-[#a6d9e2] px-1.5 text-sm hover:cursor-pointer hover:bg-rose-900 dark:bg-gray-700"
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
        <div>
          <select v-model.lazy="selectedGroup" class="select w-fit select-sm !outline-none">
            <option value="" selected></option>
            <option v-for="name in tagGroups.keys()" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
        <div @click="test">Test</div>
      </div>
    </div>
  </div>
</template>
