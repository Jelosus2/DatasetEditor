<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import MainComponent from '@/components/MainComponent.vue';

import { ref, onMounted, onUnmounted } from 'vue';

const imagesRef = ref<Map<string, { tags: Set<string>; path: string }>>(new Map());
const globalTagsRef = ref<Map<string, Set<string>>>(new Map());

async function loadDataset() {
  const { images, globalTags } = (await window.ipcRenderer.invoke('load_dataset')) as {
    images: Map<string, { tags: Set<string>; path: string }>;
    globalTags: Map<string, Set<string>>;
  };

  console.log(images, globalTags);

  imagesRef.value = images;
  globalTagsRef.value = globalTags;
}

async function handleShortcuts(e: KeyboardEvent) {
  if (e.repeat) return;

  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    await loadDataset();
  }
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
  <MainComponent :images="imagesRef" :global-tags="globalTagsRef" />
</template>
