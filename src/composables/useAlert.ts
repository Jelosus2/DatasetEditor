import { ref } from 'vue';

export type AlertType = 'success' | 'error' | 'warning' | 'info';

export function useAlert() {
  const message = ref('');
  const type = ref<AlertType>('info');
  const timestamp = ref(Date.now());

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
