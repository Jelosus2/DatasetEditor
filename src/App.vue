<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import MainComponent from '@/components/MainComponent.vue';

import { ref, onMounted, onUnmounted } from 'vue';
import { useHistoryStore } from './stores/historyStore';

const imagesRef = ref<Map<string, { tags: Set<string>; path: string }>>(new Map());
const globalTagsRef = ref<Map<string, Set<string>>>(new Map());
const os = ref('');
const theme = ref('');
const arePreviewsEnabled = ref(false);

const historyStore = useHistoryStore();

async function loadDataset() {
  const dataset = (await window.ipcRenderer.invoke('load_dataset')) as {
    images: Map<string, { tags: Set<string>; path: string }>;
    globalTags: Map<string, Set<string>>;
  };

  if (!dataset) return;

  console.log(dataset.images, dataset.globalTags);

  imagesRef.value = dataset.images;
  globalTagsRef.value = dataset.globalTags;
}

function undoAction() {
  historyStore.undo(imagesRef, globalTagsRef);
}

function redoAction() {
  historyStore.redo(imagesRef, globalTagsRef);
}

async function handleGlobalShortcuts(e: KeyboardEvent) {
  if (e.repeat) return;

  if (e.ctrlKey || (os.value === 'mac' && e.metaKey)) {
    if (e.key === 'o') {
      e.preventDefault();
      await loadDataset();
    } else if (e.key === 'z') {
      e.preventDefault();
      undoAction();
    } else if (e.key === 'y') {
      e.preventDefault();
      redoAction();
    }
  }
}

function loadTheme() {
  const app = document.querySelector('#app') as HTMLElement;
  let storagedTheme = localStorage.getItem('theme');

  if (storagedTheme) {
    app.dataset.theme = storagedTheme;
    theme.value = storagedTheme;
  } else {
    localStorage.setItem(
      'theme',
      window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'winter',
    );
    storagedTheme = localStorage.getItem('theme')!;
    app.dataset.theme = storagedTheme;
    theme.value = storagedTheme;
  }
}

onMounted(async () => {
  document.addEventListener('keydown', handleGlobalShortcuts);
  loadTheme();

  let osType = localStorage.getItem('os');
  if (osType) {
    os.value = osType;
  } else {
    osType = (await window.ipcRenderer.invoke('get_os_type')) as string;
    localStorage.setItem('os', osType);
    os.value = osType;
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalShortcuts);
});
</script>

<template>
  <NavbarComponent
    v-model="arePreviewsEnabled"
    :os="os"
    :theme="theme"
    @load_dataset="loadDataset"
    @undo="undoAction"
    @redo="redoAction"
  />
  <MainComponent
    v-model:images="imagesRef"
    v-bind:global-tags="globalTagsRef"
    :os="os"
    :are-previews-enabled="arePreviewsEnabled"
  />
</template>
