<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import MainComponent from '@/components/MainComponent.vue';
import TagGroupEditorComponent from '@/components/TagGroupEditorComponent.vue';
import AlertComponent from '@/components/AlertComponent.vue';

import { ref, onMounted, onUnmounted } from 'vue';
import { useHistoryStore } from './stores/historyStore';

const imagesRef = ref<Map<string, { tags: Set<string>; path: string }>>(new Map());
const globalTagsRef = ref<Map<string, Set<string>>>(new Map());
const tagGroups = ref<Map<string, Set<string>>>(new Map());
const os = ref('');
const theme = ref('');
const arePreviewsEnabled = ref(false);
const alertMessage = ref('');
const alertType = ref('info');
const alertTimestamp = ref(Date.now());

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
  const activeTab = document.querySelector(
    'input[type="radio"][name="editor_tabs"]:checked',
  )?.ariaLabel;

  if (activeTab === 'Dataset') {
    historyStore.undoDatasetAction(imagesRef, globalTagsRef);
  } else if (activeTab === 'Tag Groups') {
    historyStore.undoTagGroupAction(tagGroups);
  }
}

function redoAction() {
  const activeTab = document.querySelector(
    'input[type="radio"][name="editor_tabs"]:checked',
  )?.ariaLabel;

  if (activeTab === 'Dataset') {
    historyStore.redoDatasetSection(imagesRef, globalTagsRef);
  } else if (activeTab === 'Tag Groups') {
    historyStore.redoTagGroupAction(tagGroups);
  }
}

async function saveChanges() {
  const activeTab = document.querySelector(
    'input[type="radio"][name="editor_tabs"]:checked',
  )?.ariaLabel;

  const obj: { [key: string]: unknown } = {};

  if (activeTab === 'Dataset') {
    if (imagesRef.value.size === 0) {
      showAlert('error', 'The dataset has not been loaded yet');
      return;
    }

    for (const [image, props] of imagesRef.value.entries()) {
      obj[image] = { path: props.path, tags: [...props.tags] };
    }

    window.ipcRenderer.invoke('save_dataset', obj);
    console.log('Dataset saved');
    showAlert('success', 'Dataset saved successfully');
  } else if (activeTab === 'Tag Groups') {
    if (tagGroups.value.size === 0) {
      showAlert('error', 'No tag groups have been created yet');
      return;
    }

    for (const [tagGroup, tags] of tagGroups.value.entries()) {
      obj[tagGroup] = [...tags];
    }

    window.ipcRenderer.invoke('save_tag_group', obj);
    console.log('Tag groups saved');
    showAlert('success', 'Tag groups saved successfully');
  }
}

function showAlert(type: string, message: string) {
  alertMessage.value = message;
  alertType.value = type;
  alertTimestamp.value = Date.now();
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
    } else if (e.key === 's') {
      e.preventDefault();
      await saveChanges();
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

  const result = (await window.ipcRenderer.invoke('load_tag_group')) as Map<
    string,
    Set<string>
  > | null;
  if (!result) return;

  tagGroups.value = result;

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
  <AlertComponent :message="alertMessage" :timestamp="alertTimestamp" :type="alertType" />
  <NavbarComponent
    v-model="arePreviewsEnabled"
    :os="os"
    :theme="theme"
    @load_dataset="loadDataset"
    @undo="undoAction"
    @redo="redoAction"
    @save="saveChanges"
  />
  <div class="tabs-lift tabs h-[calc(100vh-86px)]">
    <MainComponent
      v-model:images="imagesRef"
      v-bind:global-tags="globalTagsRef"
      :os="os"
      :tag-groups="tagGroups"
      :are-previews-enabled="arePreviewsEnabled"
    />
    <TagGroupEditorComponent :tag-groups="tagGroups" :os="os" />
  </div>
</template>
