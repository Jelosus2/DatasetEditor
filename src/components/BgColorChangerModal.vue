<script setup lang="ts">
import { ImageService } from "@/services/imageService";
import { ref, computed } from "vue";

const props = defineProps<{
    selectedImages: Set<string>;
}>();

const imageService = new ImageService();

const selectedColor = ref("#ffffff");
const isApplying = ref(false);

const selectedCount = computed(() => props.selectedImages.size);

const predefined = [
    "#ffffff", "#000000", "#f43f5e", "#ef4444", "#f97316", "#eab308",
    "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#a855f7"
];

function closeModal() {
    const modal = document.getElementById("background_color_modal") as HTMLInputElement | null;
    if (modal)
        modal.checked = false;
}

async function changeColor() {
    isApplying.value = true;
    const error = await imageService.applyBackgroundColor([...props.selectedImages], selectedColor.value);
    isApplying.value = false;

    if (!error)
        closeModal();
}
</script>

<template>
    <input type="checkbox" id="background_color_modal" class="modal-toggle" />
    <div class="modal z-50" role="dialog">
        <div class="modal-box w-11/12 max-w-xl">
            <label for="background_color_modal" class="absolute right-2 top-1 cursor-pointer">✕</label>
            <div class="space-y-5">
                <div>
                    <h3 class="text-lg font-semibold">Apply Background Color</h3>
                    <p class="text-base-content/70">
                        Selected images:
                        <span class="font-semibold text-info">{{ selectedCount }}</span>
                    </p>
                </div>
                <div class="rounded-box border border-base-content/20 bg-base-200/40 p-3">
                    <div class="mb-2 font-medium">Current color</div>
                    <div class="flex items-center gap-3">
                        <div
                            class="h-10 w-10 rounded-box border border-base-content/30"
                            :style="{ backgroundColor: selectedColor }"
                        ></div>
                        <div class="font-mono">{{ selectedColor.toUpperCase() }}</div>
                        <input
                            v-model="selectedColor"
                            type="color"
                            class="h-10 w-14 cursor-pointer rounded border border-base-content/20 bg-transparent p-1"
                        />
                    </div>
                </div>
                <div>
                    <div class="mb-2 font-medium">Preset colors</div>
                    <div class="grid grid-cols-6 gap-2">
                        <button
                            v-for="color in predefined"
                            :key="color"
                            class="h-8 w-full rounded-md border transition cursor-pointer"
                            :class="selectedColor.toLowerCase() == color.toLowerCase()
                                ? 'ring-2 ring-info border-base-content/60'
                                : 'border-base-content/20 hover:border-base-content/60'"
                            :style="{ backgroundColor: color }"
                            :title="color"
                            @click="selectedColor = color"
                        ></button>
                    </div>
                </div>
            </div>
            <div class="modal-action mt-6">
                <label for="background_color_modal" class="btn btn-outline">Close</label>
                <button
                    class="btn btn-primary"
                    :disabled="isApplying || selectedCount === 0"
                    @click="changeColor"
                >
                    <span v-if="isApplying" class="loading loading-spinner"></span>
                    <span>{{ isApplying ? "Applying..." : "Apply color" }}</span>
                </button>
            </div>
        </div>
        <label class="modal-backdrop" for="background_color_modal"></label>
    </div>
</template>
