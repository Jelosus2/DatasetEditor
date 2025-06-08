<script setup lang="ts">
import { ref } from 'vue';
import { applyBackgroundColor } from '@/services/imageService';

const props = defineProps<{ selectedImages: Set<string> }>();
const emit = defineEmits(['trigger_alert']);

const color = ref('#ffffff');
const predefined = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff'];

function closeModal() {
  const modal = document.getElementById('background_color_modal') as HTMLInputElement | null;
  if (modal) modal.checked = false;
}

async function changeColor() {
  if (!props.selectedImages.size) {
    emit('trigger_alert', 'error', 'Dataset not loaded');
    return;
  }

  const { error, message } = await applyBackgroundColor([...props.selectedImages], color.value);
  if (error) {
    emit('trigger_alert', 'error', message);
    return;
  }

  emit('trigger_alert', 'success', message);
  closeModal();
}
</script>

<template>
  <input type="checkbox" id="background_color_modal" class="modal-toggle" />
  <div class="modal" role="dialog">
    <div class="modal-box">
      <label for="background_color_modal" class="absolute right-2 top-1 cursor-pointer">✕</label>
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <span>Predefined colors:</span>
          <button
            v-for="c in predefined"
            :key="c"
            :style="{ backgroundColor: c }"
            class="h-6 w-6 rounded border"
            @click="color = c"
          ></button>
        </div>
        <div class="flex items-center gap-2">
          <span>Custom color:</span>
          <input type="color" v-model="color" />
        </div>
        <div class="modal-action">
          <button class="btn btn-primary" @click="changeColor">Change color</button>
        </div>
      </div>
    </div>
  </div>
</template>
