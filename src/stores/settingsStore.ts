import type { SettingsDefinition, Settings } from "../../shared/settings-schema";
import type { SettingsChangeRecord } from "@/types/settings-store";

import { SettingsService } from "@/services/settingsService";
import { computed, reactive, ref, toRaw } from "vue";
import isEqual from "lodash/isEqual";
import { defineStore } from "pinia";

const MOD_ORDER = ["Ctrl", "Shift", "Alt"];
const MOD_ALIASES: Record<string, string> = {
    ctrl: "Ctrl",
    control: "Ctrl",
    shift: "Shift",
    alt: "Alt"
}

let layoutMap: KeyboardLayoutMap | null = null;

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
        enableHardwareAcceleration: true,
        shortcutLoadDataset: "Ctrl+O",
        shortcutReloadDataset: "Ctrl+R",
        shortcutSave: "Ctrl+S",
        shortcutUndo: "Ctrl+Z",
        shortcutRedo: "Ctrl+Y",
        shortcutSelectAllImages: "Ctrl+A",
        shortcutNavigationLeft: "ArrowLeft",
        shortcutNavigationRight: "ArrowRight",
        shortcutNavigationUp: "ArrowUp",
        shortcutNavigationDown: "ArrowDown",
        shortcutToggleTagEditMode: "Ctrl+E"
    });

    const settingsUndoStack = ref<SettingsChangeRecord[]>([]);
    const settingsRedoStack = ref<SettingsChangeRecord[]>([]);
    const schema = ref<SettingsDefinition[]>([]);
    const lastSaved = ref<Settings | null>(null);
    const showRestartPrompt = ref(false);
    const isApplying = ref(false);
    const shortcutConflicts = ref<Set<keyof Settings>>(new Set());

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

    const shortcutKeys = Object.keys(settings).filter((key) => key.startsWith("shortcut")) as Array<keyof Settings>;

    const settingsService = new SettingsService();

    function canonicalKey(part: string) {
        if (!part)
            return "";
        if (part === " ")
            return "Space";
        if (part === "+" || part.toLowerCase() === "plus")
            return "Plus";

        const lower = part.toLowerCase();
        if (lower.startsWith("arrow")) {
            const direction = lower.slice(5);
            return `Arrow${direction.charAt(0).toUpperCase()}${direction.slice(1)}`;
        }

        if (lower === "escape")
            return "Escape";

        return part.length === 1 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1);
    }

    function normalizeShortcut(raw: string) {
        const parts = raw.split("+").map((part) => part.trim()).filter(Boolean);
        if (parts.length === 0)
            return "";

        const mods = new Set<string>();
        let key = "";

        for (const part of parts) {
            const lower = part.toLowerCase();
            const mod = MOD_ALIASES[lower];

            if (mod) {
                mods.add(mod);
                continue;
            }

            key = canonicalKey(part);
        }

        const orderedMods = MOD_ORDER.filter((mod) => mods.has(mod));
        return key ? [...orderedMods, key].join("+") : orderedMods.join("+");
    }

    async function ensureLayoutMap() {
        if (!layoutMap)
            layoutMap = await navigator.keyboard.getLayoutMap();
    }

    function getKeyLabel(event: KeyboardEvent) {
        if (layoutMap) {
            const mapped = layoutMap.get(event.code);
            if (mapped)
                return mapped;
        }

        if (event.code.startsWith("Key"))
            return event.code.slice(3).toUpperCase();
        if (event.code.startsWith("Digit"))
            return event.code.slice(5);
        if (event.code === "Space")
            return "Space";

        return event.key;
    }

    function formatShortcutEvent(event: KeyboardEvent) {
        if (event.getModifierState?.("AltGraph"))
            return;

        const parts: string[] = [];
        if (event.ctrlKey)
            parts.push("Ctrl");
        if (event.shiftKey)
            parts.push("Shift");
        if (event.altKey)
            parts.push("Alt");

        let key = event.key;

        if (key === "Control" || key === "Shift" || key === "Alt" || key === "Meta")
            return "";

        key = getKeyLabel(event);

        if (key === "+" || event.code === "NumpadAdd")
            key = "Plus";

        parts.push(key);
        return normalizeShortcut(parts.join("+"));
    }

    function matchesShortcut(combo: string, event: KeyboardEvent) {
        if (!combo)
            return false;

        return normalizeShortcut(combo) === formatShortcutEvent(event);
    }

    function revalidateShortcuts() {
        const newConflicts = new Set<keyof Settings>();
        const shortcutMap = new Map<string, keyof Settings>();

        for (const sKey of shortcutKeys) {
            const value = normalizeShortcut(String(settings[sKey]));
            if (!value) continue;

            if (shortcutMap.has(value)) {
                newConflicts.add(sKey);
                newConflicts.add(shortcutMap.get(value)!);
            } else {
                shortcutMap.set(value, sKey);
            }
        }

        shortcutConflicts.value = newConflicts;
        return newConflicts;
    }

    function trySetShortcut(key: keyof Settings, combo: string) {
        const normalized = normalizeShortcut(combo);
        if (!normalized)
            return { ok: false, conflictKey: null };

        setSetting(key, combo);

        const newConflicts = revalidateShortcuts();

        if (newConflicts.has(key)) {
            const conflictKey = shortcutKeys.find(k => k !== key && normalizeShortcut(String(settings[k])) === normalized);
            return { ok: false, conflictKey: conflictKey || null };
        }

        return { ok: true, conflictKey: null };
    }

    function normalizeValue<K extends keyof Settings>(key: K, value: Settings[K]) {
        if (key === "tagsIgnored") {
            const unique = [...new Set(value as string[])];
            return unique as Settings[K];
        }

        if (key.startsWith("shortcut"))
            return normalizeShortcut(String(value)) as Settings[K];

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

        revalidateShortcuts();
    }

    function redoSettingsAction() {
        const change = settingsRedoStack.value.pop();
        if (!change)
            return;

        settingsUndoStack.value.push(change);

        isApplying.value = true;
        setSetting(change.key, change.value);
        isApplying.value = false;

        revalidateShortcuts();
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
        revalidateShortcuts();

        lastSaved.value = buildSettings();
    }

    async function saveSettings() {
        if (!hasChanges.value || shortcutConflicts.value.size > 0)
            return;

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
        shortcutKeys,
        shortcutConflicts,
        ensureLayoutMap,
        normalizeShortcut,
        formatShortcutEvent,
        matchesShortcut,
        trySetShortcut,
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
