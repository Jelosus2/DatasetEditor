<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { FileService } from '@/services/fileService';
import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useSettingsStore } from '@/stores/settingsStore';

const emit = defineEmits(['trigger_alert']);

const datasetStore = useDatasetStore();
const settingsStore = useSettingsStore();
const fileService = new FileService();

const startNumberInput = ref(1);
const loading = ref(false);
const processed = ref(0);
const total = ref(0);

const percent = computed(() => (total.value === 0 ? 0 : Math.round((processed.value / total.value) * 100)));
const isDatasetLoaded = computed(() => datasetStore.images.size > 0);

function resetState() {
  startNumberInput.value = 1;
  loading.value = false;
  processed.value = 0;
  total.value = 0;
}

useIpcRenderer([
  {
    channel: 'rename-progress',
    handler: (payload: unknown) => {
      const p = payload as { processed: number; total: number };
      processed.value = p.processed ?? processed.value;
      total.value = p.total ?? total.value;
    },
  },
]);

async function beginRenaming() {
  if (!isDatasetLoaded.value) {
    emit('trigger_alert', 'error', 'Dataset not loaded');
    return;
  }

  const startValid = Number.isFinite(startNumberInput.value) && startNumberInput.value >= 1;
  const start = startValid ? startNumberInput.value : 1;

  loading.value = true;
  processed.value = 0;
  total.value = 0;

  const files = Array.from(datasetStore.images.values()).map((img) => img.path);
  if (settingsStore.sortImagesAlphabetically) {
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    files.sort((a, b) => {
      const an = a.split(/[/\\]/).pop()?.toLowerCase() ?? a.toLowerCase();
      const bn = b.split(/[/\\]/).pop()?.toLowerCase() ?? b.toLowerCase();
      return collator.compare(an, bn);
    });
  }

  try {
    const { error, message, renamed, mappings } = await fileService.renameFiles(files, start);
    if (mappings && mappings.length) {
      datasetStore.renameImages(mappings);
    }
    if (error) {
      emit('trigger_alert', 'error', message || 'Failed to rename files, check the logs for more information.');
    } else {
      emit('trigger_alert', 'success', `Renamed ${renamed ?? 0} file(s)`);
    }
  } catch (e) {
    emit('trigger_alert', 'error', `Failed to rename files: ${(e as Error).message}`);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <input type="checkbox" id="rename_files_modal" class="modal-toggle" />
  <div class="modal" role="dialog">
    <div class="modal-box w-11/12 max-w-xl">
      <label for="rename_files_modal" class="absolute right-2 top-1 cursor-pointer" @click="resetState">✕</label>
      <div class="flex flex-col gap-4">
        <div class="flex items-center justify-between border-b-2 pb-2 dark:border-base-content/10">
          <div class="text-lg font-semibold">Rename Files</div>
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm opacity-80">Starting number (optional)</label>
          <input
            v-model.number="startNumberInput"
            type="number"
            min="1"
            class="input input-bordered input-sm w-full !outline-none"
            placeholder="1"
          />
          <div class="alert alert-info py-2 px-3 text-sm">
            If left blank, numbering starts from 1.
          </div>
        </div>
        <div v-if="loading" class="flex items-center gap-3">
          <progress class="progress progress-primary w-64" :value="processed" :max="total"></progress>
          <span class="text-sm opacity-70">{{ processed }} / {{ total }} ({{ percent }}%)</span>
        </div>
        <div class="flex items-center justify-end gap-2">
          <button class="btn btn-sm" :disabled="loading" @click="resetState">Reset</button>
          <button class="btn btn-primary btn-sm" :disabled="!isDatasetLoaded || loading" @click="beginRenaming">
            <span v-if="loading" class="loading loading-spinner mr-1 h-4 w-4"></span>
            <span>{{ loading ? 'Renaming…' : 'Begin renaming' }}</span>
          </button>
        </div>
      </div>
    </div>
    <label class="modal-backdrop"></label>
  </div>
</template>
