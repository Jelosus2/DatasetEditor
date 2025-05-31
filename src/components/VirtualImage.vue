<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import type { Image } from '@/stores/datasetStore';

const { image, name, selected } = defineProps<{
  image: Image;
  name: string;
  selected: boolean;
}>();

const emit = defineEmits<{
  (e: 'click', event: MouseEvent): void;
  (e: 'mouseenter'): void;
  (e: 'mouseleave'): void;
  (e: 'dblclick'): void;
}>();

const container = ref<HTMLElement | null>(null);
const visible = ref(false);
let observer: IntersectionObserver | null = null;

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          visible.value = true;
        } else if (
          entry.boundingClientRect.bottom < entry.rootBounds!.top ||
          entry.boundingClientRect.top > entry.rootBounds!.bottom
        ) {
          visible.value = false;
        }
      });
    },
    { rootMargin: '200px' }
  );
  if (container.value) observer.observe(container.value);
});

onBeforeUnmount(() => {
  if (container.value && observer) observer.unobserve(container.value);
  observer?.disconnect();
});
</script>

<template>
  <div
    ref="container"
    class="flex cursor-pointer items-center justify-center rounded-md border-1 border-black bg-base-200 select-none dark:border-white"
    :class="{ 'border-3 !border-blue-600 bg-blue-400': selected }"
    @click="emit('click', $event)"
    @mouseenter="emit('mouseenter')"
    @mouseleave="emit('mouseleave')"
  >
    <img
      v-if="visible"
      :src="image.filePath"
      :alt="name"
      @dblclick="emit('dblclick')"
      draggable="false"
      class="h-full w-full rounded-md object-scale-down"
    />
  </div>
</template>
