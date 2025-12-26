import { ref } from 'vue';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

const message = ref('');
const type = ref<AlertType>('info');
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
