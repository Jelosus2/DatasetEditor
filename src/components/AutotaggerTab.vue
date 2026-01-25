<script setup lang="ts">
import AutotaggerConsole from "@/components/AutotaggerConsole.vue";

import { TaggerService } from "@/services/taggerService";
import { ref } from "vue";

import DownloadIcon from "@/assets/icons/update-download.svg";

const selectedModels = ref<Set<string>>(new Set());
const consoleRef = ref<InstanceType<typeof AutotaggerConsole> | null>(null);
const isInstalling = ref(false);
const isServiceStarting = ref(false);
const isServiceRunning = ref(false);
const device = ref("Unknown");

const models = [
    "SmilingWolf/wd-eva02-large-tagger-v3",
    "SmilingWolf/wd-vit-large-tagger-v3",
    "SmilingWolf/wd-swinv2-tagger-v3",
    "SmilingWolf/wd-vit-tagger-v3",
    "SmilingWolf/wd-convnext-tagger-v3",
    "SmilingWolf/wd-v1-4-swinv2-tagger-v2",
    "SmilingWolf/wd-v1-4-moat-tagger-v2",
    "SmilingWolf/wd-v1-4-convnext-tagger-v2",
    "SmilingWolf/wd-v1-4-vit-tagger-v2",
    "SmilingWolf/wd-v1-4-convnextv2-tagger-v2",
    "SmilingWolf/wd-v1-4-convnext-tagger",
    "SmilingWolf/wd-v1-4-vit-tagger"
];

const taggerService = new TaggerService();

taggerService.onData = (line) => consoleRef.value?.write(line);
taggerService.onServiceStarted = async () => {
    if (isServiceRunning.value)
        return;

    device.value = await taggerService.getDevice();
    isServiceRunning.value = true;
    isServiceStarting.value = false;
}
taggerService.onServiceStopped = () => {
    device.value = "Unknown";
    isServiceRunning.value = false;
    isServiceStarting.value = false;
}

function toggleModel(model: string) {
    if (selectedModels.value.has(model))
        selectedModels.value.delete(model);
    else
        selectedModels.value.add(model);
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

function downloadModel(model: string) {
    // TODO: Add logic
}
</script>

<template>
    <div class="tab-content min-h-0 border-t-base-300 bg-base-100">
        <div class="flex h-full">
            <aside class="w-110 border-r border-base-content/20 p-4 flex flex-col min-h-0">
                <div class="text-sm text-base-content/70">
                    Models will be downloaded to the Hugging Face cache directory set in Settings.
                </div>
                <div class="mt-3 flex-1 overflow-auto space-y-2 pr-1">
                    <div
                        v-for="model in models"
                        :key="model"
                        class="flex cursor-pointer items-center justify-between rounded-box border px-3 py-2 transition"
                        :class="selectedModels.has(model)
                            ? 'border-primary bg-primary/5'
                            : 'border-base-content/20 hover:border-base-content/10'"
                        @click="toggleModel(model)"
                    >
                        <span class="truncate text-sm font-medium">{{ model }}</span>
                        <button class="btn btn-xs btn-accent btn-outline" :disabled="!isServiceRunning" @click.stop="downloadModel(model)">
                            <DownloadIcon class="h-5 w-5" />
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
