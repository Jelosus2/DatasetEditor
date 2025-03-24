<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const generalThreshold = ref(0.25);
const characterThreshold = ref(0.35);
const removeUnderscores = ref(true);
const selectedModels = ref<string[]>([]);
const device = ref('');
const taggerLogs = ref<string[]>([]);
const isTaggerRunning = ref(false);

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

onMounted(() => {
  window.ipcRenderer.receive('tagger-output', async (output: string) => {
    if (output === 'Tagger running') {
      device.value = (
        await (await fetch('http://localhost:3067/device', { method: 'POST' })).json()
      ).device;
      isTaggerRunning.value = true;
    }

    taggerLogs.value.push(output);
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
        <div class="mockup-code h-full w-full overflow-auto">
          <pre v-for="log in taggerLogs" :key="log"><code>{{ log }}</code></pre>
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
        </div>
        <div class="mt-0 flex gap-2">
          <button class="btn btn-outline btn-success" :disabled="isTaggerRunning">
            Start Autotagger
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
