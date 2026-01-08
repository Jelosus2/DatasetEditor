import type { SettingsDefinition, Settings } from "../../shared/settings-schema";

import { useSettingsStore } from "@/stores/settingsStore";
import { computed, ref } from "vue";

export function useSettingsOperations() {
    const settingsStore = useSettingsStore();
    const search = ref("");

    const filteredSchema = computed(() => {
        const query = search.value.trim().toLowerCase();
        if (!query)
            return settingsStore.schema;

        return settingsStore.schema.filter((item) => {
            const matchesMetadata = [item.label, item.description, item.section]
                .some((value) => value?.toLowerCase().includes(query));
            if (matchesMetadata)
                return true;

            if (item.type === "shortcut") {
                const currentValue = String(settingsStore.getSetting(item.key)).toLowerCase();
                return currentValue.includes(query);
            }

            return false;
        });
    });

    const sections = computed(() => {
        const map = new Map<string, SettingsDefinition[]>();

        for (const item of filteredSchema.value) {
            const list = map.get(item.section) ?? [];

            list.push(item);
            map.set(item.section, list);
        }

        return [...map.entries()];
    });

    function getValue(definition: SettingsDefinition) {
        return settingsStore.getSetting(definition.key);
    }

    function setValue(definition: SettingsDefinition, raw: unknown) {
        const key = definition.key;

        if (definition.type === "number")
            settingsStore.setSetting(key, Number(raw));
        else if (definition.type === "boolean")
            settingsStore.setSetting(key, Boolean(raw));
        else if (definition.type === "string[]")
            settingsStore.setSetting(
                key,
                String(raw).split(",").map((value) => value.trim()).filter(Boolean)
            )
        else if (definition.type === "shortcut")
            settingsStore.setSetting(key, String(raw));
        else
            settingsStore.setSetting(key, raw as Settings[keyof Settings]);
    }

    async function runAction(definition: SettingsDefinition) {
        if (definition.actionId === "loadTagsCsv")
            await settingsStore.importTagsFromCsv();
    }

    function formatShortcut(event: KeyboardEvent) {
        return settingsStore.formatShortcutEvent(event);
    }

    function matchesShortcut(combo: string, event: KeyboardEvent) {
        return settingsStore.matchesShortcut(combo, event);
    }

    return {
        search,
        sections,
        getValue,
        setValue,
        runAction,
        formatShortcut,
        matchesShortcut
    }
}
