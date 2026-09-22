import type { TagGroups } from "../../shared/tag-groups";

type AddGroupChangeRecord = {
    type: "add_group";
    group: string;
    tags: string[];
};

type RemoveGroupChangeRecord = {
    type: "remove_group";
    group: string;
    tags: string[];
};

type RenameGroupChangeRecord = {
    type: "rename_group";
    from: string;
    to: string;
};

type ClearGroupsChangeRecord = {
    type: "clear_groups";
    previousGroups: TagGroups;
};

type AddTagChangeRecord = {
    type: "add_tag";
    group: string;
    tags: string[];
};

type RemoveTagChangeRecord = {
    type: "remove_tag";
    group: string;
    tags: string[];
    tagPositions: Map<string, number>;
};

type ReorderTagsChangeRecord = {
    type: "reorder_tags";
    group: string;
    previousTags: string[];
    nextTags: string[];
};

type ImportGroupsChangeRecord = {
    type: "import_groups";
    previousGroups: TagGroups;
    nextGroups: TagGroups;
    importedGroups: TagGroups;
};

type RenameTagChangeRecord = {
    type: "rename_tag";
    group: string;
    previousTags: string[];
    nextTags: string[];
};

export type TagGroupsChangeRecord =
    | AddGroupChangeRecord
    | RemoveGroupChangeRecord
    | RenameGroupChangeRecord
    | ClearGroupsChangeRecord
    | AddTagChangeRecord
    | RemoveTagChangeRecord
    | RenameTagChangeRecord
    | ReorderTagsChangeRecord
    | ImportGroupsChangeRecord;
