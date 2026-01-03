import type { AppStatusPayload } from "../../shared/app-status";

import { useAlert } from "@/composables/useAlert";
import { ref } from "vue";

const active = ref(false);
const title = ref("");
const message = ref("");

export function useAppStatus() {
    const alert = useAlert();

    function handleStatus(payload: AppStatusPayload) {
        if (payload.state === "start" || payload.state === "progress") {
            active.value = true;
            title.value = payload.title;
            message.value = payload.message ?? "";
            return;
        }

        active.value = false;

        if (payload.state === "error")
            alert.showAlert("error", payload.message ?? "Operation failed");
        else if (payload.state === "success")
            alert.showAlert("success", payload.message ?? `${payload.title} completed`);
    }

    return { active, title, message, handleStatus }
}
