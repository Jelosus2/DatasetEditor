<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import MainComponent from '@/components/MainComponent.vue';

import { ref, onMounted, onUnmounted } from 'vue';

const files = ref<Map<string, { tags: Set<string>; path: string }>>(new Map());

async function loadDataset() {
  const { images, globalTags } = (await window.ipcRenderer.invoke('load_dataset')) as {
    images: Map<string, { tags: Set<string>; path: string }>;
    globalTags: Map<string, Set<string>>;
  };

  console.log(images, globalTags);

  files.value = images;
}

async function handleShortcuts(e: KeyboardEvent) {
  e.preventDefault();
  if (e.repeat) return;

  if (e.ctrlKey && e.key === 's') {
    await loadDataset();
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i')
    window.ipcRenderer.invoke('open_dev_tools');
}

onMounted(() => {
  document.addEventListener('keydown', handleShortcuts);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleShortcuts);
});
</script>

<template>
  <NavbarComponent @load_dataset="loadDataset" />
  <MainComponent :images="files" />
</template>
