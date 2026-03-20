import type { Settings } from "../../shared/settings-schema";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAlert } from "@/composables/useAlert";

export class SettingsService {
    private ipc = useIpcRenderer([]);
    private alert = useAlert();

    async loadSchema() {
        return this.ipc.invoke("settings:get_schema");
    }

    async loadSettings() {
        return this.ipc.invoke("settings:load");
    }

    async updateSettings(partial: Partial<Settings>) {
        const result = await this.ipc.invoke("settings:update", partial);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return null;
        }

        this.alert.showAlert("success", "Settings saved successfully");

        return result.settings!;
    }

    async compareSettings(settings: Settings) {
        return this.ipc.invoke("settings:compare", settings);
    }

    private async runAction(actionId: string) {
        return this.ipc.invoke("settings:action", actionId);
    }

    async importTagsFromCsv() {
        const result = await this.runAction("loadTagsCsv");

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return;
        }

        if (result.canceled)
            this.alert.showAlert("info", "Tag import from CSV was canceled");
    }

    async restartApp() {
        return this.ipc.invoke("utilities:restart_app");
    }

    async pickDirectory() {
        return this.ipc.invoke("settings:pick_directory");
    }

    async validateDirectory(path: string) {
        return this.ipc.invoke("settings:validate_directory", path);
    }
}
