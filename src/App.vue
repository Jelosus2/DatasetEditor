<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import MainComponent from '@/components/MainComponent.vue';
import TagGroupEditorComponent from '@/components/TagGroupEditorComponent.vue';
import AlertComponent from '@/components/AlertComponent.vue';
import AutotaggerModalComponent from '@/components/AutotaggerModalComponent.vue';
import SettingComponent from '@/components/SettingComponent.vue';

import { ref, onMounted, onUnmounted } from 'vue';
import { useDatasetStore, type Image } from '@/stores/datasetStore';
import { useTagGroupStore } from '@/stores/tagGroupStore';
import { useSettingsStore } from '@/stores/settingsStore';

const arePreviewsEnabled = ref(false);
const alertMessage = ref('');
const alertType = ref('info');
const alertTimestamp = ref(Date.now());

const datasetStore = useDatasetStore();
const tagGroupsStore = useTagGroupStore();
const settingStore = useSettingsStore();

async function loadDataset(reload = false) {
  const isDatasetSaved = await isSaved('dataset');

  const dataset = (await window.ipcRenderer.invoke(
    'load_dataset',
    isDatasetSaved,
    reload ? datasetStore.directory : null,
  )) as {
    images: Map<string, Image>;
    globalTags: Map<string, Set<string>>;
    directoryPath: string;
  };

  if (!dataset) return;

  console.log(dataset.images, dataset.globalTags, dataset.directoryPath);

  datasetStore.images = dataset.images;
  datasetStore.globalTags = dataset.globalTags;
  datasetStore.directory = dataset.directoryPath;
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

async function saveChanges(type?: 'all') {
  const activeTab = document.querySelector(
    'input[type="radio"][name="editor_tabs"]:checked',
  )?.ariaLabel;

  let obj: { [key: string]: unknown } = {};

  if (type === 'all') {
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

  if (e.ctrlKey) {
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
    } else if (e.key === 'r') {
      e.preventDefault();
      await loadDataset(true);
    }
  }
}

function imagesToObject() {
  return [...datasetStore.images].map(([img, props]) => [
    img,
    { tags: [...props.tags], path: props.path },
  ]);
}

function tagGroupsToObject() {
  const obj: { [key: string]: string[] } = {};
  for (const [tagGroup, tags] of tagGroupsStore.tagGroups.entries()) {
    obj[tagGroup] = [...tags];
  }

  return obj;
}

async function isSaved(type: 'all' | 'dataset' | 'tag_group') {
  if (type === 'dataset') {
    return await window.ipcRenderer.invoke('compare_dataset_changes', imagesToObject());
  } else if (type === 'tag_group') {
    return await window.ipcRenderer.invoke('compare_tag_group_changes', tagGroupsToObject());
  }

  const datasetSaved = await window.ipcRenderer.invoke('compare_dataset_changes', imagesToObject());
  const tagGroupSaved = await window.ipcRenderer.invoke(
    'compare_tag_group_changes',
    tagGroupsToObject(),
  );

  return datasetSaved && tagGroupSaved;
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

  window.ipcRenderer.receive('are_changes_saved', async () => {
    const allSaved = await isSaved('all');
    window.ipcRenderer.send('changes_saved', allSaved);
  });

  window.ipcRenderer.receive('save_all_changes', async () => {
    await saveChanges('all');
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
    @load_dataset="loadDataset"
    @undo="undoAction"
    @redo="redoAction"
    @save="saveChanges"
    @reload_dataset="loadDataset(true)"
  />
  <div class="tabs-lift tabs h-[calc(100vh-86px)]">
    <MainComponent :are-previews-enabled="arePreviewsEnabled" />
    <TagGroupEditorComponent @trigger_alert="showAlert" />
    <SettingComponent />
  </div>
  <AutotaggerModalComponent @trigger_alert="showAlert" />
</template>
