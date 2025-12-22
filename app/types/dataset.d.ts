export type Dataset = Map<string, DatasetImage>;
export type GlobalTags = Map<string, Set<string>>;

export type DatasetImage = {
    tags: Set<string>;
    path: string;
    filePath: string;
}

export type RenamePair = {
    from: string;
    to: string;
    temp: string;
}
