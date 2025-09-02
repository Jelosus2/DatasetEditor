<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import MainComponent from '@/components/MainComponent.vue';
import TagGroupEditorComponent from '@/components/TagGroupEditorComponent.vue';
import AlertComponent from '@/components/AlertComponent.vue';
import AutotaggerModalComponent from '@/components/AutotaggerModalComponent.vue';
import SettingComponent from '@/components/SettingComponent.vue';
import LogsComponent from '@/components/LogsComponent.vue';
import WikiSearchModalComponent from '@/components/WikiSearchModalComponent.vue';
import DuplicateFinderModalComponent from '@/components/DuplicateFinderModalComponent.vue';

import { ref, onMounted } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useTagGroupStore } from '@/stores/tagGroupStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useAlert } from '@/composables/useAlert';
import { AppController } from '@/controllers/AppController';

const arePreviewsEnabled = ref(false);
const mainComponent = ref<InstanceType<typeof MainComponent> | null>(null);
const { message: alertMessage, type: alertType, timestamp: alertTimestamp, showAlert } = useAlert();

const datasetStore = useDatasetStore();
const tagGroupsStore = useTagGroupStore();
const settingsStore = useSettingsStore();

const appController = new AppController({
  datasetStore,
  tagGroupsStore,
  settingsStore,
  showAlert
});

useKeyboardShortcuts([
  { key: 'o', ctrl: true, handler: () => appController.loadDataset(), preventDefault: true },
  { key: 'z', ctrl: true, handler: () => appController.undoAction(), preventDefault: true },
  { key: 'y', ctrl: true, handler: () => appController.redoAction(), preventDefault: true },
  { key: 's', ctrl: true, handler: () => appController.saveChanges(), preventDefault: true },
  { key: 'r', ctrl: true, handler: () => appController.reloadDataset(), preventDefault: true },
  { key: 'a', ctrl: true, handler: (e) => mainComponent.value?.selectAllImages(e) }
]);

const { send } = useIpcRenderer([
  {
    channel: 'are_changes_saved',
    handler: async () => {
      const allSaved = await appController.areAllChangesSaved();
      send('changes_saved', allSaved);
    }
  },
  {
    channel: 'save_all_changes',
    handler: async () => {
      await appController.saveAllChanges();
      send('save_all_done');
    }
  }
]);

onMounted(async () => {
  await appController.initialize();
});
</script>

<template>
  <AlertComponent :message="alertMessage" :timestamp="alertTimestamp" :type="alertType" />
  <NavbarComponent
    v-model="arePreviewsEnabled"
    @load_dataset="appController.loadDataset()"
    @undo="appController.undoAction()"
    @redo="appController.redoAction()"
    @save="appController.saveChanges()"
    @reload_dataset="appController.reloadDataset()"
    @trigger_alert="showAlert"
  />
  <div class="tabs-lift tabs h-[calc(100vh-86px)]">
    <MainComponent ref="mainComponent" :are-previews-enabled="arePreviewsEnabled" @trigger_alert="showAlert" />
    <TagGroupEditorComponent @trigger_alert="showAlert" />
    <SettingComponent @trigger-alert="showAlert" />
    <LogsComponent />
  </div>
  <AutotaggerModalComponent @trigger_alert="showAlert" />
  <WikiSearchModalComponent />
  <DuplicateFinderModalComponent @trigger_alert="showAlert" />
</template>
