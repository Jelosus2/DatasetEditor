import { onMounted, onUnmounted } from 'vue';
import { useLogStore } from '@/stores/logStore';

export interface IpcListener {
  channel: string;
  handler: (...args: unknown[]) => void;
}

export function useIpcRenderer(listeners: IpcListener[]) {
  const logStore = useLogStore();

  onMounted(() => {
    listeners.forEach(({ channel, handler }) => {
      window.ipcRenderer.receive(channel, handler);
    });
    window.ipcRenderer.receive('app-log', (entry: { type: 'info' | 'warning' | 'error'; message: string }) => {
      logStore.addLog(entry.type, entry.message);
    });
  });

  onUnmounted(() => {
    listeners.forEach(({ channel }) => {
      window.ipcRenderer.unsubscribe(channel);
    });
    window.ipcRenderer.unsubscribe('app-log');
  });

  const invoke = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
    return window.ipcRenderer.invoke(channel, ...args) as T;
  }

  const send = (channel: string, ...args: unknown[]) => {
    window.ipcRenderer.send(channel, ...args);
  }

  return { invoke, send };
}
