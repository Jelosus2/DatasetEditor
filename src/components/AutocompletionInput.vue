<script setup lang="ts">
import type { CompletionItem } from "../../shared/autocompletion";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useSettingsStore } from "@/stores/settingsStore";
import { ref, shallowRef, computed, nextTick, useAttrs, onBeforeUnmount, onBeforeUpdate } from "vue";

const SUGGESTION_DEBOUNCE_MS = 120;
const MAX_SUGGESTIONS = 20;

defineOptions({ inheritAttrs: false });

const tagInput = defineModel<string>({ required: true });

const emit = defineEmits<{
    (e: "on-complete"): void;
    (e: "on-input"): void;
    (e: "on-blur"): void;
}>();

const props = withDefaults(
    defineProps<{
        disabled?: boolean;
        placeholder?: string;
        multiple?: boolean;
        customList?: string[];
        keyEnterEmpty?: boolean;
        containsMode?: boolean;
        textarea?: boolean;
        rows?: number | string;
        dropdownBelow?: boolean;
    }>(), {
        disabled: false,
        multiple: false,
        keyEnterEmpty: false,
        containsMode: false,
        textarea: false,
        dropdownBelow: false
    }
);

const attrs = useAttrs();
const ipc = useIpcRenderer([]);
const settingsStore = useSettingsStore();

const completions = ref<CompletionItem[]>([]);
const selectedIndex = ref(-1);
const isFocused = ref(false);
const input = shallowRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
const completionList = ref<HTMLLIElement[]>([]);

const hasCustomList = computed(() => props.customList !== undefined);
const hasSuggestions = computed(() => completions.value.length > 0);
const showDropdown = computed(() => isFocused.value && hasSuggestions.value);

let debounceHandle: ReturnType<typeof setTimeout> | null = null;
let requestId = 0;

function setCompletionRef(element: HTMLLIElement | null) {
    if (element)
        completionList.value.push(element);
}

function clearCompletions() {
    completions.value = [];
    selectedIndex.value = -1;
}

function getCurrentQuery() {
    const currentValue = tagInput.value;
    const rawValue = props.multiple ? currentValue.split(",").pop()?.trim() ?? "" : currentValue.trim();
    const hasNegativePrefix = hasCustomList.value && rawValue.startsWith("-");
    const query = hasNegativePrefix ? rawValue.slice(1).trimStart() : rawValue;

    return { query, hasNegativePrefix };
}

function applyCompletion(tag: string) {
    if (props.multiple) {
        const parts = tagInput.value.split(",").map((part) => part.trim());
        parts[parts.length - 1] = tag;
        tagInput.value = parts.join(", ");
    } else {
        tagInput.value = tag;
    }
}

function scheduleSuggestions() {
    emit("on-input");

    if (!settingsStore.autocomplete || props.disabled) {
        clearCompletions();
        return;
    }
    if (debounceHandle) {
        clearTimeout(debounceHandle);
        debounceHandle = null;
    }

    debounceHandle = setTimeout(async () => {
        const { query, hasNegativePrefix } = getCurrentQuery();
        if (!query) {
            clearCompletions();
            return;
        }

        const currentRequestId = ++requestId;

        try {
            let results: CompletionItem[] = [];

            if (hasCustomList.value) {
                const source = props.customList ?? [];
                const lowerQuery = query.toLowerCase();

                results = source
                    .filter((tag) => {
                        const lowerTag = tag.toLowerCase();
                        if (!props.containsMode)
                            return lowerTag.startsWith(lowerQuery);

                        return lowerTag.includes(lowerQuery);
                    })
                    .slice(0, MAX_SUGGESTIONS)
                    .map((tag) => {
                        const value = hasNegativePrefix ? `-${tag}` : tag;
                        return { tag: value, output: value };
                    });
            } else {
                results = await ipc.invoke("database:retrieve_completions", query);
            }

            if (currentRequestId !== requestId)
                return;

            completions.value = results;
            selectedIndex.value = -1;
        } catch {
            if (currentRequestId === requestId)
                clearCompletions();
        }
    }, SUGGESTION_DEBOUNCE_MS);
}

function scrollToSelected() {
    const selectedItem = completionList.value[selectedIndex.value];
    if (!selectedItem)
        return;

    selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

async function moveSelection(direction: 1 | -1) {
    if (!hasSuggestions.value)
        return;

    const length = completions.value.length;
    if (selectedIndex.value < 0)
        selectedIndex.value = direction > 0 ? 0 : length - 1;
    else
        selectedIndex.value = (selectedIndex.value + direction + length) % length;

    await nextTick();
    scrollToSelected();
}

function onKeyEnter() {
    const hasValue = tagInput.value.length > 0;
    if (!props.keyEnterEmpty && !hasValue)
        return;

    if (selectedIndex.value >= 0) {
        const completion = completions.value[selectedIndex.value];
        if (completion)
            applyCompletion(completion.tag);

        clearCompletions();
        return;
    }

    clearCompletions();
    emit("on-complete");
}

function handleSuggestionClick(tag: string) {
    applyCompletion(tag);
    clearCompletions();
    input.value?.focus();
}

function onFocus() {
    isFocused.value = true;
    scheduleSuggestions();
}

function onBlur() {
    clearCompletions();
    isFocused.value = false;
    emit("on-blur");
}

onBeforeUpdate(() => {
    completionList.value = [];
});

onBeforeUnmount(() => {
    if (debounceHandle) {
        clearTimeout(debounceHandle);
        debounceHandle = null;
    }
});
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
        @input="scheduleSuggestions"
        @focus="onFocus"
        @blur="onBlur"
        @keyup.enter="onKeyEnter"
        @keydown.arrow-up.prevent="moveSelection(-1)"
        @keydown.arrow-down.prevent="moveSelection(1)"
    />
    <textarea
        v-else
        ref="input"
        v-model.trim="tagInput"
        :rows="rows"
        :placeholder="placeholder"
        :disabled="disabled"
        v-bind="attrs"
        @input="scheduleSuggestions"
        @focus="onFocus"
        @blur="onBlur"
        @keydown.enter.prevent="onKeyEnter"
        @keydown.arrow-up.prevent="moveSelection(-1)"
        @keydown.arrow-down.prevent="moveSelection(1)"
    ></textarea>
    <ul
        v-if="showDropdown"
        :class="[
            'absolute left-0 z-40 max-h-60 w-full overflow-y-auto rounded-box border border-base-content/20 py-1 text-sm bg-white dark:bg-[#1e1f2c] shadow-lg',
            dropdownBelow ? 'top-full mt-1' : 'bottom-full mb-1'
        ]"
    >
        <li
            v-for="(completion, index) in completions"
            :key="`${completion.tag}-${index}`"
            :ref="(element) => setCompletionRef(element as HTMLLIElement | null)"
            class="cursor-pointer px-2 py-1.5 transition-colors hover:bg-[#e6f2ff] dark:hover:bg-[#292a3b]"
            :class="{
                'dark:bg-[#292a3b]': index === selectedIndex,
                'text-[#0a95d9]': completion.type === 0,
                'text-[#e6888a]': completion.type === 1,
                'text-[#b58fe2]': completion.type === 3,
                'text-[#318842]': completion.type === 4,
                'text-[#dac68a]': completion.type === 5,
            }"
            @mousedown.prevent="handleSuggestionClick(completion.tag)"
        >
            {{ completion.output }}
        </li>
    </ul>
</template>
