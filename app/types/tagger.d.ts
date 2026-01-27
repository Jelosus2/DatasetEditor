export type TaggerWSPayload = {
    images: string[];
    general_threshold: number;
    character_threshold: number;
    remove_underscores: boolean;
    models: string[];
    tags_ignored: string[];
}

export type DeviceWSResponse = {
    device: string;
}

export type ModelsStatusWSResponse = {
    status: Record<string, boolean>;
}

export type DeleteModelWSResponse = {
    deleted: boolean;
}
