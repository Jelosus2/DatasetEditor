<script setup lang="ts">
import type { UpdateState } from "@/types/navigation-bar";

import { useNavigationSections } from "@/composables/useNavigationSections";
import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { UpdateService } from "@/services/updateService";
import { useAlert } from "@/composables/useAlert";
import { APP_VERSION } from "@/version";
import { onMounted, ref, computed, markRaw } from "vue";

import UpdateCheckIcon from "@/assets/icons/update-check.svg";
import UpdateDownloadIcon from "@/assets/icons/update-download.svg";
import UpdateRestartIcon from "@/assets/icons/update-restart.svg";

const arePreviewsEnabled = defineModel<boolean>({ required: true });
const emit = defineEmits<{
    (e: "load_dataset"): void;
    (e: "reload_dataset"): void;
    (e: "undo"): void;
    (e: "redo"): void;
    (e: "save"): void;
}>();

const updateState = ref<UpdateState>("check");
const isChecking = ref(false);
const isDownloading = ref(false);
const canUpdate = ref(false);
const downloadProgressMessage = ref("");

const updateInfoMap = {
    check: { value: "Check for Updates", class: "btn-primary" },
    download: { value: "Download Update", class: "btn-success" },
    restart: { value: "Restart to Install", class: "btn-warning" }
} as const;

const updateInfo = computed(() => updateInfoMap[updateState.value]);

const updateService = new UpdateService();

const navigationSections = markRaw(useNavigationSections(emit, arePreviewsEnabled));
const { showAlert } = useAlert();

async function handleUpdateAction() {
    if (updateState.value === "check") {
        isChecking.value = true;
        const result = await updateService.checkForUpdates();
        isChecking.value = false;

        if (result.error)
            showAlert("error", result.message!);
        else if (!result.isUpdateAvailable)
            showAlert("info", "You're in the latest version of the app");
    } else if (updateState.value === "download") {
        downloadProgressMessage.value = "Downloading...";
        isDownloading.value = true;

        const result = await updateService.downloadUpdate();
        if (result.error) {
            showAlert("error", result.message!);
            isDownloading.value = false;
        }
    } else {
        updateService.installUpdate();
    }
}

useIpcRenderer([
    {
        channel: "app:update_available",
        handler: () => updateState.value = "download"
    },
    {
        channel: "app:update_progress",
        handler: (progress) => {
            isDownloading.value = true;
            downloadProgressMessage.value = `Downloading... ${Math.round(progress)}%`
        }
    },
    {
        channel: "app:update_downloaded",
        handler: () => {
            isDownloading.value = false;
            downloadProgressMessage.value = "";
            updateState.value = "restart";
        }
    },
    {
        channel: "app:update_error",
        handler: () => {
            isDownloading.value = false;
            downloadProgressMessage.value = "";
            showAlert("error", "Failed to update, check the logs for more information");
        }
    }
]);

onMounted(async () => {
    canUpdate.value = await updateService.canUpdate();
});
</script>

<template>
    <div class="navbar min-h-0.5 shadow-sm dark:shadow-md">
        <div class="navbar-start">
            <div v-for="section in navigationSections" :key="section.id" class="dropdown">
                <div tabindex="0" role="button" class="btn btn-sm btn-ghost h-1 p-3 dark:hover:bg-[#323841]">
                    {{ section.label }}
                </div>
                <ul tabindex="0" class="dropdown-content menu z-20 rounded-box bg-base-100 p-2 shadow" :class="section.menuWidthClass">
                    <li v-for="item in section.items" :key="item.label">
                        <!-- Action -->
                        <template v-if="item.kind === 'action'">
                            <div class="justify-between" @click="item.action">
                                <span>{{ item.label }}</span>
                                <div v-if="item.shortcut" class="flex items-center gap-1">
                                    <template v-for="(key, index) in item.shortcut" :key="`${item.label}-${key}`">
                                        <kbd class="kbd kbd-xs">{{ key }}</kbd>
                                        <span v-if="index < item.shortcut.length - 1">+</span>
                                    </template>
                                </div>
                            </div>
                        </template>

                        <!-- Toggle -->
                        <template v-else-if="item.kind === 'toggle'">
                            <div @click.self="item.model.value = !item.model.value">
                                <input v-model="item.model.value" type="checkbox" class="toggle toggle-sm" />
                                {{ item.label }}
                            </div>
                        </template>

                        <!-- Modal -->
                        <template v-else-if="item.kind === 'modal'">
                            <label :for="item.targetId">{{ item.label }}</label>
                        </template>
                    </li>
                </ul>
            </div>
        </div>
        <div class="navbar-center">
            <button
                class="btn btn-xs"
                :class="updateInfo.class"
                :disabled="!canUpdate || isChecking || isDownloading"
                @click="handleUpdateAction"
            >
                <template v-if="isChecking">
                    <span class="loading loading-spinner mr-1 h-4 w-4"></span>
                    <span>Checking...</span>
                </template>
                <template v-else-if="isDownloading">
                    <span class="loading loading-spinner mr-1 h-4 w-4"></span>
                    <span>{{ downloadProgressMessage }}</span>
                </template>
                <template v-else>
                    <UpdateCheckIcon v-if="updateState === 'check'" class="h-4 w-4 mr-1" />
                    <UpdateDownloadIcon v-else-if="updateState === 'download'" class="h-4 w-4 mr-1" />
                    <UpdateRestartIcon v-else class="h-4 w-4 mr-1" />
                    <span>{{ updateInfo.value }}</span>
                </template>
            </button>
        </div>
        <div class="navbar-end">
            <span class="rounded border border-gray-400 px-2 dark:border-base-content/20">
                Version {{ APP_VERSION }}
            </span>
        </div>
    </div>
</template>
