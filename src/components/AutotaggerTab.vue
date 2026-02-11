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
const isAddModelModalOpen = ref(false);
const addModelRepositoryId = ref("");
const addModelOnnxFile = ref("");
const addModelCsvTagsFile = ref("");
const addModelTriedSave = ref(false);

const modelNames = computed(() => Array.from(models.value.keys()));

const repositoryIdError = computed(() => {
    const value = addModelRepositoryId.value.trim();
    if (!value)
        return "Repository Id is required";

    const regex = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/;
    if (!regex.test(value))
        return "Expected format: Username/RepoName";

    if (modelNames.value.includes(value))
        return "The repository already exists in the list";

    return "";
});

const onnxFileError = computed(() => {
    const value = addModelOnnxFile.value.trim();

    if (!value)
        return "ONNX model file is required";
    if (!value.toLowerCase().endsWith(".onnx"))
        return "File must end in .onnx";

    return "";
});

const csvTagsFileError = computed(() => {
    const value = addModelCsvTagsFile.value.trim();

    if (!value)
        return "CSV tags file is required";
    if (!value.toLowerCase().endsWith(".csv"))
        return "File must end in .csv";

    return "";
});

const isAddModelFormValid = computed(() =>
    !repositoryIdError.value && !onnxFileError.value && !csvTagsFileError.value
);

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
    modelsDownloading.value = new Set();
    modelsDeleting.value = new Set();

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

function openAddModelModal() {
    addModelRepositoryId.value = "";
    addModelOnnxFile.value = "";
    addModelCsvTagsFile.value = "";
    addModelTriedSave.value = false;
    isAddModelModalOpen.value = true;
}

function closeAddModelModal() {
    isAddModelModalOpen.value = false;
}

async function saveAddModelModal() {
    addModelTriedSave.value = true;
    if (!isAddModelFormValid.value)
        return;

    models.value.set(addModelRepositoryId.value, {
        isCustomModel: true,
        generalThreshold: 0.25,
        characterThreshold: 0.35,
        modelFile: lowerFileExtension(addModelOnnxFile.value),
        tagsFile: lowerFileExtension(addModelCsvTagsFile.value)
    });

    const result = await taggerService.updateModelsConfiguration(models.value);
    if (result.error)
        models.value.delete(addModelRepositoryId.value);

    closeAddModelModal();
}

function lowerFileExtension(filename: string) {
    const index = filename.lastIndexOf(".");
    return filename.slice(0, index) + filename.slice(index).toLowerCase();
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
                <button class="btn btn-sm btn-success w-full gap-2" @click="openAddModelModal">
                    <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path
                            fill-rule="evenodd"
                            d="M10 3a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2h-5v5a1 1 0 1 1-2 0v-5H4a1 1 0 1 1 0-2h5V4a1 1 0 0 1 1-1z"
                            clip-rule="evenodd"
                        />
                    </svg>
                    <span>Add model</span>
                </button>
                <div class="mt-2 text-sm text-base-content/70">
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
        <div class="modal z-50" :class="{ 'modal-open': isAddModelModalOpen }">
            <div class="modal-box w-11/12 max-w-md">
                <div class="flex items-center justify-between border-b-2 pb-2 dark:border-base-content/10">
                    <div class="text-lg font-semibold">Add model</div>
                    <button class="btn btn-ghost btn-sm" @click="closeAddModelModal">x</button>
                </div>
                <div class="mt-4 flex flex-col gap-3">
                    <div class="flex flex-col gap-1">
                        <label class="text-sm opacity-80">Repository Id</label>
                        <input
                            v-model="addModelRepositoryId"
                            type="text"
                            class="input input-bordered w-full outline-none!"
                            placeholder="Username/RepoName"
                        />
                        <div v-if="addModelTriedSave && repositoryIdError" class="text-sm text-error">
                            {{ repositoryIdError }}
                        </div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-sm opacity-80">ONNX model file</label>
                        <input
                            v-model="addModelOnnxFile"
                            type="text"
                            class="input input-bordered w-full outline-none!"
                            placeholder="model.onnx"
                        />
                        <div v-if="addModelTriedSave && onnxFileError" class="text-sm text-error">
                            {{ onnxFileError }}
                        </div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-sm opacity-80">CSV tags file</label>
                        <input
                            v-model="addModelCsvTagsFile"
                            type="text"
                            class="input input-bordered w-full outline-none!"
                            placeholder="selected_tags.csv"
                        />
                        <div v-if="addModelTriedSave && csvTagsFileError" class="text-sm text-error">
                            {{ csvTagsFileError }}
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button class="btn btn-sm btn-outline" @click="closeAddModelModal">Cancel</button>
                        <button
                            class="btn btn-sm btn-primary"
                            @click="saveAddModelModal"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop" @click="closeAddModelModal"></div>
        </div>
    </div>
</template>
