<script setup lang="ts">
import type { DuplicateMethod } from "../../shared/image";

import VirtualImage from "@/components/VirtualImage.vue";

import { useDatasetStore } from "@/stores/datasetStore";
import { ImageService } from "@/services/imageService";
import { FileService } from "@/services/fileService";
import { useAlert } from "@/composables/useAlert";
import { ref, computed, watch } from "vue";

import DeleteIcon from "@/assets/icons/trash-bin.svg";

const MAX_DIMENSION_WORKERS = 4;

const method = ref<DuplicateMethod>("dhash");
const threshold = ref(10);
const scanning = ref(false);
const trashing = ref(false);
const keepMode = ref(false);
const groups = ref<string[][]>([]);
const errorMessage = ref("");
const kept = ref<Set<string>>(new Set());
const dimensions = ref<Record<string, string>>({});
const processed = ref(0);
const total = ref(0);

let scanRequestId = 0;
let dimensionsRequestId = 0;

const datasetStore = useDatasetStore();
const { showAlert } = useAlert();

const fileService = new FileService();
const imageService = new ImageService([
    {
        channel: "image:duplicate-progress",
        handler: (progress) => {
            processed.value = progress.processed ?? processed.value;
            total.value = progress.total ?? total.value;
        }
    }
]);

const isDatasetLoaded = computed(() => datasetStore.dataset.size > 0);
const progressPercent = computed(() => (total.value === 0 ? 0 : Math.round((processed.value / total.value) * 100)));
const groupsCount = computed(() => groups.value.length);
const itemsCount = computed(() => groups.value.reduce((acc, group) => acc + group.length, 0));

const trashableCount = computed(() => {
    if (!keepMode.value)
        return 0;

    let count = 0;

    for (const group of groups.value) {
        if (!group.some((key) => kept.value.has(key)))
            continue;

        for (const key of group) {
            if (!kept.value.has(key))
                count++;
        }
    }

    return count;
});

watch(() => groups.value, (nextGroups) => {
    prefetchMissingDimensions(nextGroups.flat());
});

function resetState() {
    scanning.value = false;
    trashing.value = false;
    errorMessage.value = "";
    groups.value = [];
    kept.value = new Set();
    dimensions.value = {};
    processed.value = 0;
    total.value = 0;
}

function getSortedDatasetPaths() {
    return Array.from(datasetStore.dataset.values(), (image) => image.path);
}

function buildPathToKeyMap() {
    const map = new Map<string, string>();

    for (const [key, image] of datasetStore.dataset.entries())
        map.set(image.path, key);

    return map;
}

function pruneGroupsAfterRemoval(removedKeys: Set<string>) {
    groups.value = groups.value
        .map((group) => group.filter((key) => !removedKeys.has(key)))
        .filter((group) => group.length > 1);

    for (const key of removedKeys)
        delete dimensions.value[key];

    kept.value = new Set([...kept.value].filter((key) => !removedKeys.has(key)));
}

function toggleKeep(key: string) {
    if (kept.value.has(key))
        kept.value.delete(key);
    else
        kept.value.add(key);
}

function keepFirstInGroup(group: string[]) {
    if (group.length === 0)
        return;

    kept.value.add(group[0]);
}

function openFullImage(key: string) {
    window.dispatchEvent(new CustomEvent("open-image", { detail: key }));
}

async function scan() {
    const currentScanId = ++scanRequestId;

    scanning.value = true;
    errorMessage.value = "";
    groups.value = [];
    kept.value = new Set();
    dimensions.value = {};
    processed.value = 0;

    const files = getSortedDatasetPaths();
    const pathToKey = buildPathToKeyMap();
    total.value = files.length;

    const result = await imageService.getDuplicateGroups(files, method.value, threshold.value);
    if (currentScanId !== scanRequestId)
        return;

    if (result.error) {
        errorMessage.value = result.message!;
        return;
    }

    const mapped = result.groups
        .map((group) => group.map((path) => pathToKey.get(path)).filter((key): key is string => !!key))
        .filter((group) => group.length > 1);

    groups.value = mapped;
    showAlert("success", mapped.length > 0 ? `Found ${mapped.length} duplicate group(s)` : 'No duplicates found');

    prefetchMissingDimensions(mapped.flat())

    if (currentScanId === scanRequestId)
        scanning.value = false;
}

