<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { DuplicateService, type DuplicateMethod } from '@/services/duplicateService';
import { FileService } from '@/services/fileService';
import VirtualImage from '@/components/VirtualImage.vue';
import { useIpcRenderer } from '@/composables/useIpcRenderer';

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
const processed = ref(0);
const total = ref(0);
const keepMode = ref(false);
const kept = ref<Set<string>>(new Set());
const trashing = ref(false);

const percent = computed(() => (total.value === 0 ? 0 : Math.round((processed.value / total.value) * 100)));
const isDatasetLoaded = computed(() => datasetStore.images.size > 0);

function resetState() {
  results.value = [];
  errorMessage.value = '';
  loading.value = false;
  processed.value = 0;
  total.value = 0;
  kept.value.clear();
  dims.value = {};
  trashing.value = false;
}

async function scan() {
  if (!isDatasetLoaded.value) {
    emit('trigger_alert', 'error', 'Dataset not loaded');
    return;
  }
  loading.value = true;
  errorMessage.value = '';
  results.value = [];
  processed.value = 0;

  const files = Array.from(datasetStore.images.values()).map((img) => img.path);
  total.value = files.length;

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
    void prefetchDimensions();
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

useIpcRenderer([
  {
    channel: 'duplicate-progress',
    handler: (payload: unknown) => {
      const p = payload as { processed: number; total: number };
      processed.value = p.processed ?? processed.value;
      total.value = p.total ?? total.value;
    },
  },
]);

async function prefetchDimensions() {
  const keys = results.value.flat().filter((k) => !(k in dims.value));
  if (keys.length === 0) return;

  let index = 0;
  const run = async () => {
    while (index < keys.length) {
      const i = index++;
      const key = keys[i];
      const path = datasetStore.images.get(key)?.path;
      if (!path) continue;
      const meta = (await window.ipcRenderer.invoke('get_image_dimensions', path)) as { width: number; height: number };
      if (meta && meta.width && meta.height) {
        dims.value[key] = `${meta.width}x${meta.height}`;
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, run));
}

function toggleKeep(key: string) {
  if (kept.value.has(key)) kept.value.delete(key);
  else kept.value.add(key);
}

async function trashNotKept() {
  const toKeep = kept.value;
  const notKeptKeys = results.value.flatMap((group) => {
    const hasKeptInGroup = group.some((k) => toKeep.has(k));
    if (!hasKeptInGroup) return [] as string[];
    return group.filter((k) => !toKeep.has(k));
  });
  if (notKeptKeys.length === 0) return;
  const paths = notKeptKeys
    .map((k) => datasetStore.images.get(k)?.path)
    .filter((p): p is string => !!p);
  trashing.value = true;
  const { error, message } = await fileService.trashFiles(paths);
  if (error) {
    trashing.value = false;
    emit('trigger_alert', 'error', message || 'Failed to move files to trash');
    return;
  }

  notKeptKeys.forEach((k) => datasetStore.removeImage(k));
  const updated = results.value
    .map((grp) => grp.filter((k) => !notKeptKeys.includes(k)))
    .filter((grp) => grp.length > 1);
  results.value = updated;

  notKeptKeys.forEach((k) => delete dims.value[k]);
  kept.value = new Set([...kept.value].filter((k) => !notKeptKeys.includes(k)));
  trashing.value = false;
  emit('trigger_alert', 'success', `Moved ${paths.length} file(s) to trash`);
}

watch(() => results.value, () => {
  void prefetchDimensions();
});
</script>

<template>
  <input type="checkbox" id="duplicate_finder_modal" class="modal-toggle" />
  <div class="modal" role="dialog">
    <div class="modal-box w-11/12 max-w-5xl h-11/12 max-h-11/12 overflow-y-auto">
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
        <div v-if="loading" class="flex items-center gap-3">
          <progress class="progress progress-primary w-64" :value="processed" :max="total"></progress>
          <span class="text-sm opacity-70">{{ processed }} / {{ total }} ({{ percent }}%)</span>
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
          <div class="flex items-center gap-4">
            <div class="text-sm">Found {{ results.length }} group(s) of duplicates</div>
            <label class="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input type="checkbox" class="checkbox checkbox-sm" v-model="keepMode" />
              <span>Keep mode</span>
            </label>
          </div>
          <div v-for="(group, idx) in results" :key="idx" class="rounded-box border p-2 dark:border-base-content/20" style="content-visibility:auto; contain-intrinsic-size: 200px 200px;">
            <div class="opacity-70 text-sm mb-2">Group {{ idx + 1 }} ({{ group.length }} files)</div>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              <div v-for="key in group" :key="key" class="group relative flex flex-col items-center gap-1">
                <div class="relative w-full h-32 overflow-hidden">
                  <VirtualImage
                    :image="datasetStore.images.get(key)!"
                    :name="key"
                    :selected="false"
                    class="h-full w-full"
                    @click="openFullImage(key)"
                  />
                  <div class="absolute left-1 top-1 rounded px-1 py-0.5 text-xs bg-base-200/80 dark:bg-base-200/80">
                    {{ dims[key] || '' }}
                  </div>
                  <label v-if="keepMode" class="absolute left-1 bottom-1 bg-base-200/70 rounded px-1 py-0.5 cursor-pointer flex items-center gap-1">
                    <input type="checkbox" class="checkbox checkbox-xs" :checked="kept.has(key)" @click.stop="toggleKeep(key)" />
                    <span class="text-xs">Keep</span>
                  </label>
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
          <div v-if="keepMode" class="sticky bottom-0 left-0 right-0 z-10">
            <div class="flex justify-center">
              <button class="btn btn-error no-disabled-opacity" :disabled="trashing" @click="trashNotKept">
                <span v-if="trashing" class="loading loading-spinner mr-1 h-4 w-4"></span>
                <span>{{ trashing ? 'Moving files to trash…' : 'Move files to trash' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    <label class="modal-backdrop"></label>
  </div>
</template>

<style scoped>
.no-disabled-opacity:disabled {
  background-color: color-mix(in oklab, var(--color-base-content) 50%, #000) !important;
}
</style>
