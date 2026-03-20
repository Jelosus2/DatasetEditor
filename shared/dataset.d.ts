export type Dataset = Map<string, DatasetImage>;
export type GlobalTags = Map<string, Set<string>>;

export type DatasetImage = {
    tags: Set<string>;
    path: string;
    filePath: string;
}

export type DatasetPersistable = Map<string, Omit<DatasetImage, "filePath">>;

export type RenamePair = {
    from: string;
    to: string;
    temp: string;
}

export type RenameMapping = {
    from: string;
    to: string;
    mtime: number;
}

export type RenameMode = "sequence" | "template";

export type DatasetRenameOptions = {
    mode: RenameMode;
    startAt?: number;
    padding?: number;
    template?: string;
    dryRun?: boolean;
}

export type RenamePreviewItem = {
    from: string;
    to: string;
    fromName: string;
    toName: string;
    hasConflict: boolean;
    reason?: string;
}

export type RenameProgressPayload = {
    phase: "prepare" | "rename_temp" | "rename_final" | "rollback" | "done";
    processed: number;
    total: number;
    currentPath?: string;
}
