<script setup lang="ts">
import { useAppStatus } from '@/composables/useAppStatus';

const { active, title, message } = useAppStatus();
</script>

<template>
    <div v-if="active" class="fixed inset-0 z-60 bg-base-300/60 backdrop-blur-sm" aria-busy="true">
        <div class="absolute left-1/2 top-1/2 w-105 -translate-x-1/2 -translate-y-1/2 rounded-box bg-base-100 p-6 shadow-lg">
            <h3 class="text-xl font-semibold">{{ title }}</h3>
            <p class="mt-1 text-lg text-base-content/70">{{ message }}</p>
            <div class="mt-6 flex items-center gap-2">
                <span class="loading loading-spinner loading-md"></span>
                <span class="opacity-70">Working...</span>
            </div>
        </div>
    </div>
</template>
