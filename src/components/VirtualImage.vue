<script setup lang="ts">
import type { DatasetImage } from "../../shared/dataset";

withDefaults(
    defineProps<{
        image: DatasetImage;
        selected: boolean;
        suspendImage?: boolean;
    }>(),
    {
        suspendImage: false
    }
)

const emit = defineEmits<{
    (e: "click", event: MouseEvent): void;
    (e: "mouseenter"): void;
    (e: "mouseleave"): void;
    (e: "dblclick"): void;
    (e: "contextmenu", event: MouseEvent): void;
}>();
</script>

<template>
    <div
        class="relative h-full w-full cursor-pointer overflow-hidden rounded-md border-2 bg-base-200 transition-all duration-75 hover:border-accent"
        :class="selected ? 'border-primary' : 'border-transparent'"
        :title="image.path.split(/\/|\\|\\\\/).pop()"
        @click="emit('click', $event)"
        @dblclick="emit('dblclick')"
        @mouseenter="emit('mouseenter')"
        @mouseleave="emit('mouseleave')"
        @contextmenu.prevent="emit('contextmenu', $event)"
    >
        <template v-if="suspendImage">
            <div class="h-full w-full bg-base-300/40"></div>
        </template>
        <img
            v-else
            :src="image.filePath"
            :alt="image.path"
            draggable="false"
            loading="lazy"
            decoding="async"
            class="h-full w-full object-contain"
        />
    </div>
</template>
