import type { Settings } from '@/stores/settingsStore';
import { useIpcRenderer } from '@/composables/useIpcRenderer';

export class SettingsService {
  private ipc = useIpcRenderer([]);

  async loadSettings() {
    return this.ipc.invoke<Settings | null>('load_settings');
  }

  async saveSettings(settings: Settings) {
    return this.ipc.invoke('save_settings', settings);
  }

  async compareSettingsChanges(settings: Settings) {
    return this.ipc.invoke<boolean>('compare_settings_changes', settings);
  }

  async changeAutocompleteFile() {
    return this.ipc.invoke<string | null>('change_autotag_file');
  }
}
