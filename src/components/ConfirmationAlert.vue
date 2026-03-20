<script setup lang="ts">
const props = withDefaults(
    defineProps<{
        open: boolean;
        title: string;
        message: string;
        confirmText?: string;
        cancelText?: string;
        confirmClass?: string;
        cancelClass?: string;
        closeOnBackdrop?: boolean;
    }>(),
    {
        confirmText: "Confirm",
        cancelText: "Cancel",
        confirmClass: "btn btn-primary",
        cancelClass: "btn btn-outline",
        closeOnBackdrop: true
    }
);

const emit = defineEmits<{
    (e: "confirm"): void;
    (e: "cancel"): void;
    (e: "update:open", value: boolean): void;
}>();

function close() {
    emit("cancel");
    emit("update:open", false);
}

function confirm() {
    emit("confirm");
}

function onBackdropClick() {
    if (props.closeOnBackdrop)
        close();
}
</script>

<template>
    <div class="modal z-50" :class="{ 'modal-open': open }" tabindex="-1">
        <div class="modal-box">
            <h3 class="text-lg font-semibold">{{ title }}</h3>
            <p class="mt-2 text-lg text-base-content/70">{{ message }}</p>
            <div class="modal-action">
                <button :class="cancelClass" @click="close">{{ cancelText }}</button>
                <button :class="confirmClass" @click="confirm">{{ confirmText }}</button>
            </div>
        </div>
        <div class="modal-backdrop" @click="onBackdropClick"></div>
    </div>
</template>
