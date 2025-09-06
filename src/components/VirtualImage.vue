<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type { Image } from '@/stores/datasetStore';
import { getImageUpdateVersion } from '@/services/imageUpdateChannel';

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
const thumbSrc = ref<string>('');
const loadingThumb = ref(false);
let observer: IntersectionObserver | null = null;

async function fetchThumb() {
  if (loadingThumb.value || thumbSrc.value) return;

  loadingThumb.value = true;
  const target = 256;
  const src = (await window.ipcRenderer.invoke<unknown>('get_thumbnail', image.path, target)) as string | null;
  if (src) thumbSrc.value = src;
  loadingThumb.value = false;
}

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
    { rootMargin: '100px' }
  );
  if (container.value) observer.observe(container.value);
});

onBeforeUnmount(() => {
  if (container.value && observer) observer.unobserve(container.value);
  observer?.disconnect();
});

watch(visible, async (isVisible) => {
  if (isVisible) {
    await fetchThumb();
  } else {
    thumbSrc.value = '';
  }
});

watch(() => image.filePath, async () => {
  thumbSrc.value = '';
  if (visible.value) await fetchThumb();
});

watch(() => getImageUpdateVersion(image.path), () => {
  thumbSrc.value = '';
  if (visible.value) void fetchThumb();
});
</script>

<template>
  <div
    ref="container"
    class="flex cursor-pointer items-center justify-center rounded-md border-1 border-black bg-base-200 select-none dark:border-white"
    style="content-visibility:auto; contain-intrinsic-size: 150px 150px;"
    :class="{ 'border-3 !border-blue-600 bg-blue-400': selected }"
    :title="name.split('/').pop()"
    @click="emit('click', $event)"
    @mouseenter="emit('mouseenter')"
    @mouseleave="emit('mouseleave')"
    @dblclick="emit('dblclick')"
  >
    <template v-if="visible">
      <img
        v-if="thumbSrc"
        :src="thumbSrc"
        :alt="name"
        draggable="false"
        loading="lazy"
        decoding="async"
        class="h-full w-full rounded-md object-scale-down"
      />
      <div v-else class="h-full w-full flex items-center justify-center">
        <span class="loading loading-spinner"></span>
      </div>
    </template>
  </div>
</template>
