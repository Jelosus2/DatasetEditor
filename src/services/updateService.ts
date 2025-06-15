import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useLogStore } from '@/stores/logStore';

export class UpdateService {
  private ipc = useIpcRenderer([]);
  private logStore = useLogStore();

  async checkForUpdates(): Promise<null | { updateInfo: { version: string } }> {
    this.logStore.addLog('info', 'Checking for updates');
    return this.ipc.invoke('check_for_updates');
  }

  async downloadUpdate() {
    this.logStore.addLog('info', 'Downloading update');
    return this.ipc.invoke('download_update');
  }

  installUpdate() {
    this.logStore.addLog('info', 'Installing update');
    this.ipc.invoke('install_update');
  }

  async areUpdatesAvailable() {
    return this.ipc.invoke<boolean>('are_updates_available');
  }
}
