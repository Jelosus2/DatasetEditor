import type { LogEntry } from "@/types/log";

import { UtilitiesService } from "@/services/utilitiesService";
import { defineStore } from "pinia";
import { ref } from "vue";

export const useLogStore = defineStore("logs", () => {
    const logs = ref<LogEntry[]>([]);

    const utilitiesService = new UtilitiesService();

    function addLog(type: LogEntry["type"], message: LogEntry["message"]) {
        logs.value.push({ timestamp: new Date(), type, message });
    }

    function clearLogs() {
        logs.value = [];
    }

    function openUrl(url: string) {
        utilitiesService.openUrlInBrowser(url);
    }

    return { logs, addLog, clearLogs, openUrl };
});
