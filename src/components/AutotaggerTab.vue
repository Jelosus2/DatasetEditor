<script setup lang="ts">
import AutotaggerConsole from "@/components/AutotaggerConsole.vue";
import AlertModal from "@/components/AlertModal.vue";

import type { TaggerModelsStatus, TaggerModelConfigurationProperties } from "../../shared/tagger";

import { TaggerService } from "@/services/taggerService";
import { useAlert } from "@/composables/useAlert";
import { ref, computed, onMounted } from "vue";

import DownloadIcon from "@/assets/icons/update-download.svg";
import DeleteIcon from "@/assets/icons/trash-bin.svg";
import RemoveIcon from "@/assets/icons/x.svg";
import EditIcon from "@/assets/icons/edit.svg";
import AddIcon from "@/assets/icons/plus.svg";

const selectedModels = ref<Set<string>>(new Set());
const consoleRef = ref<InstanceType<typeof AutotaggerConsole> | null>(null);
const isInstalling = ref(false);
const isServiceStarting = ref(false);
const isServiceRunning = ref(false);
const device = ref("?");
const models = ref<Map<string, TaggerModelConfigurationProperties>>(new Map());
const modelsStatus = ref<TaggerModelsStatus>({});
const cacheSizeBytes = ref(0);
const modelsDownloading = ref<Set<string>>(new Set());
const modelsDeleting = ref<Set<string>>(new Set());
const isAddModelModalOpen = ref(false);
const addModelRepositoryId = ref("");
const modelOnnxFile = ref("");
const modelCsvTagsFile = ref("");
const addModelTriedSave = ref(false);
const isEditModelModalOpen = ref(false);
const editModel = ref("");
const editGeneralThreshold = ref(0.25);
const editCharacterThreshold = ref(0.35);
const editModelTriedSave = ref(false);
const isRemoveModelModalOpen = ref(false);
const isDeleteModelModalOpen = ref(false);
const modelToBeRemoved = ref("");
const removeUnderscores = ref(true);
const removeRedundantTags = ref(true);
const disableCharacterThreshold = ref(false);

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
    const value = modelOnnxFile.value.trim();

    if (!value)
        return "ONNX model file is required";
    if (!value.toLowerCase().endsWith(".onnx"))
        return "File must end in .onnx";

    return "";
});

const csvTagsFileError = computed(() => {
    const value = modelCsvTagsFile.value.trim();

    if (!value)
        return "CSV tags file is required";
    if (!value.toLowerCase().endsWith(".csv"))
        return "File must end in .csv";

    return "";
});

const isAddModelFormValid = computed(() =>
    !repositoryIdError.value && !onnxFileError.value && !csvTagsFileError.value
);

const isEditModelCustom = computed(() => {
    const model = editModel.value;
    return !!model && !!models.value.get(model)?.isCustomModel
});

const isEditModelFormValid = computed(() =>
    !onnxFileError.value && !csvTagsFileError.value
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
    device.value = "?";
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
    modelOnnxFile.value = "";
    modelCsvTagsFile.value = "";
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

    const updatedMap = new Map(models.value);
    updatedMap.set(addModelRepositoryId.value, {
        isCustomModel: true,
        generalThreshold: 0.25,
        characterThreshold: 0.35,
        modelFile: lowerFileExtension(modelOnnxFile.value),
        tagsFile: lowerFileExtension(modelCsvTagsFile.value)
    });

    const result = await taggerService.updateModelsConfiguration(updatedMap);
    if (!result.error)
        models.value = updatedMap;

    closeAddModelModal();
}

function lowerFileExtension(filename: string) {
    const index = filename.lastIndexOf(".");
    return filename.slice(0, index) + filename.slice(index).toLowerCase();
}

function normalizeThreshold(value: number) {
    const clamped = Math.min(1, Math.max(0.05, value));
    return Math.round(clamped * 20) / 20;
}

