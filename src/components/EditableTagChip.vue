<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import EditIcon from "@/assets/icons/edit.svg";

const props = withDefaults(defineProps<{
    tag: string;
    label?: string;
    selectable?: boolean;
    selected?: boolean;
}>(), {
    selectable: false,
    selected: false
});

const emit = defineEmits<{
    commit: [newTag: string];
    remove: [];
    "toggle-selection": [];
}>();

const editing = ref(false);
const draft = ref(props.tag);
const inputElement = ref<HTMLInputElement | null>(null);

const displayLabel = computed(() => props.label ?? props.tag);

watch(() => props.tag, (tag) => {
    draft.value = tag;
    editing.value = false;
});

async function startEditing() {
    draft.value = props.tag;
    editing.value = true;

    await nextTick();

    inputElement.value?.focus();
    inputElement.value?.select();
}

function commitEditing() {
    if (!editing.value)
        return;

    const newTag = draft.value.trim();
    editing.value = false;

    if (!newTag) {
        emit("remove");
        return;
    }

    if (newTag === props.tag) {
        draft.value = props.tag;
        return;
    }

    emit("commit", newTag);
}

function cancelEditing() {
    draft.value = props.tag;
    editing.value = false;
}

function handleChipClick() {
    if (!editing.value)
        emit("remove");
}

async function handleModifiedClick(event: MouseEvent) {
    if (editing.value)
        return;

    if (event.shiftKey) {
        event.preventDefault();
        event.stopImmediatePropagation();

        await startEditing();
        return;
    }

    if (event.ctrlKey && props.selectable) {
        event.preventDefault();
        event.stopImmediatePropagation();

        emit("toggle-selection");
    }
}

function handleDragStart(event: DragEvent) {
    if (!editing.value)
        return;

    event.preventDefault();
    event.stopPropagation();
}
</script>

<template>
    <div
        class="group relative flex h-fit w-fit items-center"
        :class="{
            'ring-2 ring-primary ring-inset': selected
        }"
        :aria-selected="selectable ? selected : undefined"
        @click.capture="handleModifiedClick"
        @click="handleChipClick"
        @dragstart.capture="handleDragStart"
    >
        <slot name="prefix" :editing="editing"></slot>
        <span class="relative block min-w-0">
            <span :class="{ invisible: editing }">
                {{ displayLabel }}
            </span>
            <input
                v-if="editing"
                ref="inputElement"
                v-model="draft"
                class="editable-tag-chip-input absolute inset-0 h-full w-full min-w-0 bg-transparent p-0 outline-none"
                type="text"
                :aria-label="`Edit ${tag}`"
                @click.stop
                @mousedown.stop
                @contextmenu.stop
                @blur="commitEditing"
                @keydown.enter.prevent="commitEditing"
                @keydown.esc.prevent="cancelEditing"
            />
        </span>
        <span
            class="relative h-3.5 w-0 shrink-0 overflow-hidden opacity-0 transition-all duration-150
                group-hover:ml-1 group-hover:w-3.5 group-hover:opacity-100
                group-focus-within:ml-1 group-focus-within:w-3.5 group-focus-within:opacity-100"
        >
            <button
                v-if="!editing"
                class="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                type="button"
                title="Edit tag"
                :aria-label="`Edit ${tag}`"
                @click.stop="startEditing"
            >
                <EditIcon class="h-full w-full fill-none" />
            </button>
        </span>
        <slot name="suffix" :editing="editing"></slot>
    </div>
</template>

<style scoped>
.editable-tag-chip-input {
    border: 0;
    box-sizing: border-box;
    color: inherit;
    cursor: text;
    font: inherit;
    line-height: inherit;
}
</style>
