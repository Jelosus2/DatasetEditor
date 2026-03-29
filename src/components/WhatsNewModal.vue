<script setup lang="ts">
import type { WhatsNewEntry } from '../../shared/whats-new';

defineProps<{
    currentVersion: string;
    entries: WhatsNewEntry[];
}>();

const emit = defineEmits<{
    (e: "close"): void;
}>();

function close() {
    emit("close");
}
</script>

<template>
    <div class="modal modal-open z-50" tabindex="-1">
        <div class="modal-box w-11/12 max-w-4xl">
            <div class="flex items-center justify-between border-b-2 pb-2 dark:border-base-content/10">
                <div>
                    <div class="text-lg font-semibold">What's New?</div>
                    <div class="text-sm text-base-content/60">
                        Changes included up to version {{ currentVersion }}
                    </div>
                </div>
                <label class="cursor-pointer" @click="close">✕</label>
            </div>
            <div class="mt-4 max-h-[70vh] overflow-auto pr-1">
                <div v-if="entries.length === 0" class="text-base-content/70">
                    No release notes are available for this build.
                </div>
                <div v-else class="space-y-4">
                    <section
                        v-for="entry in entries"
                        :key="entry.version"
                        class="rounded-box border border-base-content/20 bg-base-200/30 p-4"
                    >
                        <div class="font-semibold">Version {{ entry.version }}</div>
                        <ul class="mt-3 list-disc space-y-2 pl-5 text-base-content/85">
                            <li v-for="update in entry.updates" :key="update">
                                {{ update }}
                            </li>
                        </ul>
                    </section>
                </div>
            </div>
        </div>
        <div class="modal-backdrop" @click="close"></div>
    </div>
</template>
