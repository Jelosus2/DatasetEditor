<script setup lang="ts">
import { onMounted, watch, nextTick, ref } from 'vue';
import { useLogStore } from '@/stores/logStore';

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
          <svg class="h-5 w-5" viewBox="0 0 16 16" fill="currentColor"
               xmlns="http://www.w3.org/2000/svg">
            <path
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
                 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
                 -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66
                 .07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
                 -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.51 7.51 0 0 1 4 0c1.53-1.03
                 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87
                 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46
                 .55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
        </a>
        <button
          class="btn btn-square btn-ghost btn-sm"
          @click="exportLogs"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24"
               xmlns="http://www.w3.org/2000/svg">
            <path d="M12 5v14m0 0l-3-3m3 3l3-3"
              stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M5 19h14"
              stroke="currentColor" stroke-width="2"
              stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
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
