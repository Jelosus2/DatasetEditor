import type { ComputedRef, Ref } from "vue";

import { computed } from "vue";

export function useExpandCollapseAll(expandedItems: Ref<Set<string>>, itemNames: ComputedRef<string[]>) {
    const canExpand = computed(() => itemNames.value.some((name) => !expandedItems.value.has(name)));
    const canCollapse = computed(() => itemNames.value.some((name) => expandedItems.value.has(name)));

    function expandAll() {
        expandedItems.value = new Set(itemNames.value);
    }

    function collapseAll() {
        expandedItems.value = new Set();
    }

    return {
        canExpand,
        canCollapse,
        expandAll,
        collapseAll
    };
}
