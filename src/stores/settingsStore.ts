import { defineStore } from 'pinia';
import { ref, toRaw } from 'vue';

interface Settings {
  showTagCount: boolean;
  theme: string;
  autocomplete: boolean;
  autocompleteFile: string;
  tagsIgnored: string[];
}

export const useSettingsStore = defineStore('settings', () => {
  const showTagCount = ref<boolean>(false);
  const theme = ref<string>('auto');
  const autocomplete = ref<boolean>(true);
  const autocompleteFile = ref<string>('');
  const tagsIgnored = ref<string[]>([]);

  async function loadSettings() {
    const settings = (await window.ipcRenderer.invoke('load_settings')) as Settings;
    theme.value = settings.theme;
    showTagCount.value = settings.showTagCount;
    autocomplete.value = settings.autocomplete;
    autocompleteFile.value = settings.autocompleteFile;
    tagsIgnored.value = settings.tagsIgnored;
  }

  async function saveSettings() {
    await window.ipcRenderer.invoke('save_settings', {
      showTagCount: toRaw(showTagCount.value),
      theme: toRaw(theme.value),
      autocomplete: toRaw(autocomplete.value),
      autocompleteFile: toRaw(autocompleteFile.value),
      tagsIgnored: toRaw(tagsIgnored.value),
    });
  }

  function loadTheme(th?: string) {
    const app = document.querySelector('html') as HTMLElement;

    if (th) {
      app.dataset.theme = th;
      theme.value = th;
    } else if (theme.value === 'auto') {
      th = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'winter';
      app.dataset.theme = th;
      theme.value = th;
    } else {
      app.dataset.theme = theme.value;
    }
  }

  async function changeAutocompleteFile() {
    const filePath = (await window.ipcRenderer.invoke('change_autotag_file')) as string | null;
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
    loadSettings,
    saveSettings,
    loadTheme,
    changeAutocompleteFile,
  };
});
