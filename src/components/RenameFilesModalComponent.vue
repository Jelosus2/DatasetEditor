<script setup lang="ts">
import type { DatasetRenameOptions, RenameMode, RenamePreviewItem, RenameProgressPayload } from "../../shared/dataset";

import { useDatasetStore } from "@/stores/datasetStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { FileService } from "@/services/fileService";
import { useAlert } from "@/composables/useAlert";
import { ref, computed, watch } from "vue";

const PREVIEW_LIMIT = 8;

const renameMode = ref<RenameMode>("template");
const startNumberInput = ref<number | null>(1);
const paddingInput = ref(0);
const templateInput = ref("{index}_{name}");
const loading = ref(false);
const previewLoading = ref(false);
const processed = ref(0);
const total = ref(0);
const phase = ref<RenameProgressPayload["phase"]>("prepare");
const currentPath = ref("");
const preview = ref<RenamePreviewItem[]>([]);
const conflicts = ref(0);
const previewStale = ref(true);

const datasetStore = useDatasetStore();
const settingsStore = useSettingsStore();
const { showAlert } = useAlert();

const fileService = new FileService();
fileService.onRenameProgress = (progress) => {
    processed.value = progress.processed ?? processed.value;
    total.value = progress.total ?? total.value;
    phase.value = progress.phase ?? phase.value;
    currentPath.value = progress.currentPath ?? "";
}

const filesCount = computed(() => datasetStore.dataset.size);
const isDatasetLoaded = computed(() => filesCount.value > 0);
const percent = computed(() => (total.value === 0 ? 0 : Math.round((processed.value / total.value) * 100)));
const visiblePreview = computed(() => preview.value.slice(0, PREVIEW_LIMIT));
const hiddenPreviewCount = computed(() => Math.max(0, preview.value.length - PREVIEW_LIMIT));

const phaseLabel = computed(() => {
    const labels: Record<RenameProgressPayload["phase"], string> = {
        prepare: "Preparing rename operations...",
        rename_temp: "Staging files...",
        rename_final: "Applying new names...",
        rollback: "Rolling back changes...",
        done: "Rename completed"
    };

    return labels[phase.value];
});

const canRename = computed(() =>
    isDatasetLoaded.value &&
    !loading.value &&
    !previewLoading.value &&
    !previewStale.value &&
    preview.value.length > 0 &&
    conflicts.value === 0
);

watch([renameMode, startNumberInput, paddingInput, templateInput], () => {
    preview.value = [];
    conflicts.value = 0;
    previewStale.value = true;
});

function resetState() {
    renameMode.value = "template";
    startNumberInput.value = 1;
    paddingInput.value = 0;
    templateInput.value = "{index}_{name}";
    loading.value = false;
    previewLoading.value = false;
    processed.value = 0;
    total.value = 0;
    phase.value = "prepare";
    currentPath.value = "";
    preview.value = [];
    conflicts.value = 0;
    previewStale.value = true;
}

function normalizeStartAt() {
    const value = Number(startNumberInput.value);
    if (!Number.isFinite(value) && value < 1)
        return 1;

    return Math.trunc(value);
}

function normalizePadding() {
    const value = Number(paddingInput.value);
    if (!Number.isFinite(value) || value < 0)
        return 0;

    return Math.min(12, Math.trunc(value));
}

function buildOptions(dryRun: boolean): DatasetRenameOptions {
    return {
        mode: renameMode.value,
        startAt: normalizeStartAt(),
        padding: normalizePadding(),
        template: templateInput.value,
        dryRun
    };
}

function getDatasetPaths() {
    const paths = Array.from(datasetStore.dataset.values()).map((image) => image.path);
    if (!settingsStore.sortImagesAlphabetically)
        return paths;

    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
    paths.sort((a, b) => {
        const an = a.split(/[/\\]/).pop()?.toLowerCase() ?? a.toLowerCase();
        const bn = b.split(/[/\\]/).pop()?.toLowerCase() ?? b.toLowerCase();
        return collator.compare(an, bn);
    });

    return paths;
}

async function generatePreview() {
    const files = getDatasetPaths();
    previewLoading.value = true;

    const result = await fileService.renameFiles(files, buildOptions(true));

    preview.value = result.preview ?? [];
    conflicts.value = result.conflicts ?? 0;
    previewStale.value = false;

    if (result.error)
        showAlert("error", result.message!);
    previewLoading.value = false;
}

async function renameFiles() {
    if (previewStale.value || preview.value.length === 0)
        await generatePreview();

    if (conflicts.value > 0) {
        showAlert("warning", `Resolve ${conflicts.value} conflict(s) before renaming`);
        return;
    }
    const files = getDatasetPaths();

    loading.value = true;
    processed.value = 0;
    total.value = 0;
    phase.value = "prepare";
    currentPath.value = "";

    const result = await fileService.renameFiles(files, buildOptions(false));
    if (result.mappings && result.mappings.length > 0)
        datasetStore.renameImages(result.mappings);

    if (result.error)
        showAlert("error", result.message!);
    else
        showAlert("success", `Renamed ${result.renamedCount ?? 0} file(s)`);

    preview.value = [];
    conflicts.value = 0;
    previewStale.value = true;
    loading.value = false;
}
</script>

