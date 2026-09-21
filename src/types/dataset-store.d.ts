export type TagDiffs = Map<string, TagDiff>;

type AddTagChangeRecord = {
    type: "add_tag";
    images: Set<string>;
    tags: Set<string>;
    tagPosition: number;
};

type RemoveTagChangeRecord = {
    type: "remove_tag";
    images: Set<string>;
    tags: Set<string>;
    tagPositions: Map<string, Map<string, number>>;
};

type ReplaceTagChangeRecord = {
    type: "replace_tag";
    images: Set<string>;
    originalTags: Set<string>;
    newTags: Set<string>;
    replaceBefore: Map<string, string[]>;
};

type ReorderTagChangeRecord = {
    type: "reorder_tag";
    images: Set<string>;
    tag: string;
    reorderPositions: Map<string, ReorderPositions>;
};

export type DatasetChangeRecord =
    | AddTagChangeRecord
    | RemoveTagChangeRecord
    | ReplaceTagChangeRecord
    | ReorderTagChangeRecord;

export type TagDiff = {
    tagger: Set<string>;
    original: Set<string>;
};

export type ReorderPositions = {
    fromIndex: number;
    toIndex: number;
};
