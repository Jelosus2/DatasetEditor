<script setup lang="ts">
import NavbarComponent from '@/components/NavbarComponent.vue';
import DatasetTab from '@/components/DatasetTab.vue';
import TagGroupEditorComponent from '@/components/TagGroupEditorComponent.vue';
import AlertComponent from '@/components/AlertComponent.vue';
import AutotaggerModalComponent from '@/components/AutotaggerModalComponent.vue';
import SettingComponent from '@/components/SettingComponent.vue';
import LogsComponent from '@/components/LogsComponent.vue';
import WikiSearchModalComponent from '@/components/WikiSearchModalComponent.vue';
import DuplicateFinderModalComponent from '@/components/DuplicateFinderModalComponent.vue';
import RenameFilesModalComponent from '@/components/RenameFilesModalComponent.vue';

import { ref, onMounted } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { useTagGroupStore } from '@/stores/tagGroupStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts';
import { useIpcRenderer } from '@/composables/useIpcRenderer';
import { useAlert } from '@/composables/useAlert';
import { AppController } from '@/controllers/AppController';

type ActiveTab = "dataset" | "tag-groups" | "settings" | "logs";

const arePreviewsEnabled = ref(false);
const datasetTab = ref<InstanceType<typeof DatasetTab> | null>(null);
const activeTab = ref<ActiveTab>("dataset");

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
  { key: 'a', ctrl: true, handler: () => datasetTab.value?.selectAllImages() }
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
        <DatasetTab
            ref="datasetTab"
            v-if="activeTab === 'dataset'"
            :are-previews-enabled="arePreviewsEnabled"
            :is-tab-active="activeTab === 'dataset'"
        />
      </KeepAlive>

      <input type="radio" name="editor_tabs" class="tab" aria-label="Tag Groups" value="tag-groups" v-model="activeTab" />
      <KeepAlive>
        <TagGroupEditorComponent v-if="activeTab === 'tag-groups'" @trigger_alert="showAlert" />
      </KeepAlive>

      <input type="radio" name="editor_tabs" class="tab" aria-label="Settings" value="settings" v-model="activeTab" />
      <KeepAlive>
        <SettingComponent v-if="activeTab === 'settings'" @trigger-alert="showAlert" />
      </KeepAlive>

      <input type="radio" name="editor_tabs" class="tab" aria-label="Logs" value="logs" v-model="activeTab" />
      <KeepAlive>
        <LogsComponent v-if="activeTab === 'logs'" />
      </KeepAlive>
    </div>
  </div>
  <AutotaggerModalComponent @trigger_alert="showAlert" />
  <WikiSearchModalComponent />
  <DuplicateFinderModalComponent @trigger_alert="showAlert" />
  <RenameFilesModalComponent @trigger_alert="showAlert" />
</template>
