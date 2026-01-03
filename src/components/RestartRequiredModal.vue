<script setup lang="ts">
import { useSettingsStore } from "@/stores/settingsStore";
import { computed } from "vue";

const settingsStore = useSettingsStore();
const isOpen = computed(() => settingsStore.showRestartPrompt);
</script>

<template>
    <div class="modal z-50" :class="{ 'modal-open': isOpen }">
        <div class="modal-box">
            <h3 class="text-xl font-semibold">Restart required</h3>
            <p class="text-lg text-base-content/70 mt-2">
                You changed a setting that requires a restart. Restart now or apply it next time you open the app.
            </p>
            <div class="modal-action">
                <button class="btn btn-outline" @click="settingsStore.dismissRestartPrompt()">
                    Later
                </button>
                <button class="btn btn-error btn-outline" @click="settingsStore.restartApp()">
                    Restart now
                </button>
            </div>
        </div>
        <div class="modal-backdrop" @click="settingsStore.dismissRestartPrompt()"></div>
    </div>
</template>
