import type { StyleCompareItem } from "../../shared/tagger.js";

export type DeviceWSResponse = {
    device: string;
}

export type ModelsStatusWSResponse = {
    status: Record<string, boolean>;
    cache_size_bytes: number;
}

export type DeleteModelWSResponse = {
    success: boolean;
    cache_size_bytes: number;
}

export type ModelActionWSResponse = {
    cache_size_bytes: number;
}

export type StyleCompareWSResponse = {
    folder_cohesion: number;
    results: StyleCompareItem[];
}
