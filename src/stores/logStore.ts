import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface LogEntry {
  timestamp: Date;
  type: 'info' | 'warning' | 'error';
  message: string;
}

export const useLogStore = defineStore('logs', () => {
  const logs = ref<LogEntry[]>([]);

  function addLog(type: LogEntry['type'], message: string) {
    logs.value.push({ timestamp: new Date(), type, message });
  }

  function clearLogs() {
    logs.value = [];
  }

  return { logs, addLog, clearLogs };
});
