<script setup lang="ts">
import NavigationBar from "@/components/NavigationBar.vue";
import DatasetTab from "@/components/DatasetTab.vue";
import TagGroupsTab from "@/components/TagGroupsTab.vue";
import AlertComponent from "@/components/AlertComponent.vue";
import AutotaggerTab from "@/components/AutotaggerTab.vue";
import SettingsTab from "@/components/SettingsTab.vue";
import LogsTab from "@/components/LogsTab.vue";
import AppStatusOverlay from "@/components/AppStatusOverlay.vue";
import WikiModal from "@/components/WikiModal.vue";
import DuplicateFinderModalComponent from "@/components/DuplicateFinderModalComponent.vue";
import RenameFilesModalComponent from "@/components/RenameFilesModalComponent.vue";

import type { ActiveTab } from "@/types/app";

import { useDatasetStore } from "@/stores/datasetStore";
import { useTagGroupsStore } from "@/stores/tagGroupsStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAppStatus } from "@/composables/useAppStatus";
import { useAlert } from "@/composables/useAlert";
import { AppController } from "@/AppController";
import { ref, onMounted } from "vue";

const arePreviewsEnabled = ref(false);
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
    showAlert,
    getActiveTab: () => activeTab.value
});

useKeyboardShortcuts(
    () => [
        { combo: settingsStore.getSetting("shortcutLoadDataset"), handler: () => appController.loadDataset(), preventDefault: true },
        { combo: settingsStore.getSetting("shortcutReloadDataset"), handler: () => appController.reloadDataset(), preventDefault: true },
        { combo: settingsStore.getSetting("shortcutUndo"), handler: () => appController.undoAction(), preventDefault: true },
        { combo: settingsStore.getSetting("shortcutRedo"), handler: () => appController.redoAction(), preventDefault: true },
        { combo: settingsStore.getSetting("shortcutSave"), handler: () => appController.saveChanges(), preventDefault: true }
    ],
    { isEnabled: () => !appStatus.active.value }
);

const { send } = useIpcRenderer([
    {
        channel: "app:close_request",
        handler: async ({ requestId, action }) => {
            try {
                const allSaved = await appController.handleCloseRequest(action);
                send("app:close_response", { requestId, allSaved });
            } catch (error) {
                const message = error instanceof Error ? error.message : "Unknown close request error";
                send("app:close_response", { requestId, allSaved: false, error: message });
            }
        }
    },
    {
        channel: "app:status",
        handler: appStatus.handleStatus
    }
]);

onMounted(async () => {
    await settingsStore.ensureLayoutMap();
    await appController.initialize();
});
</script>

<template>
    <div class="flex h-screen flex-col overflow-hidden">
        <AlertComponent :message="alertMessage" :timestamp="alertTimestamp" :type="alertType" />
        <NavigationBar
            v-model="arePreviewsEnabled"
            @load_dataset="appController.loadDataset()"
            @undo="appController.undoAction()"
            @redo="appController.redoAction()"
            @save="appController.saveChanges()"
            @reload_dataset="appController.reloadDataset()"
        />
        <div class="tabs-border tabs min-h-0 flex-1 overflow-hidden text-base">
            <input type="radio" name="editor_tabs" class="tab" aria-label="Dataset" value="dataset" v-model="activeTab" />
            <KeepAlive>
                <DatasetTab v-if="activeTab === 'dataset'" :are-previews-enabled="arePreviewsEnabled" />
            </KeepAlive>

            <input type="radio" name="editor_tabs" class="tab" aria-label="Tag Groups" value="tag-groups" v-model="activeTab" />
            <KeepAlive>
                <TagGroupsTab v-if="activeTab === 'tag-groups'" />
            </KeepAlive>

            <input type="radio" name="editor_tabs" class="tab" aria-label="Settings" value="settings" v-model="activeTab" />
            <KeepAlive>
                <SettingsTab v-if="activeTab === 'settings'" />
            </KeepAlive>

            <input type="radio" name="editor_tabs" class="tab" aria-label="Auto Tagger" value="auto-tagger" v-model="activeTab" />
            <KeepAlive>
                <AutotaggerTab v-if="activeTab === 'auto-tagger'"/>
            </KeepAlive>

            <input type="radio" name="editor_tabs" class="tab" aria-label="Logs" value="logs" v-model="activeTab" />
            <KeepAlive>
                <LogsTab v-if="activeTab === 'logs'" />
            </KeepAlive>
        </div>
    </div>
    <AppStatusOverlay />
    <WikiModal />
    <DuplicateFinderModalComponent @trigger_alert="showAlert" />
    <RenameFilesModalComponent @trigger_alert="showAlert" />
</template>
