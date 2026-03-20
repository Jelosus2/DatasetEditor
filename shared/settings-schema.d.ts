export type SettingType = "boolean" | "string[]" | "number" | "select" | "action" | "shortcut" | "directory";
export type SettingInputType = "textarea";

export interface SettingDefinition<K extends string = string> {
    key: K;
    section: string;
    label: string;
    type: SettingType;
    inputType?: SettingInputType;
    description?: string;
    defaultValue?: unknown;
    options?: Array<{ label: string; value: string; }>;
    order?: number;
    requiresRestart?: boolean;
    actionId?: string;
}

export type Settings = {
    showTagCount: boolean;
    showDiffSection: boolean;
    showCaptionDiffList: boolean;
    showTagGroups: boolean;
    theme: string;
    autocomplete: boolean;
    tagsIgnored: string[];
    taggerPort: number;
    recursiveDatasetLoad: boolean;
    autoCheckUpdates: boolean;
    sortImagesAlphabetically: boolean;
    enableHardwareAcceleration: boolean;
    shortcutLoadDataset: string;
    shortcutReloadDataset: string;
    shortcutSave: string;
    shortcutUndo: string;
    shortcutRedo: string;
    shortcutSelectAllImages: string;
    shortcutNavigationLeft: string;
    shortcutNavigationRight: string;
    shortcutNavigationUp: string;
    shortcutNavigationDown: string;
    shortcutToggleTagEditMode: string;
    huggingFaceCacheDirectory: string;
};

export type SettingsDefinition = SettingDefinition<keyof Settings>;
