export type TaggerModelsStatus = Record<string, boolean>;

export type TaggerModelConfiguration = Record<string, TaggerModelConfigurationProperties>;

export type TaggerModelConfigurationProperties = {
    isCustomModel: boolean;
    generalThreshold: number;
    characterThreshold: number;
    modelFile: string;
    tagsFile: string;
}

export type TaggerWSPayload = {
    images: string[];
    models: TaggerWSPayloadModel[];
    tags_ignored: string[];
    remove_underscores: boolean;
    disable_character_threshold: boolean;
}

export type TaggerWSPayloadModel = {
    repo_id: string;
    model_file: string;
    tags_file: string;
    general_threshold: number;
    character_threshold: number;
}

export type StyleCompareItem = {
    file: string;
    fit_score: number;
    companion_score: number;
}
