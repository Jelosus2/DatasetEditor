<script setup lang="ts">
import { onMounted, watch, nextTick, ref } from 'vue';
import { useLogStore } from '@/stores/logStore';

import GithubIcon from '@/assets/icons/github.svg';
import DownloadIcon from '@/assets/icons/download.svg';

const logsContainer = ref<HTMLDivElement | null>(null);
const logStore = useLogStore();

function formatTime(date: Date) {
  return date.toTimeString().split(' ')[0];
}

function scrollToBottom() {
  if (logsContainer.value) {
    logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
  }
}

onMounted(scrollToBottom);

watch(
  () => logStore.logs.length,
  async () => {
    await nextTick();
    scrollToBottom();
  }
);

function openIssuesPage() {
  window.ipcRenderer.invoke('open-url', 'https://github.com/Jelosus2/DatasetEditor/issues');
}

function exportLogs() {
  const content = logStore.logs
    .map(l => `${formatTime(l.timestamp)} [${l.type.toUpperCase()}] ${l.message}`)
    .join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'logs.txt';
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <input type="radio" name="editor_tabs" class="tab" aria-label="Logs" />

  <div class="tab-content border-t-base-300 bg-base-100 h-full p-4">
    <div
      ref="logsContainer"
      class="h-full flex flex-col rounded-box bg-base-300 font-mono"
    >
      <div class="flex shrink-0 justify-end gap-2 p-2 border-b-1">
        <a
          class="btn btn-square btn-ghost btn-sm"
          @click.prevent="openIssuesPage"
        >
          <GithubIcon class="h-5 w-5" />
        </a>
        <button
          class="btn btn-square btn-ghost btn-sm"
          @click="exportLogs"
        >
          <DownloadIcon class="h-5 w-5" />
        </button>
      </div>
      <div class="flex-1 overflow-auto p-4">
        <div v-for="(log, idx) in logStore.logs" :key="idx">
          <div class="break-words whitespace-pre-wrap">
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