function openEditModelModal(model: string) {
    const properties = models.value.get(model)!;

    editModel.value = model;
    modelOnnxFile.value = properties.modelFile;
    modelCsvTagsFile.value = properties.tagsFile;
    editGeneralThreshold.value = normalizeThreshold(properties.generalThreshold);
    editCharacterThreshold.value = normalizeThreshold(properties.characterThreshold);

    editModelTriedSave.value = false;
    isEditModelModalOpen.value = true;
}

function closeEditModelModal() {
    isEditModelModalOpen.value = false;
}

async function saveEditModelModal() {
    editModelTriedSave.value = true;
    if (!isEditModelFormValid.value)
        return;

    const model = editModel.value;
    const previous = models.value.get(model)!;

    const updatedMap = new Map(models.value);
    updatedMap.set(model, {
        ...previous,
        generalThreshold: normalizeThreshold(editGeneralThreshold.value),
        characterThreshold: normalizeThreshold(editCharacterThreshold.value),
        modelFile: lowerFileExtension(modelOnnxFile.value),
        tagsFile: lowerFileExtension(modelCsvTagsFile.value)
    });

    const result = await taggerService.updateModelsConfiguration(updatedMap);
    if (!result.error)
        models.value = updatedMap;

    closeEditModelModal();
}

function removeModelFromList() {
    const model = editModel.value;
    closeEditModelModal();
    openRemoveModelModal(model);
}

function openRemoveModelModal(model: string) {
    modelToBeRemoved.value = model;
    isRemoveModelModalOpen.value = true;
}

function closeRemoveModelModal() {
    isRemoveModelModalOpen.value = false;
}

async function removeModel() {
    modelsDeleting.value.add(modelToBeRemoved.value);

    const updatedMap = new Map(models.value);
    updatedMap.delete(modelToBeRemoved.value);

    const result = await taggerService.updateModelsConfiguration(updatedMap);
    if (result.error)
        return;

    models.value = updatedMap;
    modelsDeleting.value.delete(modelToBeRemoved.value);
    selectedModels.value.delete(modelToBeRemoved.value);

    closeRemoveModelModal();

    if (modelsStatus.value[modelToBeRemoved.value])
        openDeleteModelModal();
    else
        modelToBeRemoved.value = "";

    delete modelsStatus.value[modelToBeRemoved.value];
}

function openDeleteModelModal() {
    isDeleteModelModalOpen.value = true;
}

