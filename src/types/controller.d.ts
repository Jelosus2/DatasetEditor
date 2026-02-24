import type { useDatasetStore } from "@/stores/datasetStore";
import type { useTagGroupsStore } from "@/stores/tagGroupsStore";
import type { useSettingsStore } from "@/stores/settingsStore";
import type { AlertType } from "@/types/alert";
import type { ActiveTab } from "@/types/app";

export type AppControllerDependencies = {
    datasetStore: ReturnType<typeof useDatasetStore>;
    tagGroupsStore: ReturnType<typeof useTagGroupsStore>;
    settingsStore: ReturnType<typeof useSettingsStore>;
    showAlert: (type: AlertType, message: string) => void;
    getActiveTab: () => ActiveTab;
}
