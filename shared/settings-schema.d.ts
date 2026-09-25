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
    highPerformanceModelDownloads: boolean;
    huggingFaceToken: string;
};

export type SettingType =
    | "boolean"
    | "string"
    | "string[]"
    | "number"
    | "select"
    | "action"
    | "shortcut"
    | "directory";

export type SettingInputType =
    | "text"
    | "password"
    | "textarea";

export type StringSettingStorage =
    | "plain"
    | "encrypted";

export type SettingOption = {
    label: string;
    value: string;
};

export type SettingsActionMap = {
    loadTagsCsvAction: "loadTagsCsv";
    repairAutotaggerAction: "repairAutotagger";
};

export type SettingsActionKey = keyof SettingsActionMap;
export type SettingsActionId = SettingsActionMap[SettingsActionKey];

type KeysMatching<T, Value> = {
    [K in keyof T]-?: T[K] extends Value ? K : never;
}[keyof T];

type BooleanSettingKey = KeysMatching<Settings, boolean>;
type NumberSettingKey = KeysMatching<Settings, number>;
type StringArraySettingKey = KeysMatching<Settings, string[]>;
type ShortcutSettingKey = Extract<keyof Settings, `shortcut${string}`>;
type DirectorySettingKey = "huggingFaceCacheDirectory";
type SelectSettingKey = "theme";

type StringSettingKey = Exclude<
    KeysMatching<Settings, string>,
    ShortcutSettingKey | DirectorySettingKey | SelectSettingKey
>;

type SettingDefinitionBase<K extends string, T extends SettingType> = {
    key: K;
    section: string;
    label: string;
    type: T;
    description?: string;
    order?: number;
};

type ValueSettingDefinitionBase<K extends keyof Settings, T extends SettingType> = SettingDefinitionBase<K, T> & {
    defaultValue: Settings[K];
    requiresRestart?: boolean;
};

export type BooleanSettingDefinition = ValueSettingDefinitionBase<BooleanSettingKey, "boolean">;

export type NumberSettingDefinition = ValueSettingDefinitionBase<NumberSettingKey, "number">;

export type StringSettingDefinition = ValueSettingDefinitionBase<StringSettingKey, "string"> & {
    inputType?: "text" | "password";
    storage: StringSettingStorage;
};

export type StringArraySettingDefinition = ValueSettingDefinitionBase<StringArraySettingKey, "string[]"> & {
    inputType?: "textarea";
};

export type SelectSettingDefinition = ValueSettingDefinitionBase<SelectSettingKey, "select"> & {
    options: SettingOption[];
};

export type ShortcutSettingDefinition = ValueSettingDefinitionBase<ShortcutSettingKey, "shortcut">;

export type DirectorySettingDefinition = ValueSettingDefinitionBase<DirectorySettingKey, "directory">;

export type ActionSettingDefinition = {
    [K in SettingsActionKey]: SettingDefinitionBase<K, "action"> & { actionId: SettingsActionMap[K]; };
}[SettingsActionKey];

export type ValueSettingDefinition =
    | BooleanSettingDefinition
    | StringSettingDefinition
    | NumberSettingDefinition
    | StringArraySettingDefinition
    | SelectSettingDefinition
    | ShortcutSettingDefinition
    | DirectorySettingDefinition;

export type SettingDefinition =
    | ValueSettingDefinition
    | ActionSettingDefinition;

type DistributiveOmit<T, K extends PropertyKey> =
    T extends unknown ? Omit<T, K> : never;

export type SettingDefinitionInput =
    DistributiveOmit<SettingDefinition, "key">;

/**
 * Kept as an alias to avoid changing all existing imports.
 */
export type SettingsDefinition = SettingDefinition;