function closeDeleteModelModal() {
    modelToBeRemoved.value = "";
    isDeleteModelModalOpen.value = false;
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
    if (isDeleteModelModalOpen.value)
        closeDeleteModelModal();

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
                    <AddIcon class="w-5 h-5" />
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
                        <span class="truncate text-sm font-medium" :title="model">{{ model }}</span>
                        <div class="flex gap-2">
                            <button
                                v-if="!modelsStatus[model]"
                                title="Download model"
                                class="btn btn-xs btn-accent btn-outline"
                                :disabled="!isServiceRunning || modelsDownloading.has(model)"
                                @click.stop="downloadModel(model)"
                            >
                                <DownloadIcon v-if="!modelsDownloading.has(model)" class="h-5 w-5" />
                                <span v-else class="loading loading-spinner loading-md"></span>
                            </button>
                            <button
                                v-else
                                title="Delete model"
                                class="btn btn-xs btn-error btn-outline"
                                :disabled="modelsDeleting.has(model)"
                                @click.stop="deleteModel(model)"
                            >
                                <DeleteIcon class="h-5 w-5" />
                            </button>
                            <button
                                title="Edit options"
                                class="btn btn-xs btn-info btn-outline"
                                :disabled="!isServiceRunning"
                                @click.stop="openEditModelModal(model)"
                            >
                                <EditIcon class="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </aside>
            <div class="flex min-h-0 flex-1 flex-col p-4">
                <div class="h-full w-full">
                    <AutotaggerConsole ref="consoleRef" @resize="resizeTerminal" />
                </div>
                <div class="flex gap-6 pt-6">
                    <div class="flex flex-col justify-between">
                        <div class="flex gap-4">
                            <button
                                class="btn btn-outline"
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
                                class="btn btn-outline"
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
                        <div class="flex mt-2">
                            <span class="text-base text-base-content/90">Autotagger Device: {{ device }}</span>
                        </div>
                    </div>
                    <div class="divider m-0 divider-horizontal before:bg-base-content/30 after:bg-base-content/30"></div>
                    <div class="flex items-center gap-4">
                        <button class="btn btn-outline">Autotag Images</button>
                        <button class="btn btn-outline">Load Diff</button>
                    </div>
                    <div class="flex flex-col">
                        <div class="flex gap-4">
                            <div class="flex items-center gap-2 pt-2">
                                <input v-model="removeUnderscores" type="checkbox" class="checkbox checkbox-sm" />
                                <span>Remove underscores</span>
                            </div>
                            <div class="flex items-center gap-2 pt-2">
                                <input v-model="disableCharacterThreshold" type="checkbox" class="checkbox checkbox-sm" />
                                <span>Disable character threshold</span>
                            </div>
                        </div>
                        <div class="flex gap-4">
                            <div class="flex items-center gap-2 pt-2">
                                <input v-model="removeRedundantTags" type="checkbox" class="checkbox checkbox-sm" />
                                <span>Remove redundant tags</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="modal z-50" :class="{ 'modal-open': isAddModelModalOpen }">
            <div class="modal-box w-11/12 max-w-md">
                <div class="flex items-center justify-between border-b-2 pb-2 dark:border-base-content/10">
                    <div class="text-lg font-semibold">Add model</div>
                    <button class="btn btn-ghost btn-sm" @click="closeAddModelModal">
                        <RemoveIcon class="h-5 w-5" />
                    </button>
                </div>
                <div class="mt-4 flex flex-col gap-3" @keyup.enter="saveAddModelModal">
                    <div class="flex flex-col gap-1">
                        <label class="opacity-80">Repository Id</label>
                        <input
                            v-model="addModelRepositoryId"
                            type="text"
                            class="input border border-base-content/30 w-full outline-none!"
                            placeholder="Username/RepoName"
                        />
                        <div v-if="addModelTriedSave && repositoryIdError" class="text-sm text-error">
                            {{ repositoryIdError }}
                        </div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="opacity-80">ONNX model file</label>
                        <input
                            v-model="modelOnnxFile"
                            type="text"
                            class="input border border-base-content/30 w-full outline-none!"
                            placeholder="model.onnx"
                        />
                        <div v-if="addModelTriedSave && onnxFileError" class="text-sm text-error">
                            {{ onnxFileError }}
                        </div>
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="opacity-80">CSV tags file</label>
                        <input
                            v-model="modelCsvTagsFile"
                            type="text"
                            class="input border border-base-content/30 w-full outline-none!"
                            placeholder="selected_tags.csv"
                        />
                        <div v-if="addModelTriedSave && csvTagsFileError" class="text-sm text-error">
                            {{ csvTagsFileError }}
                        </div>
                    </div>
                    <div class="flex items-center justify-end gap-2 pt-2">
                        <button class="btn btn-outline" @click="closeAddModelModal">Cancel</button>
                        <button
                            class="btn btn-primary"
                            :disabled="addModelTriedSave && !isAddModelFormValid"
                            @click="saveAddModelModal"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </div>
            <div class="modal-backdrop" @click="closeAddModelModal"></div>
        </div>
        <div class="modal z-50" :class="{ 'modal-open': isEditModelModalOpen }">
            <div class="modal-box w-11/12 max-w-md">
                <div class="flex items-center justify-between border-b-2 pb-2 dark:border-base-content/10">
                    <div class="text-lg font-semibold">Edit model options</div>
                    <button class="btn btn-ghost btn-sm" @click="closeEditModelModal">X</button>
                </div>
                <div class="mt-4 flex flex-col gap-4" @keyup.enter="saveEditModelModal">
                <div class="text-base-content/60">
                    {{ editModel }}
                </div>
                <div class="flex flex-col gap-1">
                    <label class="opacity-80">ONNX model file</label>
                    <input
                        v-model="modelOnnxFile"
                        type="text"
                        class="input border border-base-content/30 w-full outline-none!"
                        placeholder="model.onnx"
                        :title="!isEditModelCustom ? 'You cannot edit the model file of a default model' : ''"
                        :disabled="!isEditModelCustom"
                    />
                    <div v-if="editModelTriedSave && onnxFileError" class="text-sm text-error">
                        {{ onnxFileError }}
                    </div>
                </div>
                <div class="flex flex-col gap-1">
                    <label class="opacity-80">CSV tags file</label>
                    <input
                        v-model="modelCsvTagsFile"
                        type="text"
                        class="input border border-base-content/30 w-full outline-none!"
                        placeholder="selected_tags.csv"
                        :title="!isEditModelCustom ? 'You cannot edit the tags file of a default model' : ''"
                        :disabled="!isEditModelCustom"
                    />
                    <div v-if="editModelTriedSave && csvTagsFileError" class="text-sm text-error">
                        {{ csvTagsFileError }}
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-2">
                        <span class="opacity-80">General threshold:</span>
                        <span class="font-semibold tabular-nums">{{ editGeneralThreshold.toFixed(2) }}</span>
                    </div>
                    <input
                        v-model.number="editGeneralThreshold"
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.05"
                        class="range w-full [--range-fill:0] [--range-thumb:var(--color-base-100)] range-sm"
                    />
                    <div class="flex justify-between text-sm opacity-60">
                        <span>0.05</span><span>1.00</span>
                    </div>
                </div>
                <div class="flex flex-col gap-2">
                    <div class="flex items-center gap-2">
                        <span class="opacity-80">Character threshold:</span>
                        <span class="font-semibold tabular-nums">{{ editCharacterThreshold.toFixed(2) }}</span>
                    </div>
                    <input
                        v-model.number="editCharacterThreshold"
                        type="range"
                        min="0.05"
                        max="1"
                        step="0.05"
                        class="range w-full [--range-fill:0] [--range-thumb:var(--color-base-100)] range-sm"
                    />
                    <div class="flex justify-between text-sm opacity-60">
                        <span>0.05</span><span>1.00</span>
                    </div>
                </div>
                <div class="flex items-center justify-between pt-2">
                    <button
                        class="btn btn-error btn-outline gap-2"
                        :disabled="!isEditModelCustom"
                        @click="removeModelFromList"
                    >
                        Remove
                    </button>
                    <div class="ml-auto flex gap-2">
                        <button class="btn btn-outline" @click="closeEditModelModal">Cancel</button>
                        <button
                            class="btn btn-primary"
                            :disabled="editModelTriedSave && !isEditModelFormValid"
                            @click="saveEditModelModal"
                        >
                            Save
                        </button>
                    </div>
                </div>
                </div>
            </div>
            <div class="modal-backdrop" @click="closeEditModelModal"></div>
        </div>
    </div>
    <AlertModal
        :open="isRemoveModelModalOpen"
        title="Model deletion"
        :message="`Are you sure you want to remove '${modelToBeRemoved}' from the model list?`"
        confirm-class="btn btn-error btn-outline"
        @confirm="removeModel"
        @cancel="closeRemoveModelModal"
        @update:open="(value) => !value && closeRemoveModelModal()"
    />
    <AlertModal
        :open="isDeleteModelModalOpen"
        title="Model removal"
        :message="`'${modelToBeRemoved}' was removed successfully. Do you want to delete the model from the cache folder?`"
        confirm-class="btn btn-error btn-outline"
        @confirm="deleteModel(modelToBeRemoved)"
        @cancel="closeDeleteModelModal"
        @update:open="(value) => !value && closeDeleteModelModal()"
    />
</template>
