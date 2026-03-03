<script setup lang="ts">
import type { DatasetImage } from "../../shared/dataset";

defineProps<{
    image: DatasetImage;
    path: string;
    selected: boolean;
    suspendImage: boolean;
}>();

const emit = defineEmits<{
    (e: "click", event: MouseEvent): void;
    (e: "mouseenter"): void;
    (e: "mouseleave"): void;
    (e: "dblclick"): void;
}>();
</script>

<template>
    <div
        class="relative h-full w-full cursor-pointer overflow-hidden rounded-md border-2 bg-base-200 transition-all duration-75 hover:border-accent"
        :class="selected ? 'border-primary' : 'border-transparent'"
        :title="path.split('/').pop()"
        @click="emit('click', $event)"
        @dblclick="emit('dblclick')"
        @mouseenter="emit('mouseenter')"
        @mouseleave="emit('mouseleave')"
    >
        <template v-if="suspendImage">
            <div class="h-full w-full bg-base-300/40"></div>
        </template>
        <img
            v-else
            :src="image.filePath"
            :alt="path"
            draggable="false"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-contain"
        />
    </div>
</template>
