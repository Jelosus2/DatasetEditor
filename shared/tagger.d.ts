export type TaggerModelsStatus = Record<string, boolean>;

export type TaggerModelConfiguration = Record<string, TaggerModelProperties>;

export type TaggerModelConfigurationProperties = {
    generalThreshold: number;
    characterThreshold: number;
    modelFile: string;
    tagsFile: string;
}
