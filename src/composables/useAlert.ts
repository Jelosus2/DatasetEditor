import type { AlertItem, AlertType } from "@/types/alert";

import { ref } from "vue";

const DEFAULT_DURATION = 2500;

const message = ref("");
const type = ref<AlertType>("info");
const timestamp = ref(Date.now());
const queue = ref<AlertItem[]>([]);

let isProcessing = false;

function processNextAlert() {
    if (isProcessing)
        return;

    const next = queue.value.shift();
    if (!next) {
        message.value = "";
        timestamp.value = Date.now();
        return;
    }
    isProcessing = true;

    type.value = next.type;
    message.value = next.message;
    timestamp.value = Date.now();

    setTimeout(() => {
        isProcessing = false;
        processNextAlert();
    }, next.duration);
}

export function useAlert() {
    const showAlert = (alertType: AlertType, alertMessage: string, duration: number = DEFAULT_DURATION) => {
        queue.value.push({
            type: alertType,
            message: alertMessage,
            duration
        });

        processNextAlert();
    }

    return {
        message,
        type,
        timestamp,
        showAlert
    }
}
