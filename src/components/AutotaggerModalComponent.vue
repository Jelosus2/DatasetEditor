<script setup lang="ts">
import { ref, shallowRef, onMounted, onUnmounted, nextTick, toRaw } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';

const emit = defineEmits(['trigger_alert']);

const generalThreshold = ref(0.25);
const characterThreshold = ref(0.35);
const removeUnderscores = ref(true);
const selectedModels = ref<string[]>([]);
const device = ref('');
const taggerLogs = ref<string[]>([]);
const isTaggerRunning = ref(false);
const isInstalling = ref(false);
const isTagging = ref(false);
const logsContainer = shallowRef<HTMLDivElement | null>(null);

const datasetStore = useDatasetStore();

const taggerModels = [
  'wd-eva02-large-tagger-v3',
  'wd-vit-large-tagger-v3',
  'wd-swinv2-tagger-v3',
  'wd-vit-tagger-v3',
  'wd-convnext-tagger-v3',
  'wd-v1-4-swinv2-tagger-v2',
  'wd-v1-4-moat-tagger-v2',
  'wd-v1-4-convnext-tagger-v2',
  'wd-v1-4-vit-tagger-v2',
  'wd-v1-4-convnextv2-tagger-v2',
  'wd-v1-4-convnext-tagger',
  'wd-v1-4-vit-tagger',
];

async function startAutotagger() {
  if (isTaggerRunning.value) return;

  taggerLogs.value = [];
  taggerLogs.value.push('Starting autotagger...');
  isTaggerRunning.value = true;

  const active = await window.ipcRenderer.invoke('start_tagger_service');
  if (!active) {
    taggerLogs.value.push('Autotagger failed to start');
    isInstalling.value = false;
    isTaggerRunning.value = false;
  }
}

async function stopAutotagger() {
  if (!isTaggerRunning.value) return;
  taggerLogs.value.push('Stopping autotagger...');
  await window.ipcRenderer.invoke('stop_tagger_service');
  isTaggerRunning.value = false;
  device.value = '';
  taggerLogs.value.push('Autotagger stopped');
}

async function autoTagImages(type: 'insert' | 'diff') {
  if (!taggerLogs.value.includes('Tagger running')) return;
  if (!datasetStore.images.size) {
    emit('trigger_alert', 'error', 'Dataset not loaded');
    return;
  }
  if (!selectedModels.value.length) {
    emit('trigger_alert', 'error', 'No tagger model selected');
    return;
  }

  const images = [...datasetStore.images.values()].map((image) => image.path);
  isTagging.value = true;
  const results = (await window.ipcRenderer.invoke('tag_images', {
    images,
    generalThreshold: toRaw(generalThreshold.value),
    characterThreshold: toRaw(characterThreshold.value),
    removeUnderscores: toRaw(removeUnderscores.value),
    selectedModels: toRaw(selectedModels.value),
  })) as Map<string, Set<string>>;

  if (type === 'insert') {
    insertTags(results);
  } else {
    loadDiff(results);
  }
}

function insertTags(tags: Map<string, Set<string>>) {
  datasetStore.globalTags = new Map();
  for (const [image, tagsToInsert] of tags.entries()) {
    if (!datasetStore.images.has(image)) continue;
    datasetStore.images.get(image)!.tags = tagsToInsert;

    for (const tag of tagsToInsert) {
      if (!datasetStore.globalTags.has(tag)) {
        datasetStore.globalTags.set(tag, new Set([image]));
      } else {
        datasetStore.globalTags.get(tag)!.add(image);
      }
    }
  }

  datasetStore.onChange.forEach((fn) => fn());
  isTagging.value = false;
}

function loadDiff(tags: Map<string, Set<string>>) {
  for (const [image, tagsToInsert] of tags.entries()) {
    if (!datasetStore.images.has(image)) continue;

    const taggerTags: Set<string> = new Set();
    const imageTags = [...datasetStore.images.get(image)!.tags];

    for (const tag of tagsToInsert.values()) {
      if (!imageTags.includes(tag)) taggerTags.add(tag);
    }

    const originalTags: Set<string> = new Set(imageTags.filter((tag) => !tagsToInsert.has(tag)));

    datasetStore.tagDiff.set(image, {
      tagger: taggerTags,
      original: originalTags,
    });
  }
}

