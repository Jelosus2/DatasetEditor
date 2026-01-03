<script setup lang="ts">
import { useLogStore } from "@/stores/logStore";
import { onMounted, watch, nextTick, ref, computed, reactive } from "vue";

import GithubIcon from "@/assets/icons/github.svg";
import DownloadIcon from "@/assets/icons/download.svg";

const logsContainer = ref<HTMLDivElement | null>(null);
const query = ref("");

const filters = reactive({
    info: true,
    warning: true,
    error: true
});

const filteredLogs = computed(() => {
    const santizedQuery = query.value.trim().toLowerCase();

    return logStore.logs.filter((log) => {
        if (!filters[log.type])
            return false;
        if (!santizedQuery)
            return true;

        return log.message.toLowerCase().includes(santizedQuery);
    });
});

const logStore = useLogStore();

watch(() => logStore.logs.length, async () => {
    await nextTick();
    scrollToBottom();
});

function formatTime(date: Date) {
    return date.toTimeString().split(" ")[0];
}

function scrollToBottom() {
    if (logsContainer.value)
        logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
}

function openIssuesPage() {
    logStore.openUrl("https://github.com/Jelosus2/DatasetEditor/issues");
}

function exportLogs() {
    const content = filteredLogs.value
        .map(log => `${formatTime(log.timestamp)} [${log.type.toUpperCase()}] ${log.message}`)
        .join("\n");

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

onMounted(scrollToBottom);
</script>

<template>
    <div class="tab-content min-h-0 border-t-base-300 bg-base-100 p-4">
        <div ref="logsContainer" class="h-full flex flex-col rounded-box bg-base-300 font-mono">
            <div class="flex flex-wrap items-center justify-between gap-2 p-2 border-b">
                <div class="flex items-center gap-2">
                    <input
                        class="input input-sm w-70 outline-none!"
                        placeholder="Search logs..."
                        v-model="query"
                    />
                    <button
                        class="btn btn-sm"
                        :class="filters.info ? 'btn-info' : 'btn-outline'"
                        @click="filters.info = !filters.info"
                    >
                        Info
                    </button>
                    <button
                        class="btn btn-sm"
                        :class="filters.warning ? 'btn-warning' : 'btn-outline'"
                        @click="filters.warning = !filters.warning"
                    >
                        Warning
                    </button>
                    <button
                        class="btn btn-sm"
                        :class="filters.error ? 'btn-error' : 'btn-outline'"
                        @click="filters.error = !filters.error"
                    >
                        Error
                    </button>
                </div>
                <div class="flex items-center gap-2">
                    <button class="btn btn-error btn-outline btn-sm" @click="logStore.clearLogs()">
                        Clear Logs
                    </button>
                    <button class="btn btn-square btn-outline btn-sm" @click.prevent="openIssuesPage">
                        <GithubIcon class="h-5 w-5" />
                    </button>
                    <button class="btn btn-square btn-accent btn-outline btn-sm" :disabled="filteredLogs.length === 0" @click="exportLogs">
                        <DownloadIcon class="h-5 w-5" />
                    </button>
                </div>
            </div>
            <div class="flex-1 overflow-auto p-4">
                <div v-for="(log, index) in filteredLogs" :key="index">
                    <div class="wrap-break-word whitespace-pre-wrap">
                        {{ formatTime(log.timestamp) }}
                        [<span :class="{
                        'text-blue-500': log.type === 'info',
                        'text-yellow-500': log.type === 'warning',
                        'text-red-500': log.type === 'error'
                        }">
                            {{ log.type.toUpperCase() }}
                        </span>] {{ log.message }}
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
