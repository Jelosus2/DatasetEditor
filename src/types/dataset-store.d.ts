export type TagDiffs = Map<string, TagDiff>;

export type DatasetChangeRecord = {
    type: "add_tag" | "remove_tag" | "replace_tag" | "reorder_tag";
    images: Set<string>;
    tags?: Set<string>;
    tag?: string;
    tagPosition?: number;
    tagPositions?: Map<string, Map<string, number>>;
    originalTag?: string;
    newTag?: string;
    fromIndex?: number;
    toIndex?: number;
}

export type TagDiff = {
    tagger: Set<string>;
    original: Set<string>;
}
