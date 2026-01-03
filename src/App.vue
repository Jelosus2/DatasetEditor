<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import DatasetTab from '@/components/DatasetTab.vue';
import TagGroupsTab from '@/components/TagGroupsTab.vue';
import AlertComponent from '@/components/AlertComponent.vue';
import AutotaggerModalComponent from '@/components/AutotaggerModalComponent.vue';
import SettingsTab from '@/components/SettingsTab.vue';
import RestartRequiredModal from '@/components/RestartRequiredModal.vue';
import LogsComponent from '@/components/LogsComponent.vue';
import AppStatusOverlay from '@/components/AppStatusOverlay.vue';
import WikiSearchModalComponent from '@/components/WikiSearchModalComponent.vue';
import DuplicateFinderModalComponent from '@/components/DuplicateFinderModalComponent.vue';
import RenameFilesModalComponent from '@/components/RenameFilesModalComponent.vue';

import type { ActiveTab } from '@/types/app';

import { useDatasetStore } from '@/stores/datasetStore';
import { useTagGroupsStore } from '@/stores/tagGroupsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useAppStatus } from '@/composables/useAppStatus';
import { useAlert } from '@/composables/useAlert';
import { AppController } from '@/controllers/AppController';
import { ref, onMounted } from 'vue';


const arePreviewsEnabled = ref(false);
const datasetTab = ref<InstanceType<typeof DatasetTab> | null>(null);
const activeTab = ref<ActiveTab>("dataset");

const { message: alertMessage, type: alertType, timestamp: alertTimestamp, showAlert } = useAlert();
const appStatus = useAppStatus();

const datasetStore = useDatasetStore();
const tagGroupsStore = useTagGroupsStore();
const settingsStore = useSettingsStore();

const appController = new AppController({
  datasetStore,
  tagGroupsStore,
  settingsStore,
  showAlert
});

useKeyboardShortcuts(
  [
    { key: 'o', ctrl: true, handler: () => appController.loadDataset(), preventDefault: true },
    { key: 'z', ctrl: true, handler: () => appController.undoAction(), preventDefault: true },
    { key: 'y', ctrl: true, handler: () => appController.redoAction(), preventDefault: true },
    { key: 's', ctrl: true, handler: () => appController.saveChanges(), preventDefault: true },
    { key: 'r', ctrl: true, handler: () => appController.reloadDataset(), preventDefault: true },
    { key: 'a', ctrl: true, handler: () => datasetTab.value?.selectAllImages() }
  ],
  { isEnabled: () => !appStatus.active.value }
);

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
  },
  {
    channel: "app:status",
    handler: appStatus.handleStatus
  }
]);

onMounted(async () => {
  await appController.initialize();
});
</script>

<template>
  <div class="flex h-screen flex-col overflow-hidden">
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
    <div class="tabs-border tabs min-h-0 flex-1 overflow-hidden text-base">
      <input type="radio" name="editor_tabs" class="tab" aria-label="Dataset" value="dataset" v-model="activeTab" />
      <KeepAlive>
        <DatasetTab ref="datasetTab" v-if="activeTab === 'dataset'" :are-previews-enabled="arePreviewsEnabled" />
      </KeepAlive>

      <input type="radio" name="editor_tabs" class="tab" aria-label="Tag Groups" value="tag-groups" v-model="activeTab" />
      <KeepAlive>
        <TagGroupsTab v-if="activeTab === 'tag-groups'" />
      </KeepAlive>

      <input type="radio" name="editor_tabs" class="tab" aria-label="Settings" value="settings" v-model="activeTab" />
      <KeepAlive>
        <SettingsTab v-if="activeTab === 'settings'" />
      </KeepAlive>

      <input type="radio" name="editor_tabs" class="tab" aria-label="Logs" value="logs" v-model="activeTab" />
      <KeepAlive>
        <LogsComponent v-if="activeTab === 'logs'" />
      </KeepAlive>
    </div>
  </div>
  <AppStatusOverlay />
  <RestartRequiredModal />
  <AutotaggerModalComponent @trigger_alert="showAlert" />
  <WikiSearchModalComponent />
  <DuplicateFinderModalComponent @trigger_alert="showAlert" />
  <RenameFilesModalComponent @trigger_alert="showAlert" />
</template>
