export type TaggerModelsStatus = Record<string, boolean>;

export type TaggerModelConfiguration = Record<string, TaggerModelConfigurationProperties>;

export type TaggerModelConfigurationProperties = {
    isCustomModel: boolean;
    generalThreshold: number;
    characterThreshold: number;
    modelFile: string;
    tagsFile: string;
}
