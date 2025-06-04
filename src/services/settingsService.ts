import type { Settings } from '@/stores/settingsStore';
import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useLogStore } from '@/stores/logStore';

export class SettingsService {
  private ipc = useIpcRenderer([]);
  private logStore = useLogStore();

  async loadSettings() {
    this.logStore.addLog('info', 'Loading settings');
    const res = await this.ipc.invoke<Settings | null>('load_settings');
    this.logStore.addLog('info', 'Settings loaded');
    return res;
  }

  async saveSettings(settings: Settings) {
    return this.ipc.invoke('save_settings', settings);
  }

  async compareSettingsChanges(settings: Settings) {
    return this.ipc.invoke<boolean>('compare_settings_changes', settings);
  }

  async changeAutocompleteFile() {
    this.logStore.addLog('info', 'Changing autocomplete file');
    const res = await this.ipc.invoke<string | null>('change_autotag_file');
    this.logStore.addLog('info', 'Autocomplete file changed');
    return res;
  }
}
