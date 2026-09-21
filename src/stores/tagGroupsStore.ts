import type { TagGroupsChangeRecord } from "@/types/tag-groups-store";
import type { TagGroups } from "../../shared/tag-groups";

import { TagGroupsService } from "@/services/tagGroupsService";
import { defineStore } from "pinia";
import { ref } from "vue";

export const useTagGroupsStore = defineStore("tagGroups", () => {
    const tagGroups = ref<TagGroups>(new Map());
    const tagGroupsUndoStack = ref<TagGroupsChangeRecord[]>([]);
    const tagGroupsRedoStack = ref<TagGroupsChangeRecord[]>([]);
    const dataVersion = ref(0);

    const tagGroupsService = new TagGroupsService();

    function triggerUpdate() {
        dataVersion.value++;
    }

    function recordHistory(change: TagGroupsChangeRecord) {
        tagGroupsUndoStack.value.push(change);
        tagGroupsRedoStack.value = [];
    }

    function addGroup(name: string, tags: string[], createHistory = true) {
        if (!name || tagGroups.value.has(name))
            return;

        const tagSet = new Set(tags);
        tagGroups.value.set(name, tagSet);

        if (createHistory) {
            recordHistory({
                type: "add_group",
                group: name,
                tags: [...tagSet]
            });
        }

        triggerUpdate();
    }

    function removeGroup(name: string, createHistory = true) {
        const existing = tagGroups.value.get(name);
        if (!existing)
            return;

        if (createHistory) {
            recordHistory({
                type: "remove_group",
                group: name,
                tags: [...existing]
            });
        }

        tagGroups.value.delete(name);
        triggerUpdate();
    }

    function clearGroups(createHistory = true) {
        if (tagGroups.value.size === 0)
            return;

        if (createHistory) {
            recordHistory({
                type: "clear_groups",
                previousGroups: new Map(tagGroups.value)
            });
        }

        tagGroups.value = new Map();
        triggerUpdate();
    }

    function addTagsToGroup(group: string, tags: string[], createHistory = true) {
        const tagGroup = tagGroups.value.get(group);
        if (!tagGroup || tags.length === 0)
            return;

        const tagsToAdd = tags.filter((tag) => tag && !tagGroup.has(tag));
        if (tagsToAdd.length === 0)
            return;

        for (const tag of tagsToAdd)
            tagGroup.add(tag);

        if (createHistory) {
            recordHistory({
                type: "add_tag",
                group,
                tags: tagsToAdd
            });
        }

        triggerUpdate();
    }

    function removeTagsFromGroup(group: string, tags: string[], createHistory = true) {
        const tagGroup = tagGroups.value.get(group);
        if (!tagGroup || tags.length === 0)
            return;

        const tagsToRemove = [...new Set(tags.filter((tag) => tagGroup.has(tag)))];
        if (tagsToRemove.length === 0)
            return;

        const currentTags = [...tagGroup];
        const tagPositions = new Map<string, number>();

        for (const tag of tagsToRemove) {
            tagPositions.set(tag, currentTags.indexOf(tag));
            tagGroup.delete(tag);
        }

        if (createHistory) {
            recordHistory({
                type: "remove_tag",
                group,
                tags: tagsToRemove,
                tagPositions
            });
        }

        triggerUpdate();
    }

    function restoreTagsToGroup(group: string, tagPositions: Map<string, number>) {
        const tagGroup = tagGroups.value.get(group);
        if (!tagGroup || tagPositions.size === 0)
            return;

        const tags = [...tagGroup];
        const orderedTags = [...tagPositions.entries()].sort((first, second) => first[1] - second[1]);
        let changed = false;

        for (const [tag, originalIndex] of orderedTags) {
            if (tagGroup.has(tag))
                return;

            const insertIndex = Math.max(0, Math.min(originalIndex, tags.length));

            tags.splice(insertIndex, 0, tag);
            changed = true;
        }

        if (!changed)
            return;

        tagGroups.value.set(group, new Set(tags));
        triggerUpdate();
    }

    function renameGroup(oldName: string, newName: string, createHistory = true) {
        const tags = tagGroups.value.get(oldName);
        if (!tags)
            return;

        tagGroups.value.delete(oldName);
        tagGroups.value.set(newName, new Set(tags));

        if (createHistory) {
            recordHistory({
                type: "rename_group",
                from: oldName,
                to: newName
            });
        }

        triggerUpdate();
    }

    function mergeTagGroups(incoming: TagGroups, override: boolean) {
        if (override) {
            tagGroups.value = new Map(incoming);
            triggerUpdate();
            return;
        }

        for (const [groupName, tags] of incoming.entries())
            tagGroups.value.set(groupName, new Set(tags));
        triggerUpdate();
    }

    function reorderTagInGroup(group: string, tag: string, toIndex: number, createHistory = true) {
        const tagGroup = tagGroups.value.get(group);
        if (!tagGroup)
            return;

        const tags = [...tagGroup];
        const fromIndex = tags.indexOf(tag);

        if (fromIndex === -1)
            return;

        const insertIndex = Math.max(0, Math.min(toIndex, tags.length - 1));
        if (insertIndex === fromIndex)
            return;

        tags.splice(fromIndex, 1);
        tags.splice(insertIndex, 0, tag);

        tagGroups.value.set(group, new Set(tags));

        if (createHistory) {
            recordHistory({
                type: "reorder_tag",
                group,
                tag,
                fromIndex,
                toIndex: insertIndex
            });
        }

        triggerUpdate();
    }

    function undoTagGroupsAction() {
        const change = tagGroupsUndoStack.value.pop();
        if (!change)
            return;

        switch (change.type) {
            case "add_group":
                removeGroup(change.group, /* createHistory = */ false);
                break;
            case "remove_group":
                addGroup(change.group, change.tags, /* createHistory = */ false);
                break;
            case "rename_group":
                renameGroup(change.to, change.from, /* createHistory = */ false);
                break;
            case "clear_groups":
                tagGroups.value = new Map(change.previousGroups);
                triggerUpdate();
                break;
            case "add_tag":
                removeTagsFromGroup(change.group, change.tags, /* createHistory = */ false);
                break;
            case "remove_tag":
                restoreTagsToGroup(change.group, change.tagPositions);
                break;
            case "reorder_tag":
                reorderTagInGroup(change.group, change.tag, change.fromIndex, /* createHistory = */ false);
                break;
        }

        tagGroupsRedoStack.value.push(change);
    }

    function redoTagGroupsAction() {
        const change = tagGroupsRedoStack.value.pop();
        if (!change)
            return;

        switch (change.type) {
            case "add_group":
                addGroup(change.group, change.tags, /* createHistory = */ false);
                break;
            case "remove_group":
                removeGroup(change.group, /* createHistory = */ false);
                break;
            case "rename_group":
                renameGroup(change.from, change.to, /* createHistory = */ false);
                break;
            case "clear_groups":
                clearGroups(/* createHistory = */ false);
                break;
            case "add_tag":
                addTagsToGroup(change.group, change.tags, /* createHistory = */ false);
                break;
            case "remove_tag":
                removeTagsFromGroup(change.group, change.tags, /* createHistory = */ false);
                break;
            case "reorder_tag":
                reorderTagInGroup(change.group, change.tag, change.toIndex, /* createHistory = */ false);
                break;
        }

        tagGroupsUndoStack.value.push(change);
    }

    function resetTagGroupStatus() {
        tagGroupsUndoStack.value = [];
        tagGroupsRedoStack.value = [];
    }

    async function loadTagGroups() {
        const result = await tagGroupsService.loadTagGroups();

        if (result) {
            tagGroups.value = result;
            resetTagGroupStatus();
            triggerUpdate();
        }
    }

    async function saveTagGroups() {
        await tagGroupsService.saveTagGroups(tagGroups.value);
    }

    async function areTagGroupsSaved() {
        return tagGroupsService.compareTagGroups(tagGroups.value);
    }

    async function importTagGroups() {
        return tagGroupsService.importTagGroups();
    }

    async function exportTagGroups(tagGroups: TagGroups) {
        await tagGroupsService.exportTagGroups(tagGroups);
    }

    return {
        tagGroups,
        dataVersion,
        recordHistory,
        addGroup,
        removeGroup,
        clearGroups,
        addTagsToGroup,
        removeTagsFromGroup,
        renameGroup,
        mergeTagGroups,
        reorderTagInGroup,
        undoTagGroupsAction,
        redoTagGroupsAction,
        loadTagGroups,
        saveTagGroups,
        areTagGroupsSaved,
        importTagGroups,
        exportTagGroups
    };
});
