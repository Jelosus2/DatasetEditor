import { onMounted, onUnmounted } from 'vue';
import { useLogStore } from '@/stores/logStore';

export interface IpcListener {
  channel: string;
  handler: (...args: unknown[]) => void;
}

let subscribedToLogs = false;

export function useIpcRenderer(listeners: IpcListener[]) {
  const logStore = useLogStore();

  onMounted(() => {
    listeners.forEach(({ channel, handler }) => {
      window.ipcRenderer.receive(channel, handler);
    });
    if (!subscribedToLogs) {
      console.log('hello')
      window.ipcRenderer.receive('app-log', (entry: { type: 'info' | 'warning' | 'error'; message: string }) => {
        logStore.addLog(entry.type, entry.message);
      });
      subscribedToLogs = true;
    }
  });

  onUnmounted(() => {
    listeners.forEach(({ channel }) => {
      window.ipcRenderer.unsubscribe(channel);
    });
    if (subscribedToLogs) {
      console.log('unsubs')
      window.ipcRenderer.unsubscribe('app-log');
      subscribedToLogs = false;
    }
  });

  const invoke = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
    return window.ipcRenderer.invoke(channel, ...args) as T;
  }

  const send = (channel: string, ...args: unknown[]) => {
    window.ipcRenderer.send(channel, ...args);
  }

  return { invoke, send };
}
