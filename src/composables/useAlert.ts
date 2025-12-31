import type { AlertType } from "@/types/alert";

import { ref } from "vue";

const message = ref("");
const type = ref<AlertType>("info");
const timestamp = ref(Date.now());

export function useAlert() {
    const showAlert = (alertType: AlertType, alertMessage: string) => {
        message.value = alertMessage;
        type.value = alertType;
        timestamp.value = Date.now();
    }

    return {
        message,
        type,
        timestamp,
        showAlert
    }
}
