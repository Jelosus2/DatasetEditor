import { defineStore } from "pinia";
import { ref, watch } from "vue";

export type DatasetFilterMode = "or" | "and";
export type IndividualTagSortMode = "none" | "alphabetical";
export type MassTagSortMode = "alphabetical" | "tag_count";
export type TagSortOrder = "asc" | "desc";

type PersistedUiState = {
    filterMode: DatasetFilterMode;
    individualTagSortMode: IndividualTagSortMode;
    massTagSortMode: MassTagSortMode;
    individualTagSortOrder: TagSortOrder;
    massTagSortOrder: TagSortOrder;
    selectedAutotaggerModels: string[];
    removeUnderscores: boolean;
    removeRedundantTags: boolean;
    disableCharacterThreshold: boolean;
    lastDatasetDirectory: string | null;
};

const STORAGE_KEY = "dataset-editor-ui-state";

const DEFAULT_UI_STATE: PersistedUiState = {
    filterMode: "or",
    individualTagSortMode: "none",
    massTagSortMode: "alphabetical",
    individualTagSortOrder: "asc",
    massTagSortOrder: "asc",
    selectedAutotaggerModels: [],
    removeUnderscores: true,
    removeRedundantTags: true,
    disableCharacterThreshold: false,
    lastDatasetDirectory: null
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDatasetFilterMode(value: unknown): value is DatasetFilterMode {
    return value === "or" || value === "and";
}

function isIndividualTagSortMode(value: unknown): value is IndividualTagSortMode {
    return value === "none" || value === "alphabetical";
}

function isMassTagSortMode(value: unknown): value is MassTagSortMode {
    return value === "alphabetical" || value === "tag_count";
}

function isTagSortOrder(value: unknown): value is TagSortOrder {
    return value === "asc" || value === "desc";
}

function getBoolean(value: unknown, fallback: boolean) {
    return typeof value === "boolean" ? value : fallback;
}

function getNullableString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0
        ? value
        : null;
}

function getStringArray(value: unknown) {
    if (!Array.isArray(value))
        return [];

    return [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))];
}

function loadUiState(): PersistedUiState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return { ...DEFAULT_UI_STATE };

        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed))
            return { ...DEFAULT_UI_STATE };

        return {
            filterMode: isDatasetFilterMode(parsed.filterMode)
                ? parsed.filterMode
                : DEFAULT_UI_STATE.filterMode,
            individualTagSortMode: isIndividualTagSortMode(parsed.individualTagSortMode)
                ? parsed.individualTagSortMode
                : DEFAULT_UI_STATE.individualTagSortMode,
            massTagSortMode: isMassTagSortMode(parsed.massTagSortMode)
                ? parsed.massTagSortMode
                : DEFAULT_UI_STATE.massTagSortMode,
            individualTagSortOrder: isTagSortOrder(parsed.individualTagSortOrder)
                ? parsed.individualTagSortOrder
                : DEFAULT_UI_STATE.individualTagSortOrder,
            massTagSortOrder: isTagSortOrder(parsed.massTagSortOrder)
                ? parsed.massTagSortOrder
                : DEFAULT_UI_STATE.massTagSortOrder,
            selectedAutotaggerModels: getStringArray(parsed.selectedAutotaggerModels),
            removeUnderscores: getBoolean(parsed.removeUnderscores, DEFAULT_UI_STATE.removeUnderscores),
            removeRedundantTags: getBoolean(parsed.removeRedundantTags, DEFAULT_UI_STATE.removeRedundantTags),
            disableCharacterThreshold: getBoolean(parsed.disableCharacterThreshold, DEFAULT_UI_STATE.disableCharacterThreshold),
            lastDatasetDirectory: getNullableString(parsed.lastDatasetDirectory),
        };
    } catch (error) {
        console.error("[UI State] Failed to load persisted UI state:", error);
        return { ...DEFAULT_UI_STATE };
    }
}

export const useUiStateStore = defineStore("uiState", () => {
    const initialState = loadUiState();

    const filterMode = ref<DatasetFilterMode>(initialState.filterMode);
    const individualTagSortMode = ref<IndividualTagSortMode>(initialState.individualTagSortMode);
    const massTagSortMode = ref<MassTagSortMode>(initialState.massTagSortMode);
    const individualTagSortOrder = ref<TagSortOrder>(initialState.individualTagSortOrder);
    const massTagSortOrder = ref<TagSortOrder>(initialState.massTagSortOrder);
    const selectedAutotaggerModels = ref<Set<string>>(new Set(initialState.selectedAutotaggerModels));
    const removeUnderscores = ref(initialState.removeUnderscores);
    const removeRedundantTags = ref(initialState.removeRedundantTags);
    const disableCharacterThreshold = ref(initialState.disableCharacterThreshold);
    const lastDatasetDirectory = ref<string | null>(initialState.lastDatasetDirectory);

    function buildPersistedState(): PersistedUiState {
        return {
            filterMode: filterMode.value,
            individualTagSortMode: individualTagSortMode.value,
            massTagSortMode: massTagSortMode.value,
            individualTagSortOrder: individualTagSortOrder.value,
            massTagSortOrder: massTagSortOrder.value,
            selectedAutotaggerModels: [...selectedAutotaggerModels.value],
            removeUnderscores: removeUnderscores.value,
            removeRedundantTags: removeRedundantTags.value,
            disableCharacterThreshold: disableCharacterThreshold.value,
            lastDatasetDirectory: lastDatasetDirectory.value
        };
    }

    function persistUiState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(buildPersistedState()));
        } catch (error) {
            console.error("[UI State] Failed to persist UI state:", error);
        }
    }

    function retainAvailableAutotaggerModels(availableModels: Iterable<string>) {
        const available = new Set(availableModels);
        const retained = new Set([...selectedAutotaggerModels.value].filter((model) => available.has(model)));

        if (retained.size !== selectedAutotaggerModels.value.size)
            selectedAutotaggerModels.value = retained;
    }

    watch(() => [
        filterMode.value,
        individualTagSortMode.value,
        massTagSortMode.value,
        individualTagSortOrder.value,
        massTagSortOrder.value,
        [...selectedAutotaggerModels.value],
        removeUnderscores.value,
        removeRedundantTags.value,
        disableCharacterThreshold.value,
        lastDatasetDirectory.value
    ], persistUiState, { deep: true });

    persistUiState();

    return {
        filterMode,
        individualTagSortMode,
        massTagSortMode,
        individualTagSortOrder,
        massTagSortOrder,
        selectedAutotaggerModels,
        removeUnderscores,
        removeRedundantTags,
        disableCharacterThreshold,
        lastDatasetDirectory,
        retainAvailableAutotaggerModels
    };
});