function scrollToBottom() {
  if (!logsContainer.value) return;
  logsContainer.value.scrollTop = logsContainer.value.scrollHeight;
}

onMounted(() => {
  window.ipcRenderer.receive('tagger-output', async (output: string) => {
    if (output === 'Tagger running') {
      device.value = (await window.ipcRenderer.invoke('get_tagger_device')) as string;
      isInstalling.value = false;
    }
    if (output === 'Creating virtual environment...') isInstalling.value = true;
    taggerLogs.value.push(output);

    await nextTick();
    scrollToBottom();
  });
});

onUnmounted(() => {
  window.ipcRenderer.unsubscribe('tagger-output');
});
</script>

<template>
  <input type="checkbox" id="autotagger_modal" class="modal-toggle" />
  <div class="modal" role="dialog">
    <div class="modal-box w-11/12 max-w-5xl">
      <label for="autotagger_modal" class="absolute top-1 right-2 cursor-pointer">✕</label>
      <div class="flex h-[500px] gap-3">
        <ul class="list min-w-fit overflow-auto shadow-md">
          <li class="pt-2 pb-2 pl-2 text-xs tracking-wide opacity-60">Autotagger models</li>
          <li v-for="model in taggerModels" :key="model" class="list-row items-center gap-2 p-2">
            <div>
              <input
                type="checkbox"
                class="checkbox checkbox-sm"
                :value="model"
                v-model="selectedModels"
              />
            </div>
            <div>
              <div>{{ model }}</div>
            </div>
          </li>
        </ul>
        <div ref="logsContainer" class="mockup-code h-full w-full overflow-auto pl-5">
          <pre
            v-for="log in taggerLogs"
            :key="log"
            class="before:hidden"
          ><code>{{ log }}</code></pre>
        </div>
      </div>
      <div class="flex items-center pt-4">
        <div class="flex flex-1 gap-4">
          <div class="w-45">
            <div class="flex text-xs">
              <div class="tracking-wide opacity-60">General threshold:</div>
              <span class="pl-1">{{ generalThreshold }}</span>
            </div>
            <input
              v-model="generalThreshold"
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              class="range w-full [--range-fill:0] [--range-thumb:var(--color-base-100)] range-xs"
            />
            <div class="flex items-center gap-2 pt-2">
              <input v-model="removeUnderscores" type="checkbox" class="checkbox checkbox-xs" />
              <span class="text-xs">Remove underscores</span>
            </div>
          </div>
          <div class="w-45">
            <div class="flex text-xs">
              <div class="tracking-wide opacity-60">Character threshold:</div>
              <span class="pl-1">{{ characterThreshold }}</span>
            </div>
            <input
              v-model="characterThreshold"
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              class="range w-full [--range-fill:0] [--range-thumb:var(--color-base-100)] range-xs"
            />
            <div class="flex items-center gap-2 pt-2 text-sm">
              <div class="tracking-wide opacity-60">Autotagger Device:</div>
              <span>{{ device }}</span>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <button
              class="btn btn-sm btn-info"
              :disabled="isTagging || !isTaggerRunning || isInstalling"
              @click="autoTagImages('insert')"
            >
              Tag Images & Apply Tags
            </button>
            <button
              class="btn btn-sm btn-info"
              :disabled="isTagging || !isTaggerRunning || isInstalling"
              @click="autoTagImages('diff')"
            >
              Tag Images & Load Diff
            </button>
          </div>
        </div>
        <div class="mt-0 flex gap-2">
          <button
            class="btn btn-outline btn-success"
            :disabled="isTaggerRunning || isInstalling"
            @click="startAutotagger"
          >
            Start
          </button>
          <button
            class="btn btn-outline btn-info"
            :disabled="!isTaggerRunning || isInstalling"
            @click="((isTaggerRunning = false), startAutotagger())"
          >
            Restart
          </button>
          <button
            class="btn btn-outline btn-error"
            :disabled="!isTaggerRunning || isInstalling"
            @click="stopAutotagger"
          >
            Stop
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
