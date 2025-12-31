<script setup lang="ts">
withDefaults(
    defineProps<{
        isImage?: boolean;
    }>(),
    {
        isImage: false
    }
);
</script>

<template>
  <dialog id="my_modal_1" class="modal z-1000">
    <div class="modal-box w-fit max-w-[90%]" :class="{ 'p-0': isImage }">
        <slot />
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  </dialog>
</template>
