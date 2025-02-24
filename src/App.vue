<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import MainComponent from '@/components/MainComponent.vue';

import { ref, onMounted, onUnmounted } from 'vue';

const imagesRef = ref<Map<string, { tags: Set<string>; path: string }>>(new Map());
const globalTagsRef = ref<Map<string, Set<string>>>(new Map());
const os = ref('');

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

async function handleShortcuts(e: KeyboardEvent) {
  if (e.repeat) return;

  if (e.ctrlKey && e.key === 's') {
    e.preventDefault();
    await loadDataset();
  }
}

onMounted(async () => {
  document.addEventListener('keydown', handleShortcuts);

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
  document.removeEventListener('keydown', handleShortcuts);
});
</script>

<template>
  <NavbarComponent @load_dataset="loadDataset" :os="os" />
  <MainComponent :images="imagesRef" :global-tags="globalTagsRef" :os="os" />
</template>
