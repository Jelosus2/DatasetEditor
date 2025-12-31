export type TagGroupsChangeRecord = {
    type: "add_group" | "remove_group" | "rename_group" | "clear_groups" | "add_tag" | "remove_tag";
    group?: string;
    tags?: string[];
    previousGroups?: Map<string, Set<string>>;
    from?: string;
    to?: string;
}
