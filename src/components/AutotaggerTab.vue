<script setup lang="ts">
import type { TaggerModelsStatus, TaggerModelConfigurationProperties, StyleCompareItem } from "../../shared/tagger";

import AutotaggerConsole from "@/components/AutotaggerConsole.vue";
import ConfirmationAlert from "@/components/ConfirmationAlert.vue";

import { useDatasetStore } from "@/stores/datasetStore";
import { TaggerService } from "@/services/taggerService";
import { useAlert } from "@/composables/useAlert";
import { ref, computed, onMounted } from "vue";

import DownloadIcon from "@/assets/icons/update-download.svg";
import DeleteIcon from "@/assets/icons/trash-bin.svg";
import RemoveIcon from "@/assets/icons/x.svg";
import EditIcon from "@/assets/icons/edit.svg";
import AddIcon from "@/assets/icons/plus.svg";
import CaretDownIcon from "@/assets/icons/caret-down.svg";

const STYLE_COMPARE_ROW_HEIGHT = 56;
const STYLE_COMPARE_BUFFER = 8;
const STYLE_COMPARE_WARNING_SEEN_KEY = "style-compare-kaloscope-warning-seen";

const selectedModels = ref<Set<string>>(new Set());
const consoleRef = ref<InstanceType<typeof AutotaggerConsole> | null>(null);
const isInstalling = ref(false);
const isUninstalling = ref(false);
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
const isTagging = ref(false);
const isComparingStyle = ref(false);
const isStyleCompareResultsModalOpen = ref(false);
const styleCompareFolderCohesion = ref<number | null>(null);
const styleCompareResults = ref<StyleCompareItem[]>([]);
const styleCompareListRef = ref<HTMLElement | null>(null);
const styleCompareScrollTop = ref(0);
const isStyleCompareDownloadWarningOpen = ref(false);
const selectedDependencyAction = ref<"install" | "uninstall">("install");
const isUninstallDependenciesModalOpen = ref(false);

const datasetStore = useDatasetStore();

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
    return !!model && !!models.value.get(model)?.isCustomModel;
});

const isEditModelFormValid = computed(() =>
    !onnxFileError.value && !csvTagsFileError.value
);

const shouldDisableTagButtons = computed(() => {
    const isModelDownloading = modelsDownloading.value.size > 0;
    const isModelDeleting = modelsDeleting.value.size > 0;

    return !isServiceRunning.value || isModelDownloading || isModelDeleting;
});

const isDependencyActionRunning = computed(() => isInstalling.value || isUninstalling.value);

const dependencyButtonLabel = computed(() => {
    if (isInstalling.value)
        return "Cancel Installation";
    if (isUninstalling.value)
        return "Cancel Uninstall";

    return selectedDependencyAction.value === "install"
        ? "Install Dependencies"
        : "Uninstall Dependencies";
});

const hasStyleCompareResults = computed(() => styleCompareResults.value.length > 0);
const mostLikelyStyleOutlier = computed(() => styleCompareResults.value[0] ?? null);

const bestStyleFit = computed(() => {
    const { length } = styleCompareResults.value;
    return length > 0 ? styleCompareResults.value[length - 1] : null;
});

const selectedStyleCompareFile = ref("");

const selectedStyleCompareItem = computed(() =>
    styleCompareResults.value.find((item) => item.file === selectedStyleCompareFile.value)
    ?? styleCompareResults.value[0]
    ?? null
);

const selectedStyleComparePreview = computed(() => {
    const file = selectedStyleCompareItem.value?.file;
    if (!file)
        return null;

    return datasetStore.dataset.get(file)?.filePath ?? null;
});

const styleCompareDisplayResults = computed(() =>
    styleCompareResults.value.map((result, index) => ({
        ...result,
        rank: index + 1,
        fileName: getFileName(result.file),
        flag:
            index === 0
                ? "outlier"
                : index === styleCompareResults.value.length - 1
                    ? "best-fit"
                    : null
    }))
);

