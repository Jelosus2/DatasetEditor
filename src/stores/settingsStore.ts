import type { SettingsDefinition, Settings } from "../../shared/settings-schema";
import type { SettingsChangeRecord } from "@/types/settings-store";

import { SettingsService } from "@/services/settingsService";
import { computed, reactive, ref, toRaw } from "vue";
import isEqual from "lodash/isEqual";
import { defineStore } from "pinia";

export const useSettingsStore = defineStore("settings", () => {
    const settings = reactive<Settings>({
        showTagCount: false,
        showDiffSection: true,
        showCaptionDiffList: true,
        showTagGroups: true,
        theme: "dark",
        autocomplete: true,
        tagsIgnored: [],
        taggerPort: 3067,
        recursiveDatasetLoad: false,
        autoCheckUpdates: true,
        sortImagesAlphabetically: false,
        enableHardwareAcceleration: true
    });

    const settingsUndoStack = ref<SettingsChangeRecord[]>([]);
    const settingsRedoStack = ref<SettingsChangeRecord[]>([]);
    const schema = ref<SettingsDefinition[]>([]);
    const lastSaved = ref<Settings | null>(null);
    const showRestartPrompt = ref(false);
    const isApplying = ref(false);

    const hasChanges = computed(() => {
        if (!lastSaved.value)
            return false;

        return !isEqual(buildSettings(/* snapshot = */ true), lastSaved.value);
    });

    const restartKeys = computed(() =>
        new Set(schema.value.filter((definition) => definition.requiresRestart).map((definition) => definition.key))
    );

    const restartRequired = computed(() => {
        if (!lastSaved.value)
            return false;

        const current = buildSettings(/* snapshot = */ true);
        for (const key of restartKeys.value) {
            if (!isEqual(current[key], lastSaved.value[key]))
                return true;
        }

        return false;
    });

    const settingsService = new SettingsService();

    function normalizeValue<K extends keyof Settings>(key: K, value: Settings[K]) {
        if (key === "tagsIgnored") {
            const unique = [...new Set(value as string[])];
            return unique as Settings[K];
        }

        return value;
    }

    function isSameValue(a: Settings[keyof Settings], b: Settings[keyof Settings]) {
        return isEqual(a, b);
    }

    function applyTheme(value: string) {
        document.documentElement.dataset.theme = value;
    }

    function recordHistory(change: SettingsChangeRecord) {
        settingsUndoStack.value.push(change);
        settingsRedoStack.value = [];
    }

    function getSetting<K extends keyof Settings>(key: K): Settings[K] {
        return settings[key];
    }

    function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
        const normalized = normalizeValue(key, value);
        const previous = settings[key];

        if (isSameValue(previous, normalized))
            return;

        if (!isApplying.value)
            recordHistory({ key, previous, value: normalized });
        settings[key] = normalized;

        if (key === "theme")
            applyTheme(normalized as string);
    }

    function useSettingField<K extends keyof Settings>(key: K) {
        return computed({
            get: () => settings[key],
            set: (value) => setSetting(key, value)
        });
    }

    const showTagCount = useSettingField("showTagCount");
    const showDiffSection = useSettingField("showDiffSection");
    const showCaptionDiffList = useSettingField("showCaptionDiffList");
    const showTagGroups = useSettingField("showTagGroups");
    const theme = useSettingField("theme");
    const autocomplete = useSettingField("autocomplete");
    const tagsIgnored = useSettingField("tagsIgnored");
    const taggerPort = useSettingField("taggerPort");
    const recursiveDatasetLoad = useSettingField("recursiveDatasetLoad");
    const autoCheckUpdates = useSettingField("autoCheckUpdates");
    const sortImagesAlphabetically = useSettingField("sortImagesAlphabetically");
    const enableHardwareAcceleration = useSettingField("enableHardwareAcceleration");

    function buildSettings(snapshot: boolean = false) {
        return {
            ...(snapshot ? settings : toRaw(settings)),
            tagsIgnored: [...settings.tagsIgnored]
        }
    }

    function applySettings(next: Settings) {
        isApplying.value = true;

        for (const key of Object.keys(settings) as (keyof Settings)[]) {
            const value = next[key];
            if (value !== undefined)
                setSetting(key, value);
        }

        isApplying.value = false;
    }

    function undoSettingsAction() {
        const change = settingsUndoStack.value.pop();
        if (!change)
            return;

        settingsRedoStack.value.push(change);

        isApplying.value = true;
        setSetting(change.key, change.previous);
        isApplying.value = false;
    }

    function redoSettingsAction() {
        const change = settingsRedoStack.value.pop();
        if (!change)
            return;

        settingsUndoStack.value.push(change);

        isApplying.value = true;
        setSetting(change.key, change.value);
        isApplying.value = false;
    }

    function resetSettingsStatus() {
        settingsUndoStack.value = [];
        settingsRedoStack.value = [];
    }

    async function loadSchema() {
        schema.value = await settingsService.loadSchema();
    }

    async function loadSettings() {
        const loaded = await settingsService.loadSettings();
        applySettings(loaded);
        resetSettingsStatus();
        lastSaved.value = buildSettings();
    }

    async function saveSettings() {
        const needsRestart = restartRequired.value;

        const result = await settingsService.updateSettings(buildSettings());
        if (result) {
            applySettings(result);
            resetSettingsStatus();
            lastSaved.value = buildSettings();

            if (needsRestart)
                showRestartPrompt.value = true;
        }
    }

    async function areSettingsSaved() {
        return settingsService.compareSettings(buildSettings());
    }

    function dismissRestartPrompt() {
        showRestartPrompt.value = false;
    }

    async function restartApp() {
        showRestartPrompt.value = false;
        await settingsService.restartApp();
    }

    function loadTheme(newTheme?: string) {
        if (newTheme !== undefined) {
            isApplying.value = true;
            setSetting("theme", newTheme);
            isApplying.value = false;
        } else {
            applyTheme(settings.theme);
        }
    }

    async function importTagsFromCsv() {
        await settingsService.importTagsFromCsv();
    }

    return {
        showTagCount,
        showDiffSection,
        showCaptionDiffList,
        showTagGroups,
        theme,
        autocomplete,
        tagsIgnored,
        taggerPort,
        recursiveDatasetLoad,
        autoCheckUpdates,
        sortImagesAlphabetically,
        enableHardwareAcceleration,
        schema,
        hasChanges,
        restartRequired,
        showRestartPrompt,
        getSetting,
        setSetting,
        undoSettingsAction,
        redoSettingsAction,
        loadSchema,
        loadSettings,
        saveSettings,
        dismissRestartPrompt,
        restartApp,
        areSettingsSaved,
        loadTheme,
        importTagsFromCsv
    }
});
