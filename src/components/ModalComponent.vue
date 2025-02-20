<script setup lang="ts">
defineProps({
  html: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <dialog id="my_modal_1" class="modal">
    <div class="modal-box" v-html="html"></div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