<template>
    <input type="checkbox" id="rename_files_modal" class="modal-toggle" />
    <div class="modal z-50" role="dialog">
        <div class="modal-box w-11/12 max-w-4xl">
            <label for="rename_files_modal" class="absolute right-2 top-1 cursor-pointer" @click="resetState">✕</label>
            <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between border-b-2 pb-2 dark:border-base-content/10">
                    <div class="text-lg font-semibold">Rename Files</div>
                    <div class="badge badge-info pb-0.5">{{ filesCount }} file(s)</div>
                </div>
                <div class="grid gap-3 md:grid-cols-2">
                    <div class="rounded-box border border-base-content/20 p-3">
                        <div class="mb-2 font-semibold opacity-80">Naming Mode</div>
                        <div class="join w-full">
                            <button
                                class="btn join-item w-1/2"
                                :class="renameMode === 'template' ? 'btn-primary' : 'btn-outline'"
                                @click="renameMode = 'template'"
                            >Template</button>
                            <button
                                class="btn join-item w-1/2"
                                :class="renameMode === 'sequence' ? 'btn-primary' : 'btn-outline'"
                                @click="renameMode = 'sequence'"
                            >Sequence</button>
                        </div>
                    </div>
                    <div class="text-base rounded-box border border-base-content/20 p-3">
                        <div class="mb-2 font-semibold opacity-80">Index Options</div>
                        <div class="grid grid-cols-2 gap-2">
                            <label class="input w-full outline-none!">
                                <span class="label">Start</span>
                                <input v-model.number="startNumberInput" type="number" min="1" />
                            </label>
                            <label class="input w-full outline-none!">
                                <span class="label">Padding</span>
                                <input v-model.number="paddingInput" type="number" min="0" max="12" />
                            </label>
                        </div>
                    </div>
                </div>
                <div class="text-base rounded-box border border-base-content/20 p-3">
                    <div class="mb-2 font-semibold opacity-80">Name Template</div>
                    <label class="input w-full outline-none!">
                        <input
                            v-model.trim="templateInput"
                            :disabled="renameMode !== 'template'"
                            type="text"
                            placeholder="{index}_{name}"
                        />
                    </label>
                    <div class="mt-2 text-xs opacity-70">
                        Tokens: <code>{index}</code>, <code>{name}</code>, <code>{ext}</code>
                    </div>
                </div>
                <div class="rounded-box border border-base-content/20 p-3">
                    <div class="mb-2 flex items-center justify-between">
                        <div class="font-semibold opacity-80">Preview</div>
                        <button class="btn btn-outline" :disabled="previewLoading || loading || !isDatasetLoaded" @click="generatePreview">
                            <span v-if="previewLoading" class="loading loading-spinner loading-xs"></span>
                            {{ previewLoading ? "Building..." : "Generate Preview" }}
                        </button>
                    </div>
                    <div v-if="preview.length === 0" class="opacity-70">
                        Generate a preview to validate names and detect conflicts.
                    </div>
                    <div v-else class="overflow-hidden rounded-box border border-base-content/10">
                        <div v-for="item in visiblePreview" :key="item.from" class="flex items-start justify-between gap-3 border-b border-base-content/10 px-3 py-2 last:border-b-0">
                            <div class="min-w-0 flex-1">
                                <div class="truncate text-xs opacity-70">{{ item.fromName }}</div>
                                <div class="truncate font-mono">{{ item.toName }}</div>
                                <div v-if="item.hasConflict" class="mt-1 text-xs text-error">
                                    {{ item.reason }}
                                </div>
                            </div>
                            <div class="badge" :class="item.hasConflict ? 'badge-error' : 'badge-success'">
                                {{ item.hasConflict ? "Conflict" : "OK" }}
                            </div>
                        </div>
                    </div>
                    <div v-if="hiddenPreviewCount > 0" class="pt-2 text-right text-xs opacity-70">
                        +{{ hiddenPreviewCount }} more...
                    </div>
                </div>
                <div v-if="conflicts > 0" class="alert alert-warning">
                    <span>{{ conflicts }} conflict(s) detected. Adjust options and regenerate preview.</span>
                </div>
                <div v-if="loading" class="rounded-box border border-base-content/20 p-3">
                    <div class="mb-2 flex items-center justify-between">
                        <span>{{ phaseLabel }}</span>
                        <span>{{ processed }} / {{ total }} ({{ percent }}%)</span>
                    </div>
                    <progress class="progress progress-primary w-full" :value="processed" :max="total"></progress>
                    <div v-if="currentPath" class="mt-2 truncate text-xs opacity-70">{{ currentPath }}</div>
                </div>

                <div class="flex items-center justify-end gap-2">
                    <button class="btn" :disabled="loading || previewLoading" @click="resetState">Reset</button>
                    <button class="btn btn-primary" :disabled="!canRename" @click="renameFiles">
                        <span v-if="loading" class="loading loading-spinner mr-1 h-4 w-4"></span>
                        <span>{{ loading ? "Renaming..." : "Rename Files" }}</span>
                    </button>
                </div>
            </div>
        </div>
        <label class="modal-backdrop" for="rename_files_modal" @click="resetState"></label>
    </div>
</template>
