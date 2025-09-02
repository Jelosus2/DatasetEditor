<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { DuplicateService, type DuplicateMethod } from '@/services/duplicateService';
import { FileService } from '@/services/fileService';

import TrashBinIcon from '@/assets/icons/trash-bin.svg';

const emit = defineEmits(['trigger_alert']);

const datasetStore = useDatasetStore();
const service = new DuplicateService();
const fileService = new FileService();

const method = ref<DuplicateMethod>('dhash');
const loading = ref(false);
const results = ref<string[][]>([]);
const errorMessage = ref('');
const threshold = ref(10);
const dims = ref<Record<string, string>>({});

const isDatasetLoaded = computed(() => datasetStore.images.size > 0);

function resetState() {
  results.value = [];
  errorMessage.value = '';
  loading.value = false;
}

async function scan() {
  if (!isDatasetLoaded.value) {
    emit('trigger_alert', 'error', 'Dataset not loaded');
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  results.value = [];

  const files = Array.from(datasetStore.images.values()).map((img) => img.path);
  const pathToKey = new Map<string, string>();
  for (const [key, img] of datasetStore.images.entries()) {
    pathToKey.set(img.path, key);
  }

  try {
    const { error, message, groups } = await service.findDuplicates(files, method.value, threshold.value);
    if (error) {
      errorMessage.value = message || 'Failed to find duplicates, check the logs for more information.';
      emit('trigger_alert', 'error', errorMessage.value);
      return;
    }

    const mapped = groups
      .map((grp) => grp.map((p) => pathToKey.get(p)).filter((v): v is string => !!v))
      .filter((grp) => grp.length > 1);
    results.value = mapped;

    emit('trigger_alert', 'success', mapped.length ? `Found ${mapped.length} duplicate group(s)` : 'No duplicates found');
  } catch (e) {
    errorMessage.value = `Failed to find duplicates: ${(e as Error).message}`;
    emit('trigger_alert', 'error', errorMessage.value);
  } finally {
    loading.value = false;
  }
}

function openFullImage(key: string) {
  window.dispatchEvent(new CustomEvent('open-image', { detail: key }));
}

async function trashImage(key: string) {
  const path = datasetStore.images.get(key)?.path;
  if (!path) return;
  const { error, message } = await fileService.trashFiles([path]);
  if (error) {
    emit('trigger_alert', 'error', message);
    return;
  }

  datasetStore.removeImage(key);

  const updated = results.value
    .map((grp) => grp.filter((k) => k !== key))
    .filter((grp) => grp.length > 1);
  results.value = updated;

  emit('trigger_alert', 'success', 'File moved to trash');
}

function onImageLoad(key: string, e: Event) {
  const el = e.target as HTMLImageElement;
  if (!el) return;
  dims.value[key] = `${el.naturalWidth}x${el.naturalHeight}`;
}
</script>

<template>
  <input type="checkbox" id="duplicate_finder_modal" class="modal-toggle" />
  <div class="modal" role="dialog">
    <div class="modal-box w-11/12 max-w-5xl h-11/12 max-h-11/12">
      <label for="duplicate_finder_modal" class="absolute right-2 top-1 cursor-pointer" @click="resetState">✕</label>
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between border-b-2 pb-2 dark:border-base-content/10">
          <div class="flex items-center gap-3">
            <span class="text-sm opacity-70">Method:</span>
            <select v-model="method" class="select select-sm w-fit !outline-none">
              <option value="phash">Perceptual (robust)</option>
              <option value="dhash">Perceptual (fast)</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <button class="btn btn-sm" :disabled="results.length === 0 || loading" @click="resetState">Reset</button>
            <button class="btn btn-primary btn-sm" :disabled="!isDatasetLoaded || loading" @click="scan">
              <span v-if="loading" class="loading loading-spinner mr-1 h-4 w-4"></span>
              <span>{{ loading ? 'Scanning…' : 'Scan' }}</span>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-sm opacity-70">Similarity threshold:</span>
          <input type="range" class="range range-xs w-64" min="0" max="64" step="1" v-model.number="threshold" />
          <span class="text-sm">{{ threshold }}</span>
          <span class="text-xs opacity-60">(0 exact – 64 very loose)</span>
        </div>

        <div v-if="!isDatasetLoaded" class="flex items-center justify-center bg-warning/20 p-3 rounded">
          <span>Dataset not loaded. Load a dataset to search for duplicates.</span>
        </div>

        <div v-if="errorMessage" class="flex items-center justify-center bg-error font-bold p-2 rounded">
          <span>{{ errorMessage }}</span>
        </div>

        <div v-if="!loading && results.length === 0 && isDatasetLoaded" class="text-center opacity-70">
          <span>No results yet. Click Scan to start.</span>
        </div>

        <div v-if="results.length > 0" class="flex flex-col gap-4">
          <div class="text-sm">Found {{ results.length }} group(s) of duplicates</div>
          <div v-for="(group, idx) in results" :key="idx" class="rounded-box border p-2 dark:border-base-content/20">
            <div class="opacity-70 text-sm mb-2">Group {{ idx + 1 }} ({{ group.length }} files)</div>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              <div v-for="key in group" :key="key" class="group relative flex flex-col items-center gap-1">
                <div class="relative w-full">
                  <img
                    :src="datasetStore.images.get(key)?.filePath"
                    class="h-32 w-full cursor-pointer object-contain border rounded"
                    @click="openFullImage(key)"
                    @load="onImageLoad(key, $event)"
                  />
                  <div class="absolute left-1 top-1 rounded px-1 py-0.5 text-xs bg-base-200/80 dark:bg-base-200/80">
                    {{ dims[key] || '' }}
                  </div>
                  <button
                    class="absolute right-1 top-1 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 bg-base-200/80 hover:bg-error"
                    title="Move to trash"
                    @click.stop="trashImage(key)"
                  >
                    <TrashBinIcon />
                  </button>
                </div>
                <div class="w-full truncate text-xs" :title="key.split('/').pop()">{{ key.split('/').pop() }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <label class="modal-backdrop"></label>
  </div>
</template>
