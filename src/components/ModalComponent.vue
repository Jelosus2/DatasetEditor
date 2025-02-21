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
    <div class="modal-box w-fit max-w-[90%]" v-html="html"></div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