async function prefetchMissingDimensions(keys: string[]) {
    const missing = keys.filter((key) => !(key in dimensions.value));
    if (missing.length === 0)
        return;

    const currentDimensionsRequestId = ++dimensionsRequestId;
    let index = 0;

    const runWorker = async () => {
        while (index < missing.length) {
            if (currentDimensionsRequestId !== dimensionsRequestId)
                return;

            const i = index++;
            const key = missing[i];
            const filePath = datasetStore.dataset.get(key)?.path;
            if (!filePath)
                continue;

            const metadata = await imageService.getImageDimensions(filePath);
            if (currentDimensionsRequestId !== dimensionsRequestId)
                return;

            if (metadata.width > 0 && metadata.height > 0)
                dimensions.value[key] = `${metadata.width}x${metadata.height}`;
        }
    };

    await Promise.all(Array.from({ length: MAX_DIMENSION_WORKERS }, runWorker));
}

async function trashImage(key: string) {
    const path = datasetStore.dataset.get(key)?.path;
    if (!path)
        return;

    const result = await fileService.trashFiles([path]);
    if (result.error) {
        showAlert("error", result.message);
        return;
    }

    datasetStore.removeImage(key);
    pruneGroupsAfterRemoval(new Set([key]));
    showAlert("success", result.message);
}

async function trashNotKept() {
    if (!keepMode.value)
        return;

    const toTrashKeys = new Set<string>();

    for (const group of groups.value) {
        if (!group.some((key) => kept.value.has(key)))
            continue;

        for (const key of group) {
            if (!kept.value.has(key))
                toTrashKeys.add(key);
        }
    }

    if (toTrashKeys.size === 0) {
        showAlert("info", "Mark at least one image as Keep in a group first");
        return;
    }

    const paths = Array.from(toTrashKeys)
        .map((key) => datasetStore.dataset.get(key)?.path)
        .filter((path): path is string => !!path);

    if (paths.length === 0)
        return;

    trashing.value = true;

    const result = await fileService.trashFiles(paths);
    if (result.error) {
        trashing.value = false;
        showAlert("error", result.message);
        return;
    }

    datasetStore.removeImages(toTrashKeys);
    pruneGroupsAfterRemoval(toTrashKeys);

    trashing.value = false;
    showAlert("success", result.message);
}
</script>

