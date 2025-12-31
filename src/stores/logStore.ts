import type { LogEntry } from "@/types/log";

import { defineStore } from "pinia";
import { ref } from "vue";

export const useLogStore = defineStore("logs", () => {
    const logs = ref<LogEntry[]>([]);

    function addLog(type: LogEntry["type"], message: LogEntry["message"]) {
        logs.value.push({ timestamp: new Date(), type, message });
    }

    function clearLogs() {
        logs.value = [];
    }

    return { logs, addLog, clearLogs };
});
