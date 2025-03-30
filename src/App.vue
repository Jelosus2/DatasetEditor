<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import MainComponent from '@/components/MainComponent.vue';
import TagGroupEditorComponent from '@/components/TagGroupEditorComponent.vue';
import AlertComponent from '@/components/AlertComponent.vue';
import AutotaggerModalComponent from '@/components/AutotaggerModalComponent.vue';
import SettingComponent from '@/components/SettingComponent.vue';

import { ref, onMounted, onUnmounted } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useTagGroupStore } from '@/stores/tagGroupStore';
import { useSettingsStore } from '@/stores/settingsStore';

const os = ref('');
const arePreviewsEnabled = ref(false);
const alertMessage = ref('');
const alertType = ref('info');
const alertTimestamp = ref(Date.now());

const datasetStore = useDatasetStore();
const tagGroupsStore = useTagGroupStore();
const settingStore = useSettingsStore();

async function loadDataset() {
  const dataset = (await window.ipcRenderer.invoke('load_dataset')) as {
    images: Map<string, { tags: Set<string>; path: string }>;
    globalTags: Map<string, Set<string>>;
  };

  if (!dataset) return;

  console.log(dataset.images, dataset.globalTags);

  datasetStore.images = dataset.images;
  datasetStore.globalTags = dataset.globalTags;
}

function undoAction() {
  const activeTab = document.querySelector(
    'input[type="radio"][name="editor_tabs"]:checked',
  )?.ariaLabel;

  if (activeTab === 'Dataset') {
    datasetStore.undoDatasetAction();
  } else if (activeTab === 'Tag Groups') {
    tagGroupsStore.undoTagGroupAction();
  }
}

function redoAction() {
  const activeTab = document.querySelector(
    'input[type="radio"][name="editor_tabs"]:checked',
  )?.ariaLabel;

  if (activeTab === 'Dataset') {
    datasetStore.redoDatasetAction();
  } else if (activeTab === 'Tag Groups') {
    tagGroupsStore.redoTagGroupAction();
  }
}

async function saveChanges(all = false) {
  const activeTab = document.querySelector(
    'input[type="radio"][name="editor_tabs"]:checked',
  )?.ariaLabel;

  let obj: { [key: string]: unknown } = {};

  if (all) {
    if (datasetStore.images.size > 0) {
      for (const [image, props] of datasetStore.images.entries()) {
        obj[image] = { path: props.path, tags: [...props.tags] };
      }

      await window.ipcRenderer.invoke('save_dataset', obj);
      obj = {};
    }
    if (tagGroupsStore.tagGroups.size > 0) {
      for (const [tagGroup, tags] of tagGroupsStore.tagGroups.entries()) {
        obj[tagGroup] = [...tags];
      }

      await window.ipcRenderer.invoke('save_tag_group', obj);
    }
    await settingStore.saveSettings();
    return;
  }

  if (activeTab === 'Dataset') {
    if (datasetStore.images.size === 0) {
      showAlert('error', 'The dataset has not been loaded yet');
      return;
    }

    for (const [image, props] of datasetStore.images.entries()) {
      obj[image] = { path: props.path, tags: [...props.tags] };
    }

    await window.ipcRenderer.invoke('save_dataset', obj);
    showAlert('success', 'Dataset saved successfully');
  } else if (activeTab === 'Tag Groups') {
    if (tagGroupsStore.tagGroups.size === 0) {
      showAlert('error', 'No tag groups have been created yet');
      return;
    }

    for (const [tagGroup, tags] of tagGroupsStore.tagGroups.entries()) {
      obj[tagGroup] = [...tags];
    }

    await window.ipcRenderer.invoke('save_tag_group', obj);
    showAlert('success', 'Tag groups saved successfully');
  } else if (activeTab === 'Settings') {
    await settingStore.saveSettings();
    showAlert('success', 'Settings saved successfully');
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

onMounted(async () => {
  document.addEventListener('keydown', handleGlobalShortcuts);

  await settingStore.loadSettings();
  settingStore.loadTheme();

  const result = (await window.ipcRenderer.invoke('load_tag_group')) as Map<
    string,
    Set<string>
  > | null;

  if (result) tagGroupsStore.tagGroups = result;

  let osType = localStorage.getItem('os');
  if (osType) {
    os.value = osType;
  } else {
    osType = (await window.ipcRenderer.invoke('get_os_type')) as string;
    localStorage.setItem('os', osType);
    os.value = osType;
  }

  window.ipcRenderer.receive('are_changes_saved', () => {
    const allSaved =
      datasetStore.datasetUndoStack.length === 0 && tagGroupsStore.tagGroupUndoStack.length === 0;
    window.ipcRenderer.send('changes_saved', allSaved);
  });

  window.ipcRenderer.receive('save_all_changes', async () => {
    await saveChanges(true);
    window.ipcRenderer.send('save_all_done');
  });
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalShortcuts);
  window.ipcRenderer.unsubscribe('are_changes_saved');
  window.ipcRenderer.unsubscribe('save_all_changes');
});
</script>

<template>
  <AlertComponent :message="alertMessage" :timestamp="alertTimestamp" :type="alertType" />
  <NavbarComponent
    v-model="arePreviewsEnabled"
    :os="os"
    @load_dataset="loadDataset"
    @undo="undoAction"
    @redo="redoAction"
    @save="saveChanges"
  />
  <div class="tabs-lift tabs h-[calc(100vh-86px)]">
    <MainComponent :os="os" :are-previews-enabled="arePreviewsEnabled" />
    <TagGroupEditorComponent :os="os" />
    <SettingComponent />
  </div>
  <AutotaggerModalComponent @trigger_alert="showAlert" />
</template>
