import { defineStore } from 'pinia';
import { ref, toRaw, watch, type Ref } from 'vue';
import { SettingsService } from '@/services/settingsService';

export interface Settings {
  showTagCount: boolean;
  theme: string;
  autocomplete: boolean;
  autocompleteFile: string;
  tagsIgnored: string[];
  taggerPort: number;
}

interface SettingsChangeRecord {
  key: keyof Settings;
  previous: Settings[keyof Settings];
  value: Settings[keyof Settings];
}

export const useSettingsStore = defineStore('settings', () => {
  const showTagCount = ref<boolean>(false);
  const theme = ref<string>('dark');
  const autocomplete = ref<boolean>(true);
  const autocompleteFile = ref<string>('');
  const tagsIgnored = ref<string[]>([]);
  const taggerPort = ref<number>(3067);
  const settingsUndoStack = ref<SettingsChangeRecord[]>([]);
  const settingsRedoStack = ref<SettingsChangeRecord[]>([]);
  const isInitialized = ref(false);
  const settingsService = new SettingsService();
  const settingsMap: Record<keyof Settings, Ref<Settings[keyof Settings]>> = {
    showTagCount,
    theme,
    autocomplete,
    autocompleteFile,
    tagsIgnored,
    taggerPort,
  };

  function pushSettingsChange(change: SettingsChangeRecord) {
    settingsUndoStack.value.push(change);
    settingsRedoStack.value = [];
  }

  function undoSettingsAction() {
    const change = settingsUndoStack.value.pop();
    if (!change) return;

    settingsRedoStack.value.push(change);
    isInitialized.value = false;
    settingsMap[change.key].value = change.previous as Settings[keyof Settings];

    if (change.key === 'theme') loadTheme(theme.value);
    setTimeout(() => isInitialized.value = true, 0);
  }

  function redoSettingsAction() {
    const change = settingsRedoStack.value.pop();
    if (!change) return;

    settingsUndoStack.value.push(change);
    isInitialized.value = false;
    settingsMap[change.key].value = change.value as Settings[keyof Settings];

    if (change.key === 'theme') loadTheme(theme.value);
    setTimeout(() => isInitialized.value = true, 0);
  }

  function resetSettingsStatus() {
    settingsUndoStack.value = [];
    settingsRedoStack.value = [];
  }

  watch(showTagCount, (newVal, oldVal) => {
    if (!isInitialized.value) return;
    pushSettingsChange({ key: 'showTagCount', previous: oldVal, value: newVal });
  });

  watch(theme, (newVal, oldVal) => {
    if (!isInitialized.value) return;
    pushSettingsChange({ key: 'theme', previous: oldVal, value: newVal });
  });

  watch(autocomplete, (newVal, oldVal) => {
    if (!isInitialized.value) return;
    pushSettingsChange({ key: 'autocomplete', previous: oldVal, value: newVal });
  });

  watch(autocompleteFile, (newVal, oldVal) => {
    if (!isInitialized.value) return;
    pushSettingsChange({ key: 'autocompleteFile', previous: oldVal, value: newVal });
  });

  watch(tagsIgnored, (newVal, oldVal) => {
    if (!isInitialized.value) return;
    pushSettingsChange({ key: 'tagsIgnored', previous: [...oldVal], value: [...newVal] });
  });

  watch(taggerPort, (newVal, oldVal) => {
    if (!isInitialized.value) return;
    pushSettingsChange({ key: 'taggerPort', previous: oldVal, value: newVal });
  });

  async function loadSettings() {
    isInitialized.value = false;
    const settings = (await settingsService.loadSettings()) as Settings;
    theme.value = settings.theme ?? theme.value;
    showTagCount.value = settings.showTagCount ?? showTagCount.value;
    autocomplete.value = settings.autocomplete ?? autocomplete.value;
    autocompleteFile.value = settings.autocompleteFile ?? autocompleteFile.value;
    tagsIgnored.value = settings.tagsIgnored ?? tagsIgnored.value;
    taggerPort.value = settings.taggerPort ?? taggerPort.value;
    resetSettingsStatus();
    isInitialized.value = true;
  }

  async function saveSettings() {
    await settingsService.saveSettings({
      showTagCount: toRaw(showTagCount.value),
      theme: toRaw(theme.value),
      autocomplete: toRaw(autocomplete.value),
      autocompleteFile: toRaw(autocompleteFile.value),
      tagsIgnored: toRaw(tagsIgnored.value),
      taggerPort: toRaw(taggerPort.value),
    });
    resetSettingsStatus();
  }

  async function areSettingsSaved() {
    return settingsService.compareSettingsChanges({
      showTagCount: toRaw(showTagCount.value),
      theme: toRaw(theme.value),
      autocomplete: toRaw(autocomplete.value),
      autocompleteFile: toRaw(autocompleteFile.value),
      tagsIgnored: toRaw(tagsIgnored.value),
      taggerPort: toRaw(taggerPort.value),
    });
  }

  function loadTheme(th?: string) {
    const app = document.documentElement;
    app.dataset.theme = th || theme.value;
    if (th) theme.value = th;
  }

  async function changeAutocompleteFile() {
    const filePath = (await settingsService.changeAutocompleteFile()) as string | null;
    if (filePath) {
      autocompleteFile.value = filePath;
      await saveSettings();
    }
  }

  return {
    showTagCount,
    theme,
    autocomplete,
    autocompleteFile,
    tagsIgnored,
    taggerPort,
    undoSettingsAction,
    redoSettingsAction,
    loadSettings,
    saveSettings,
    areSettingsSaved,
    loadTheme,
    changeAutocompleteFile,
  };
});
