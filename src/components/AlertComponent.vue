<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps({
  message: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Number,
    required: true,
  },
  duration: {
    type: Number,
    default: 2000,
  },
  type: {
    type: String,
    default: 'info',
  },
});

const isVisible = ref(false);

watch([() => props.message, () => props.timestamp], () => {
  isVisible.value = true;
  setTimeout(() => {
    isVisible.value = false;
  }, props.duration);
});
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
      v-if="isVisible"
      role="alert"
      class="fixed top-10 left-1/2 z-5 alert -translate-x-1/2 transform"
      :class="{
        'alert-info': type === 'info',
        'alert-success': type === 'success',
        'alert-error': type === 'error',
      }"
    >
      <span>{{ message }}</span>
    </div>
  </Transition>
</template>
