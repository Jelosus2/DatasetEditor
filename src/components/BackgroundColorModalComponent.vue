<script setup lang="ts">
import { applyBackgroundColor } from '@/services/imageService';
import { useAlert } from '@/composables/useAlert';
import { ref } from 'vue';

const props = defineProps<{ selectedImages: Set<string> }>();

const { showAlert } = useAlert();

const color = ref('#ffffff');
const predefined = ['#ffffff', '#000000', '#ff0000', '#00ff00', '#0000ff'];

function closeModal() {
  const modal = document.getElementById('background_color_modal') as HTMLInputElement | null;
  if (modal) modal.checked = false;
}

async function changeColor() {
  if (!props.selectedImages.size) {
    showAlert('error', 'Dataset not loaded');
    return;
  }

  const { error, message } = await applyBackgroundColor([...props.selectedImages], color.value);
  if (error) {
    showAlert('error', message);
    return;
  }

  showAlert('success', message);
  closeModal();
}
</script>

<template>
  <input type="checkbox" id="background_color_modal" class="modal-toggle" />
  <div class="modal z-50" role="dialog">
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
