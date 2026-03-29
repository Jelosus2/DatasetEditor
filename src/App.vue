<script setup lang="ts">
import type { ActiveTab } from "@/types/app";
import type { WhatsNewEntry } from "../shared/whats-new";

import NavigationBar from "@/components/NavigationBar.vue";
import DatasetTab from "@/components/DatasetTab.vue";
import TagGroupsTab from "@/components/TagGroupsTab.vue";
import AlertComponent from "@/components/AlertComponent.vue";
import AutotaggerTab from "@/components/AutotaggerTab.vue";
import SettingsTab from "@/components/SettingsTab.vue";
import LogsTab from "@/components/LogsTab.vue";
import AppStatusOverlay from "@/components/AppStatusOverlay.vue";
import WikiModal from "@/components/WikiModal.vue";
import DuplicatesFinderModal from "@/components/DuplicatesFinderModal.vue";
import RenameFilesModal from "@/components/RenameFilesModal.vue";
import BgColorChangerModal from "@/components/BgColorChangerModal.vue";
import CropImageModal from "@/components/CropImageModal.vue";
import WhatsNewModal from "@/components/WhatsNewModal.vue";

import { useDatasetStore } from "@/stores/datasetStore";
import { useTagGroupsStore } from "@/stores/tagGroupsStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useKeyboardShortcuts } from "@/composables/useKeyboardShortcuts";
import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAppStatus } from "@/composables/useAppStatus";
import { useAlert } from "@/composables/useAlert";
import { WhatsNewService } from "@/services/whatsNewService";
import { AppController } from "@/AppController";
import { ref, onMounted } from "vue";

const arePreviewsEnabled = ref(false);
const activeTab = ref<ActiveTab>("dataset");
const isWhatsNewModalOpen = ref(false);
const whatsNewCurrentVersion = ref("");
const allWhatsNewEntries = ref<WhatsNewEntry[]>([]);
const visibleWhatsNewEntries = ref<WhatsNewEntry[]>([]);
const unseenWhatsNewEntries = ref<WhatsNewEntry[]>([]);

const whatsNewService = new WhatsNewService();

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

function openWhatsNewModal(mode: "all" | "unseen" = "all") {
    visibleWhatsNewEntries.value = mode === "unseen" && unseenWhatsNewEntries.value.length > 0
        ? unseenWhatsNewEntries.value
        : allWhatsNewEntries.value;

    isWhatsNewModalOpen.value = true;
}

async function closeWhatsNewModal() {
    isWhatsNewModalOpen.value = false;
    await whatsNewService.markSeen();
}

onMounted(async () => {
    await settingsStore.ensureLayoutMap();
    await appController.initialize();

    const payload = await whatsNewService.getWhatsNew();
    if (!payload)
        return;

    whatsNewCurrentVersion.value = payload.currentVersion;
    allWhatsNewEntries.value = payload.entries;
    unseenWhatsNewEntries.value = payload.unseenEntries;

    if (payload.shouldAutoOpen)
        openWhatsNewModal("unseen");
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
            @open_whats_new="openWhatsNewModal('all')"
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
    <DuplicatesFinderModal />
    <RenameFilesModal />
    <BgColorChangerModal :selected-images="datasetStore.selectedImages" />
    <CropImageModal :selected-images="datasetStore.selectedImages" />
    <WhatsNewModal
        v-if="isWhatsNewModalOpen"
        :current-version="whatsNewCurrentVersion"
        :entries="visibleWhatsNewEntries"
        @close="closeWhatsNewModal"
    />
</template>