const visibleStyleCompareCount = computed(() => {
    const container = styleCompareListRef.value;
    if (!container)
        return 12;

    return Math.ceil(container.clientHeight / STYLE_COMPARE_ROW_HEIGHT);
});

const styleCompareVirtualState = computed(() => {
    const allItems = styleCompareDisplayResults.value;
    const startIndex = Math.max(0, Math.floor(styleCompareScrollTop.value / STYLE_COMPARE_ROW_HEIGHT) - STYLE_COMPARE_BUFFER);
    const endIndex = Math.min(allItems.length, startIndex + visibleStyleCompareCount.value + STYLE_COMPARE_BUFFER * 2);

    return {
        items: allItems.slice(startIndex, endIndex),
        topPadding: startIndex * STYLE_COMPARE_ROW_HEIGHT,
        bottomPadding: Math.max(0, (allItems.length - endIndex) * STYLE_COMPARE_ROW_HEIGHT)
    };
});

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
    selectedModels.value = new Set();

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

function formatPercentage(value: number | null | undefined) {
    if (value == null)
        return "-";

    return `${(value * 100).toFixed(2)}%`;
}

function getFileName(filePath: string) {
    return filePath.split(/[\\/]/).pop() || filePath;
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
    const clamped = Math.min(1, Math.max(0.01, value));
    return Math.round(clamped * 100) / 100;
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

function openUninstallDependenciesModal() {
    isUninstallDependenciesModalOpen.value = true;
}

function closeUninstallDependenciesModal() {
    isUninstallDependenciesModalOpen.value = false;
}

async function uninstallDependencies() {
    closeUninstallDependenciesModal();

    isUninstalling.value = true;
    await taggerService.uninstallDependencies();
    isUninstalling.value = false;
}

async function runSelectedDependencyAction() {
    if (isDependencyActionRunning.value) {
        await stopProcess();
        return;
    }

    if (selectedDependencyAction.value === "install") {
        await installDependencies();
        return;
    }

    openUninstallDependenciesModal();
}

function openStyleCompareResultsModal() {
    if (!hasStyleCompareResults.value)
        return;

    selectedStyleCompareFile.value = styleCompareResults.value[0]?.file ?? "";
    styleCompareScrollTop.value = 0;
    isStyleCompareResultsModalOpen.value = true;
}

function closeStyleCompareResultsModal() {
    isStyleCompareResultsModalOpen.value = false;
}

function onStyleCompareScroll(event: Event) {
    const element = event.target as HTMLElement;
    styleCompareScrollTop.value = element.scrollTop;
}

function hasSeenStyleCompareWarning() {
    return localStorage.getItem(STYLE_COMPARE_WARNING_SEEN_KEY) === "1";
}

function markStyleCompareWarningAsSeen() {
    localStorage.setItem(STYLE_COMPARE_WARNING_SEEN_KEY, "1");
}

function closeStyleCompareDownloadWarning() {
    isStyleCompareDownloadWarningOpen.value = false;
}

async function confirmStyleCompareDownloadWarning() {
    markStyleCompareWarningAsSeen();
    closeStyleCompareDownloadWarning();
    await compareDatasetStyle();
}

async function startService() {
    isServiceStarting.value = true;
    const error = await taggerService.startService();

    if (error)
        isServiceStarting.value = false;
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
    selectedModels.value.delete(model);
    cacheSizeBytes.value = result.cacheSizeBytes!;
}

async function autoTagImages(mode: "autotag" | "diff") {
    const selectedModelsMap = new Map<string, TaggerModelConfigurationProperties>();
    for (const [name, properties] of models.value) {
        if (selectedModels.value.has(name))
            selectedModelsMap.set(name, properties);
    }

    isTagging.value = true;
    await taggerService.tagImages(selectedModelsMap, removeUnderscores.value, removeRedundantTags.value, disableCharacterThreshold.value, mode);
    isTagging.value = false;
}

async function stopTagger() {
    await taggerService.stopTagger();
}

async function compareDatasetStyle() {
    if (!hasSeenStyleCompareWarning()) {
        isStyleCompareDownloadWarningOpen.value = true;
        return;
    }

    isComparingStyle.value = true;

    try {
        const result = await taggerService.compareStyle();
        if (!result)
            return;

        styleCompareFolderCohesion.value = result.folderCohesion;
        styleCompareResults.value = result.results;
        selectedStyleCompareFile.value = result.results[0]?.file ?? "";
        openStyleCompareResultsModal();
    } finally {
        isComparingStyle.value = false;
    }
}

async function stopStyleComparison() {
    await taggerService.stopStyleCompare();
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
                                :disabled="!isServiceRunning || modelsDownloading.has(model) || isTagging"
                                @click.stop="downloadModel(model)"
                            >
                                <DownloadIcon v-if="!modelsDownloading.has(model)" class="h-5 w-5" />
                                <span v-else class="loading loading-spinner loading-md"></span>
                            </button>
                            <button
                                v-else
                                title="Delete model"
                                class="btn btn-xs btn-error btn-outline"
                                :disabled="modelsDeleting.has(model) || isTagging"
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
                <div class="min-h-0 flex-1">
                    <AutotaggerConsole ref="consoleRef" @resize="resizeTerminal" />
                </div>
                <div class="grid gap-4 pt-6 xl:grid-cols-[auto_auto_1fr]">
                    <div class="flex flex-col gap-2">
                        <div class="flex flex-wrap gap-3">
                            <div class="join">
                                <button
                                    class="btn btn-outline join-item"
                                    :class="{
                                        'btn-info': !isDependencyActionRunning && selectedDependencyAction === 'install',
                                        'btn-error': (!isDependencyActionRunning && selectedDependencyAction === 'uninstall') || isDependencyActionRunning
                                    }"
                                    :disabled="isServiceStarting || isServiceRunning"
                                    @click="runSelectedDependencyAction"
                                >
                                    {{ dependencyButtonLabel }}
                                </button>
                                <div class="dropdown dropdown-top dropdown-end">
                                    <button
                                        tabindex="0"
                                        class="btn btn-outline join-item px-3"
                                        :class="{
                                            'btn-info': !isDependencyActionRunning && selectedDependencyAction === 'install',
                                            'btn-error': (!isDependencyActionRunning && selectedDependencyAction === 'uninstall') || isDependencyActionRunning
                                        }"
                                        :disabled="isDependencyActionRunning || isServiceStarting || isServiceRunning"
                                    >
                                        <CaretDownIcon class="w-5 h-5" />
                                    </button>
                                    <ul
                                        tabindex="0"
                                        class="dropdown-content menu z-50 mb-2 w-60 rounded-box border border-base-content/20 bg-base-100 p-2 shadow-lg"
                                    >
                                        <li>
                                            <button
                                                :class="{ 'active': selectedDependencyAction === 'install' }"
                                                @click="selectedDependencyAction = 'install'"
                                            >
                                                Install Dependencies
                                            </button>
                                        </li>
                                        <li>
                                            <button
                                                :class="{ 'active': selectedDependencyAction === 'uninstall' }"
                                                @click="selectedDependencyAction = 'uninstall'"
                                            >
                                                Uninstall Dependencies
                                            </button>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                            <button
                                class="btn btn-outline"
                                :class="{
                                    'btn-error': isServiceRunning,
                                    'btn-success': !isServiceRunning
                                }"
                                :disabled="isDependencyActionRunning || isServiceStarting"
                                @click="isServiceRunning ? stopProcess() : startService()"
                            >
                                {{ isServiceRunning ? "Stop Service" : "Start Service" }}
                            </button>
                        </div>
                        <div class="flex mt-2">
                            <span class="text-base text-base-content/90">Autotagger Device: {{ device }}</span>
                        </div>
                    </div>
                    <div class="flex min-w-[320px] flex-wrap items-center gap-3 xl:border-l xl:border-base-content/20 xl:pl-4">
                        <button
                            class="btn btn-outline"
                            :disabled="shouldDisableTagButtons || isComparingStyle"
                            :class="{
                                'btn-error': isTagging
                            }"
                            @click="isTagging ? stopTagger() : autoTagImages('autotag')"
                        >
                            {{ isTagging ? "Stop Tagger" : "Autotag Images" }}
                        </button>
                        <button
                            class="btn btn-outline"
                            :disabled="shouldDisableTagButtons || isTagging || isComparingStyle"
                            @click="autoTagImages('diff')"
                        >
                            Load Diff
                        </button>
                    </div>
                    <div class="flex min-w-105 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div class="flex flex-col gap-2">
                            <div class="flex flex-wrap gap-x-4 gap-y-2">
                                <div class="flex items-center gap-2">
                                    <input v-model="removeUnderscores" type="checkbox" class="checkbox checkbox-sm" />
                                    <span>Remove underscores</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <input v-model="disableCharacterThreshold" type="checkbox" class="checkbox checkbox-sm" />
                                    <span>Disable character threshold</span>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-x-4 gap-y-2">
                                <div class="flex items-center gap-2">
                                    <input v-model="removeRedundantTags" type="checkbox" class="checkbox checkbox-sm" />
                                    <span>Remove redundant tags</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-3 xl:shrink-0">
                            <button
                                class="btn btn-outline"
                                :disabled="shouldDisableTagButtons || isTagging"
                                :class="{
                                    'btn-error': isComparingStyle,
                                    'btn-secondary': !isComparingStyle
                                }"
                                @click="isComparingStyle ? stopStyleComparison() : compareDatasetStyle()"
                            >
                                {{ isComparingStyle ? "Stop Comparison" : "Compare Dataset Style" }}
                            </button>
                            <button
                                class="btn btn-outline btn-info"
                                :disabled="!hasStyleCompareResults || isComparingStyle"
                                @click="openStyleCompareResultsModal"
                            >
                                Comparison Results
                            </button>
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
                    <div class="alert alert-warning text-sm">
                        <span>
                            Custom models are not guaranteed to be fully compatible. Some models may require different
                            preprocessing, thresholds, or output formats and can produce poor results or fail to tag.
                        </span>
                    </div>
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
                        min="0.01"
                        max="1"
                        step="0.01"
                        class="range w-full [--range-fill:0] [--range-thumb:var(--color-base-100)] range-sm"
                    />
                    <div class="flex justify-between text-sm opacity-60">
                        <span>0.01</span><span>1.00</span>
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
                        min="0.01"
                        max="1"
                        step="0.01"
                        class="range w-full [--range-fill:0] [--range-thumb:var(--color-base-100)] range-sm"
                    />
                    <div class="flex justify-between text-sm opacity-60">
                        <span>0.01</span><span>1.00</span>
                    </div>
                </div>
                <div class="flex items-center justify-between pt-2">
                    <button
                        class="btn btn-error btn-outline gap-2"
                        :disabled="!isEditModelCustom || isTagging"
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
    <div class="modal z-50" :class="{ 'modal-open': isStyleCompareResultsModalOpen }">
        <div class="modal-box w-11/12 max-w-6xl">
            <div class="flex items-center justify-between border-b-2 pb-2 dark:border-base-content/10">
                <div>
                    <div class="text-lg font-semibold">Dataset Style Comparison</div>
                    <div class="text-sm text-base-content/60">
                        Ranked from least similar to most similar to the dataset's overall style.
                    </div>
                </div>
                <label class="cursor-pointer" @click="closeStyleCompareResultsModal">✕</label>
            </div>
            <div v-if="hasStyleCompareResults" class="mt-4 flex h-[70vh] flex-col gap-4">
                <div class="grid gap-3 md:grid-cols-3">
                    <div class="rounded-box border border-base-content/20 bg-base-200/40 p-3">
                        <div class="text-sm text-base-content/60">Folder Cohesion</div>
                        <div class="mt-1 text-xl font-semibold text-info">
                            {{ formatPercentage(styleCompareFolderCohesion) }}
                        </div>
                    </div>
                    <div class="rounded-box border border-base-content/20 bg-base-200/40 p-3">
                        <div class="text-sm text-base-content/60">Most Likely Outlier</div>
                        <div class="mt-1 truncate font-semibold" :title="mostLikelyStyleOutlier?.file || ''">
                            {{ mostLikelyStyleOutlier ? getFileName(mostLikelyStyleOutlier.file) : "-" }}
                        </div>
                        <div class="mt-1 text-sm text-base-content/60">
                            Fit: {{ formatPercentage(mostLikelyStyleOutlier?.fit_score) }}
                        </div>
                    </div>
                    <div class="rounded-box border border-base-content/20 bg-base-200/40 p-3">
                        <div class="text-sm text-base-content/60">Best Fit</div>
                        <div class="mt-1 truncate font-semibold" :title="bestStyleFit?.file || ''">
                            {{ bestStyleFit ? getFileName(bestStyleFit.file) : "-" }}
                        </div>
                        <div class="mt-1 text-sm text-base-content/60">
                            Fit: {{ formatPercentage(bestStyleFit?.fit_score) }}
                        </div>
                    </div>
                </div>
                <details class="collapse collapse-arrow rounded-box border border-base-content/20 bg-base-200/30">
                    <summary class="collapse-title min-h-0 py-3 font-semibold">
                        How to interpret the results
                    </summary>
                    <div class="collapse-content text-base-content/75">
                        <ul class="list-disc space-y-1 pl-5">
                            <li><span class="font-medium">Folder Cohesion</span>: overall style consistency of the dataset. Higher means the dataset is more visually uniform.</li>
                            <li><span class="font-medium">Fit Score</span>: how close an image is to the dataset's average style. Lower values are more likely to be outliers.</li>
                            <li><span class="font-medium">Companion Score</span>: similarity to the image's closest match in the dataset. Lower values mean the image does not resemble the rest of the dataset strongly.</li>
                            <li>An image is more likely to be a true outlier when both its <span class="font-medium">Fit Score</span> and <span class="font-medium">Companion Score</span> are low.</li>
                        </ul>
                    </div>
                </details>
                <div class="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
                    <div
                        ref="styleCompareListRef"
                        class="min-h-0 flex-1 overflow-auto rounded-box border border-base-content/20"
                        @scroll="onStyleCompareScroll"
                    >
                        <div class="sticky top-0 z-10 grid grid-cols-[56px_minmax(0,1fr)_96px_110px_84px] gap-3 border-b border-base-content/10 bg-base-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-base-content/60">
                            <div>Rank</div>
                            <div>Image</div>
                            <div>Fit</div>
                            <div>Companion</div>
                            <div>Flag</div>
                        </div>
                        <div :style="{ height: `${styleCompareVirtualState.topPadding}px` }"></div>
                        <div
                            v-for="result in styleCompareVirtualState.items"
                            :key="result.file"
                            class="grid cursor-pointer grid-cols-[56px_minmax(0,1fr)_96px_110px_84px] items-center gap-3 border-b border-base-content/10 px-4 py-3"
                            :class="{ 'bg-primary/10': selectedStyleCompareFile === result.file }"
                            :style="{ minHeight: `${STYLE_COMPARE_ROW_HEIGHT}px` }"
                            @click="selectedStyleCompareFile = result.file"
                        >
                            <div class="tabular-nums text-sm">
                                {{ result.rank }}
                            </div>
                            <div class="min-w-0 flex flex-col justify-center">
                                <div class="truncate font-medium leading-5" :title="result.file">
                                    {{ result.fileName }}
                                </div>
                                <div class="truncate text-xs text-base-content/60 leading-4" :title="result.file">
                                    {{ result.file }}
                                </div>
                            </div>
                            <div class="tabular-nums text-sm">
                                {{ formatPercentage(result.fit_score) }}
                            </div>
                            <div class="tabular-nums text-sm">
                                {{ formatPercentage(result.companion_score) }}
                            </div>
                            <div>
                                <span v-if="result.flag === 'outlier'" class="badge badge-error badge-outline">Outlier</span>
                                <span v-else-if="result.flag === 'best-fit'" class="badge badge-success badge-outline">Best Fit</span>
                                <span v-else class="text-base-content/40">-</span>
                            </div>
                        </div>
                        <div :style="{ height: `${styleCompareVirtualState.bottomPadding}px` }"></div>
                    </div>
                    <div class="flex min-h-0 flex-col gap-3 rounded-box border border-base-content/20 bg-base-200/20 p-3">
                        <div class="text-sm font-semibold">Selected Image</div>
                        <div class="overflow-hidden rounded-box border border-base-content/20 bg-base-200">
                            <img
                                v-if="selectedStyleComparePreview"
                                :src="selectedStyleComparePreview"
                                :alt="selectedStyleCompareItem?.file || ''"
                                class="h-72 w-full object-contain"
                                loading="lazy"
                                decoding="async"
                            />
                            <div
                                v-else
                                class="flex h-72 items-center justify-center text-sm text-base-content/50"
                            >
                                Preview unavailable
                            </div>
                        </div>
                        <div v-if="selectedStyleCompareItem" class="space-y-2 text-sm">
                            <div>
                                <div class="text-sm text-base-content/60">File</div>
                                <div class="truncate font-medium" :title="selectedStyleCompareItem.file">
                                    {{ getFileName(selectedStyleCompareItem.file) }}
                                </div>
                            </div>
                            <div>
                                <div class="text-sm text-base-content/60">Path</div>
                                <div class="break-all text-sm text-base-content/70">
                                    {{ selectedStyleCompareItem.file }}
                                </div>
                            </div>
                            <div class="grid grid-cols-2 gap-2 pt-2">
                                <div class="rounded-box border border-base-content/20 bg-base-100/40 p-3">
                                    <div class="text-sm text-base-content/60">Fit Score</div>
                                    <div class="mt-1 font-semibold tabular-nums">
                                        {{ formatPercentage(selectedStyleCompareItem.fit_score) }}
                                    </div>
                                </div>
                                <div class="rounded-box border border-base-content/20 bg-base-100/40 p-3">
                                    <div class="text-sm text-base-content/60">Companion Score</div>
                                    <div class="mt-1 font-semibold tabular-nums">
                                        {{ formatPercentage(selectedStyleCompareItem.companion_score) }}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div v-else class="py-10 text-center text-base-content/60">
                No style comparison results available yet.
            </div>
        </div>
        <div class="modal-backdrop" @click="closeStyleCompareResultsModal"></div>
    </div>
    <ConfirmationAlert
        :open="isRemoveModelModalOpen"
        title="Model deletion"
        :message="`Are you sure you want to remove '${modelToBeRemoved}' from the model list?`"
        confirm-class="btn btn-error btn-outline"
        @confirm="removeModel"
        @cancel="closeRemoveModelModal"
        @update:open="(value) => !value && closeRemoveModelModal()"
    />
    <ConfirmationAlert
        :open="isDeleteModelModalOpen"
        title="Model removal"
        :message="`'${modelToBeRemoved}' was removed successfully. Do you want to delete the model from the cache folder?`"
        confirm-class="btn btn-error btn-outline"
        @confirm="deleteModel(modelToBeRemoved)"
        @cancel="closeDeleteModelModal"
        @update:open="(value) => !value && closeDeleteModelModal()"
    />
    <ConfirmationAlert
        :open="isUninstallDependenciesModalOpen"
        title="Dependencies removal"
        message="Are you sure you want to uninstall the autotagger dependencies?"
        confirm-class="btn btn-error btn-outline"
        @confirm="uninstallDependencies"
        @cancel="closeUninstallDependenciesModal"
        @update:open="(value) => !value && closeUninstallDependenciesModal()"
    />
    <ConfirmationAlert
        :open="isStyleCompareDownloadWarningOpen"
        title="Style comparison model download"
        message="The first dataset style comparison will download the Kaloscope 2.0 model if it is not already cached. This may take a while depending on your connection and the operation cannot be canceled. Do you want to continue?"
        confirm-text="Continue"
        @confirm="confirmStyleCompareDownloadWarning"
        @cancel="closeStyleCompareDownloadWarning"
        @update:open="(value) => !value && closeStyleCompareDownloadWarning()"
    />
</template>
