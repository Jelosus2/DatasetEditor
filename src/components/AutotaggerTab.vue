<script setup lang="ts">
import AutotaggerConsole from "@/components/AutotaggerConsole.vue";

import type { TaggerModelsStatus, TaggerModelConfigurationProperties } from "../../shared/tagger";

import { TaggerService } from "@/services/taggerService";
import { useAlert } from "@/composables/useAlert";
import { ref, computed, onMounted } from "vue";

import DownloadIcon from "@/assets/icons/update-download.svg";
import DeleteIcon from "@/assets/icons/trash-bin.svg";

const selectedModels = ref<Set<string>>(new Set());
const consoleRef = ref<InstanceType<typeof AutotaggerConsole> | null>(null);
const isInstalling = ref(false);
const isServiceStarting = ref(false);
const isServiceRunning = ref(false);
const device = ref("Unknown");
const models = ref<Map<string, TaggerModelConfigurationProperties>>(new Map());
const modelsStatus = ref<TaggerModelsStatus>({});
const cacheSizeBytes = ref(0);
const modelsDownloading = ref<Set<string>>(new Set());
const modelsDeleting = ref<Set<string>>(new Set());

const modelNames = computed(() => Array.from(models.value.keys()));

const { showAlert } = useAlert();
const taggerService = new TaggerService();

taggerService.onData = (line) => consoleRef.value?.write(line);
taggerService.onServiceStarted = async () => {
    if (isServiceRunning.value)
        return;

    const result = await taggerService.getModelsStatus();

    device.value = await taggerService.getDevice();
    modelsStatus.value = result.status;
    cacheSizeBytes.value = result.cacheSizeBytes;

    isServiceStarting.value = false;
    isServiceRunning.value = true;
}
taggerService.onServiceStopped = () => {
    device.value = "Unknown";
    modelsStatus.value = {};

    isServiceRunning.value = false;
    isServiceStarting.value = false;
}

function toggleModel(model: string) {
    if (!isServiceRunning.value)
        return;
    if (!modelsStatus.value[model]) {
        showAlert("warning", "Download the model before selecting it");
        return;
    }

    if (selectedModels.value.has(model))
        selectedModels.value.delete(model);
    else
        selectedModels.value.add(model);
}

function formatBytes(bytes: number) {
    if (!isServiceRunning.value)
        return "?";

    const units = ["B", "KB", "MB", "GB", "TB"];

    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }

    return `${bytes.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function resizeTerminal(columns: number, rows: number) {
    await taggerService.resizeTerminal(columns, rows);
}

async function installDependencies() {
    isInstalling.value = true;
    await taggerService.installDependencies();
    isInstalling.value = false;
}

async function startService() {
    isServiceStarting.value = true;
    await taggerService.startService();
}

async function stopProcess() {
    await taggerService.stopProcess();
}

async function downloadModel(model: string) {
    modelsDownloading.value.add(model);
    const properties = models.value.get(model)!;
    const result = await taggerService.downloadModel(model, properties.modelFile, properties.tagsFile);
    modelsDownloading.value.delete(model);

    if (result.error)
        return;

    modelsStatus.value[model] = true;
    cacheSizeBytes.value = result.cacheSizeBytes!;
}

async function deleteModel(model: string) {
    modelsDeleting.value.add(model);
    const result = await taggerService.deleteModel(model);
    modelsDeleting.value.delete(model);

    if (result.error)
        return;

    modelsStatus.value[model] = false;
    cacheSizeBytes.value = result.cacheSizeBytes!;
}

onMounted(async () => {
    models.value = await taggerService.getModelsConfiguration();
});
</script>

<template>
    <div class="tab-content min-h-0 border-t-base-300 bg-base-100">
        <div class="flex h-full">
            <aside class="w-110 border-r border-base-content/20 p-4 flex flex-col min-h-0">
                <div class="mb-2 rounded-lg border border-base-content/30 bg-base-200/50 px-3 py-2">
                    <div class="text-base-content/70">HuggingFace Cache Directory Size</div>
                    <div class="font-semibold text-info">
                        {{ formatBytes(cacheSizeBytes) }}
                    </div>
                </div>
                <div class="text-sm text-base-content/70">
                    Models will be downloaded to the HuggingFace cache directory set in Settings.
                </div>
                <div class="mt-3 flex-1 overflow-auto space-y-2 pr-1">
                    <div
                        v-for="model in modelNames"
                        :key="model"
                        class="flex cursor-pointer items-center justify-between rounded-box border px-3 py-2 transition"
                        :class="selectedModels.has(model)
                            ? 'border-primary bg-primary/5'
                            : 'border-base-content/20 hover:border-base-content/10'"
                        @click="toggleModel(model)"
                    >
                        <span class="truncate text-sm font-medium">{{ model }}</span>
                        <button
                            v-if="!modelsStatus[model]"
                            class="btn btn-xs btn-accent btn-outline"
                            :disabled="!isServiceRunning || modelsDownloading.has(model)"
                            @click.stop="downloadModel(model)"
                        >
                            <DownloadIcon v-if="!modelsDownloading.has(model)" class="h-5 w-5" />
                            <span v-else class="loading loading-spinner loading-md"></span>
                        </button>
                        <button
                            v-else
                            class="btn btn-xs btn-error btn-outline"
                            :disabled="modelsDeleting.has(model)"
                            @click.stop="deleteModel(model)"
                        >
                            <DeleteIcon class="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </aside>
            <div class="flex min-h-0 flex-1 flex-col p-4">
                <div class="h-full w-full">
                    <AutotaggerConsole ref="consoleRef" @resize="resizeTerminal" />
                </div>
                <div class="flex gap-4">
                    <button
                        class="btn btn-sm btn-outline"
                        :class="{
                            'btn-error': isInstalling,
                            'btn-info': !isInstalling
                        }"
                        :disabled="isServiceStarting || isServiceRunning"
                        @click="isInstalling ? stopProcess() : installDependencies()"
                    >
                        {{ isInstalling ? 'Cancel Installation' : 'Install Dependencies' }}
                    </button>
                    <button
                        class="btn btn-sm btn-outline"
                        :class="{
                            'btn-error': isServiceRunning,
                            'btn-success': !isServiceRunning
                        }"
                        :disabled="isInstalling || isServiceStarting"
                        @click="isServiceRunning ? stopProcess() : startService()"
                    >
                        {{ isServiceRunning ? 'Stop Service' : 'Start Service' }}
                    </button>
                </div>
                <div class="flex">
                    <span>Device: {{ device }}</span>
                </div>
            </div>
        </div>
    </div>
</template>
