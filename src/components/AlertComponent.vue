<script setup lang="ts">
import type { AlertType } from "@/types/alert";

defineProps<{
    message: string;
    timestamp: number;
    type: AlertType;
}>();
</script>

<template>
    <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="transform -translate-y-8 opacity-0"
        enter-to-class="transform translate-y-0 opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="transform translate-y-0 opacity-100"
        leave-to-class="transform -translate-y-8 opacity-0"
    >
        <div
            v-if="message"
            :key="timestamp"
            role="alert"
            class="fixed top-10 left-1/2 z-70 alert flex -translate-x-1/2 transform items-center justify-center"
            :class="{
                'alert-info': type === 'info',
                'alert-success': type === 'success',
                'alert-warning': type === 'warning',
                'alert-error': type === 'error',
            }"
        >
            <span>{{ message }}</span>
        </div>
    </Transition>
</template>
