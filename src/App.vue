<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import MainComponent from '@/components/MainComponent.vue';
import ModalComponent from '@/components/ModalComponent.vue';

import { ref, onMounted } from 'vue';

const files = ref<Map<string, object>>(new Map());

async function handleShortcuts(e: KeyboardEvent) {
  e.preventDefault();

  if (e.ctrlKey && e.key === 's') {
    const { images, globalTags } = (await window.ipcRenderer.invoke('load_dataset')) as {
      images: Map<string, object>;
      globalTags: Map<string, Set<string>>;
    };
    console.dir(images, globalTags);
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'i')
    window.ipcRenderer.invoke('open_dev_tools');
}

onMounted(() => {
  document.addEventListener('keydown', handleShortcuts);
});
</script>

<template>
  <NavbarComponent />
  <MainComponent :images="files" />
  <ModalComponent />
</template>
