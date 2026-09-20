<script setup lang="ts">
import { useExpandCollapseAll } from "@/composables/useExpandCollapseAll";
import { computed } from "vue";

import CaretDownIcon from "@/assets/icons/caret-down.svg";

const expandedItems = defineModel<Set<string>>({ required: true });

const props = defineProps<{
    itemNames: string[];
}>();

const itemNames = computed(() => props.itemNames);

const {
    canExpand,
    canCollapse,
    expandAll,
    collapseAll
} = useExpandCollapseAll(expandedItems, itemNames);

function closeDropdown(event: MouseEvent) {
    const button = event.currentTarget;

    if (button instanceof HTMLElement)
        button.blur();
}

function handleExpand(event: MouseEvent) {
    expandAll();
    closeDropdown(event);
}

function handleCollapse(event: MouseEvent) {
    collapseAll();
    closeDropdown(event);
}
</script>

<template>
    <div class="dropdown dropdown-end shrink-0">
        <button
            tabindex="0"
            type="button"
            class="btn btn-outline w-33 gap-1"
            :disabled="itemNames.length === 0"
        >
            <span>All Groups</span>
            <CaretDownIcon class="h-4 w-4 shrink-0" />
        </button>

        <ul
            tabindex="0"
            class="dropdown-content menu z-50 mt-2 w-36 rounded-box border border-base-content/20 bg-base-100 p-2 shadow-lg"
        >
            <li>
                <button
                    type="button"
                    :disabled="!canExpand"
                    @click="handleExpand"
                >
                    Expand All
                </button>
            </li>
            <li>
                <button
                    type="button"
                    :disabled="!canCollapse"
                    @click="handleCollapse"
                >
                    Collapse All
                </button>
            </li>
        </ul>
    </div>
</template>
