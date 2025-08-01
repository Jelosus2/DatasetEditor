<script setup lang="ts">
import { ref, shallowRef, nextTick, useAttrs } from 'vue';
import { useSettingsStore } from '@/stores/settingsStore';

defineOptions({ inheritAttrs: false });
const tagInput = defineModel({ required: true, type: String });
const emit = defineEmits(['on-complete', 'on-input', 'on-blur']);
const props = defineProps({
  disabled: { type: Boolean },
  id: { type: String },
  placeholder: { type: String },
  multiple: { type: Boolean },
  customList: { type: Array<string> },
  containsMode: { type: Boolean },
  textarea: { type: Boolean, default: false },
  rows: { type: [Number, String] },
  dropdownBelow: { type: Boolean, default: false },
});

const attrs = useAttrs();
const settingsStore = useSettingsStore();

const completions = ref<{ tag: string; type?: number; output: string }[]>([]);
const completionList = shallowRef<HTMLLIElement[]>([]);
const selectedIndex = ref(-1);
const active = ref(false);
const input = shallowRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

async function showSuggestions() {
  if (!settingsStore.autocomplete) return;
  const value = props.multiple ? tagInput.value.split(',').pop()?.trim() : tagInput.value;

  const results = props.customList?.length
    ? props.customList
        .filter((tag) => {
          if (!value) return false;
          return !props.containsMode
            ? tag.toLowerCase().startsWith(value!.toLowerCase())
            : tag.toLowerCase().includes(value!.toLowerCase());
        })
        .map((tag) => ({ tag, output: tag }))
    : ((await window.ipcRenderer.invoke('load_tag_suggestions', value)) as {
        tag: string;
        type?: number;
        output: string;
      }[]);
  completions.value = results;
  selectedIndex.value = -1;

  await nextTick();
  completionList.value = document.querySelectorAll(`#${props.id} li`) as unknown as HTMLLIElement[];

  emit('on-input');
}

function scrollToSelected() {
  const selectedItem = completionList.value[selectedIndex.value];
  if (selectedItem) {
    selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

async function onArrowUp() {
  if (tagInput.value) {
    selectedIndex.value =
      (selectedIndex.value - 1 + completions.value.length) % completions.value.length;
    await nextTick();
    scrollToSelected();
  }
}

async function onArrowDown() {
  if (tagInput.value) {
    selectedIndex.value = (selectedIndex.value + 1) % completions.value.length;
    await nextTick();
    scrollToSelected();
  }
}

function onKeyEnter() {
  if (!tagInput.value) return;

  if (selectedIndex.value !== -1) {
    const parts = tagInput.value.split(',').map((part) => part.trim());
    parts[parts.length - 1] = completionList.value[selectedIndex.value].dataset.tag || '';

    tagInput.value = parts.join(', ');
    completions.value = [];
    selectedIndex.value = -1;
    return;
  }

  completions.value = [];
  emit('on-complete');
}

async function handleSuggestionClick(tag: string) {
  const parts = tagInput.value.split(',').map((part) => part.trim());
  parts[parts.length - 1] = tag;

  tagInput.value = parts.join(', ');
  completions.value = [];
  selectedIndex.value = -1;

  setTimeout(() => {
    if (input.value) input.value.focus();
  }, 0);
}

function onBlur() {
  completions.value = [];
  selectedIndex.value = -1;
  active.value = false;
  emit('on-blur');
}
</script>

<template>
  <input
    v-if="!textarea"
    ref="input"
    v-model.trim="tagInput"
    type="text"
    :placeholder="placeholder"
    :disabled="disabled"
    v-bind="attrs"
    @input="showSuggestions"
    @focus="active = true"
    @blur="onBlur"
    @keyup.enter="onKeyEnter"
    @keydown.prevent.arrow-up="onArrowUp"
    @keydown.prevent.arrow-down="onArrowDown"
  />
  <textarea
    v-else
    ref="input"
    v-model.trim="tagInput"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    v-bind="attrs"
    @input="showSuggestions"
    @focus="active = true"
    @blur="onBlur"
    @keydown.enter.prevent="onKeyEnter"
    @keydown.prevent.arrow-up="onArrowUp"
    @keydown.prevent.arrow-down="onArrowDown"
  ></textarea>
  <ul
    v-if="active"
    :class="[
      'absolute left-0 max-h-60 w-full overflow-y-auto text-xs dark:bg-[#1e1f2c]',
      dropdownBelow ? 'top-full' : 'bottom-full'
    ]"
    :id="id"
  >
    <li
      v-for="(completion, index) in completions"
      :key="completion.tag"
      class="cursor-pointer p-2 dark:hover:bg-[#292a3b]"
      :data-tag="completion.tag"
      :class="{
        'dark:bg-[#292a3b]': index === selectedIndex,
        'text-[#0a95d9]': completion.type === 0,
        'text-[#e6888a]': completion.type === 1,
        'text-[#b58fe2]': completion.type === 3,
        'text-[#318842]': completion.type === 4,
        'text-[#dac68a]': completion.type === 5,
      }"
      @mousedown="handleSuggestionClick(completion.tag)"
    >
      {{ completion.output }}
    </li>
  </ul>
</template>
