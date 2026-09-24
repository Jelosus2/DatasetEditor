export type TaggerModelsStatus = Record<string, boolean>;

export type TaggerModelConfiguration = Record<string, TaggerModelConfigurationProperties>;

export type TaggerBackend = "onnx" | "timm";
export type TimmExtraFile = "preprocess.json" | "thresholds.csv";
export type TaggerThresholdSource = "manual" | "tags_file" | "thresholds_file";

export type TaggerModelConfigurationProperties = {
    isCustomModel: boolean;
    backend: TaggerBackend;
    generalThreshold: number;
    characterThreshold: number;
    thresholdSource: TaggerThresholdSource;
    modelFile: string;
    tagsFile: string;
    extraFiles: TimmExtraFile[];
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
    backend: TaggerBackend;
    model_file: string;
    tags_file: string;
    general_threshold: number;
    character_threshold: number;
    threshold_source: TaggerThresholdSource;
    extra_files: TimmExtraFile[];
}

export type StyleCompareItem = {
    file: string;
    fit_score: number;
    companion_score: number;
}