<template>
    <input type="checkbox" id="duplicate_finder_modal" class="modal-toggle" />
    <div class="modal z-50" role="dialog">
        <div class="modal-box h-11/12 max-h-11/12 w-11/12 max-w-6xl overflow-hidden">
            <label for="duplicate_finder_modal" class="absolute right-2 top-1 cursor-pointer" @click="resetState">✕</label>
            <div class="flex h-full min-h-0 flex-col gap-3">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b-2 pb-2 dark:border-base-content/10">
                    <div class="flex items-center gap-3">
                        <span class="opacity-70">Method:</span>
                        <select v-model="method" class="select w-fit outline-none!">
                            <option value="phash">Perceptual (robust)</option>
                            <option value="dhash">Perceptual (fast)</option>
                        </select>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="btn btn-outline" :disabled="groups.length === 0 || scanning" @click="resetState">Reset</button>
                        <button class="btn btn-primary" :disabled="!isDatasetLoaded || scanning" @click="scan">
                            <span v-if="scanning" class="loading loading-spinner mr-1 h-4 w-4"></span>
                            <span>{{ scanning ? "Scanning..." : "Scan" }}</span>
                        </button>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                    <span class="text-sm opacity-70">Similarity threshold:</span>
                    <input type="range" class="range [--range-fill:0] [--range-thumb:var(--color-base-100)] range-sm w-64" min="0" max="64" step="1" v-model.number="threshold" />
                    <span class="text-sm">{{ threshold }}</span>
                    <span class="text-sm opacity-60">(0 exact - 64 very loose)</span>
                </div>
                <div v-if="scanning" class="flex items-center gap-3">
                    <progress class="progress progress-primary w-64" :value="processed" :max="total"></progress>
                    <span class="text-sm opacity-70">{{ processed }} / {{ total }} ({{ progressPercent }}%)</span>
                </div>
                <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div class="rounded-box border border-base-content/20 px-3 py-2">
                        <div class="text-sm uppercase opacity-60">Groups</div>
                        <div class="text-lg font-semibold">{{ groupsCount }}</div>
                    </div>
                    <div class="rounded-box border border-base-content/20 px-3 py-2">
                        <div class="text-sm uppercase opacity-60">Candidates</div>
                        <div class="text-lg font-semibold">{{ itemsCount }}</div>
                    </div>
                    <div class="rounded-box border border-base-content/20 px-3 py-2">
                        <div class="text-sm uppercase opacity-60">Trash Queue</div>
                        <div class="text-lg font-semibold">{{ trashableCount }}</div>
                    </div>
                </div>
                <div v-if="!isDatasetLoaded" class="rounded-box bg-warning/20 p-3 text-center">
                    Dataset not loaded. Load a dataset to search for duplicates.
                </div>
                <div v-if="errorMessage" class="rounded-box bg-error p-2 text-center font-bold">
                    {{ errorMessage }}
                </div>
                <div v-if="!scanning && groups.length === 0 && isDatasetLoaded" class="text-center opacity-70">
                    No results yet. Click Scan to start.
                </div>
                <template v-if="groups.length > 0">
                    <div class="flex items-center gap-4">
                        <div class="text-sm">Found {{ groups.length }} group(s) of duplicates</div>
                        <label class="flex cursor-pointer select-none items-center gap-2 text-sm">
                            <input type="checkbox" class="checkbox checkbox-sm" v-model="keepMode" />
                            <span>Keep mode</span>
                        </label>
                        <button
                            v-if="keepMode"
                            class="btn btn-error btn-sm ml-auto"
                            :disabled="trashing || trashableCount === 0"
                            @click="trashNotKept"
                        >
                            <span v-if="trashing" class="loading loading-spinner mr-1 h-4 w-4"></span>
                            <span>{{ trashing ? "Moving to trash..." : `Move ${trashableCount} to trash` }}</span>
                        </button>
                    </div>
                    <div class="min-h-0 flex-1 overflow-y-auto pr-1">
                        <div class="flex flex-col gap-4">
                            <div
                                v-for="(group, idx) in groups"
                                :key="idx"
                                class="rounded-box border p-2 dark:border-base-content/20"
                                style="content-visibility: auto; contain-intrinsic-size: 200px 200px;"
                            >
                                <div class="mb-2 flex items-center justify-between">
                                    <div class="opacity-70">Group {{ idx + 1 }} ({{ group.length }} files)</div>
                                    <button
                                        v-if="keepMode"
                                        class="btn btn-sm btn-outline"
                                        @click="keepFirstInGroup(group)"
                                    >
                                        Keep first
                                    </button>
                                </div>
                                <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                                    <div v-for="key in group" :key="key" class="group relative flex flex-col items-center gap-1">
                                        <div class="relative h-32 w-full overflow-hidden">
                                            <VirtualImage
                                                :image="datasetStore.dataset.get(key)!"
                                                :selected="false"
                                                class="h-full w-full"
                                                @click="openFullImage(key)"
                                            />
                                            <div class="absolute left-1 top-1 rounded bg-base-200/80 px-1 py-0.5 text-sm dark:bg-base-200/80">
                                                {{ dimensions[key] || "" }}
                                            </div>
                                            <label
                                                v-if="keepMode"
                                                class="absolute left-1 bottom-1 flex cursor-pointer items-center gap-1 rounded bg-base-200/70 px-1 py-0.5"
                                            >
                                                <input
                                                    type="checkbox"
                                                    class="checkbox checkbox-xs"
                                                    :checked="kept.has(key)"
                                                    @click.stop="toggleKeep(key)"
                                                />
                                                <span class="text-sm">Keep</span>
                                            </label>
                                            <button
                                                class="absolute right-1 top-1 rounded cursor-pointer bg-base-200/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-error"
                                                title="Move to trash"
                                                @click.stop="trashImage(key)"
                                            >
                                                <DeleteIcon class="w-5 h-5" />
                                            </button>
                                        </div>
                                        <div class="w-full truncate text-sm" :title="key.split('/').pop()">
                                            {{ key.split('/').pop() }}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </template>
            </div>
        </div>
        <label class="modal-backdrop" for="duplicate_finder_modal"></label>
    </div>
</template>
