<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useDatasetStore } from '@/stores/datasetStore';
import { cropImage } from '@/services/imageService';

const props = defineProps<{ selectedImages: Set<string> }>();
const emit = defineEmits(['trigger_alert']);

const datasetStore = useDatasetStore();
const imageKeys = computed(() => Array.from(datasetStore.images.keys()));
const currentIndex = ref(0);
const imageElement = ref<HTMLImageElement | null>(null);

const crop = ref({ x: 0, y: 0, width: 0, height: 0 });
let startX = 0;
let startY = 0;
const isSelecting = ref(false);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function resetSelection() {
  crop.value = { x: 0, y: 0, width: 0, height: 0 };
}

function showImage() {
  const key = imageKeys.value[currentIndex.value];
  const img = datasetStore.images.get(key);
  if (!img || !imageElement.value) return;
  imageElement.value.src = img.filePath;
  resetSelection();
}

function prev() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    nextTick(showImage);
  }
}

function next() {
  if (currentIndex.value < imageKeys.value.length - 1) {
    currentIndex.value++;
    nextTick(showImage);
  }
}

function startSelection(e: MouseEvent) {
  if (!imageElement.value) return;
  const rect = imageElement.value.getBoundingClientRect();
  startX = clamp(e.clientX - rect.left, 0, rect.width);
  startY = clamp(e.clientY - rect.top, 0, rect.height);
  crop.value = { x: startX, y: startY, width: 0, height: 0 };
  isSelecting.value = true;
}

function updateSelection(e: MouseEvent) {
  if (!isSelecting.value || !imageElement.value) return;
  const rect = imageElement.value.getBoundingClientRect();
  const currentX = clamp(e.clientX - rect.left, 0, rect.width);
  const currentY = clamp(e.clientY - rect.top, 0, rect.height);
  crop.value = {
    x: Math.min(startX, currentX),
    y: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
  };
}

function endSelection() {
  isSelecting.value = false;
}

async function save(overwrite: boolean) {
  if (!imageElement.value || crop.value.width === 0 || crop.value.height === 0) {
    emit('trigger_alert', 'error', 'No crop region selected');
    return;
  }
  const el = imageElement.value;
  const scaleX = el.naturalWidth / el.clientWidth;
  const scaleY = el.naturalHeight / el.clientHeight;
  const key = imageKeys.value[currentIndex.value];
  const { error, message } = await cropImage(
    key,
    {
      x: Math.round(crop.value.x * scaleX),
      y: Math.round(crop.value.y * scaleY),
      width: Math.round(crop.value.width * scaleX),
      height: Math.round(crop.value.height * scaleY),
    },
    overwrite,
  );
  emit('trigger_alert', error ? 'error' : 'success', message);
  if (!error && overwrite) {
    nextTick(showImage);
  }
}

function handleModalChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (target.checked) {
    if (props.selectedImages.size) {
      const first = imageKeys.value.find((k) => props.selectedImages.has(k));
      if (first) currentIndex.value = imageKeys.value.indexOf(first);
    }
    nextTick(showImage);
  } else {
    resetSelection();
  }
}

onMounted(() => {
  const modal = document.getElementById('crop_image_modal') as HTMLInputElement | null;
  modal?.addEventListener('change', handleModalChange);
});

onUnmounted(() => {
  const modal = document.getElementById('crop_image_modal') as HTMLInputElement | null;
  modal?.removeEventListener('change', handleModalChange);
});
</script>

<template>
  <input type="checkbox" id="crop_image_modal" class="modal-toggle" />
  <div class="modal" role="dialog" @click.stop>
    <div class="modal-box w-11/12 max-w-5xl" @click.stop>
      <label for="crop_image_modal" class="absolute right-2 top-1 cursor-pointer">✕</label>
      <div class="flex items-center justify-center gap-4">
        <button class="btn" @click="prev" :disabled="currentIndex === 0">❮</button>
        <div
          class="relative"
          @mousedown="startSelection"
          @mousemove="updateSelection"
          @mouseup="endSelection"
        >
          <img ref="imageElement" class="max-h-[70vh] select-none" />
          <div
            v-if="crop.width && crop.height"
            class="absolute border border-primary bg-primary/20"
            :style="{
              left: crop.x + 'px',
              top: crop.y + 'px',
              width: crop.width + 'px',
              height: crop.height + 'px',
            }"
          ></div>
        </div>
        <button class="btn" @click="next" :disabled="currentIndex === imageKeys.length - 1">❯</button>
      </div>
      <div class="modal-action">
        <button class="btn" @click="save(false)">Save As…</button>
        <button class="btn btn-primary" @click="save(true)">Overwrite original</button>
      </div>
    </div>
  </div>
</template>
