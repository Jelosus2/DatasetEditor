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
