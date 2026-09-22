import type { TagGroupsChangeRecord } from "@/types/tag-groups-store";
import type { TagGroups } from "../../shared/tag-groups";

import { TagGroupsService } from "@/services/tagGroupsService";
import { defineStore } from "pinia";
import { ref } from "vue";

export const useTagGroupsStore = defineStore("tagGroups", () => {
    const tagGroups = ref<TagGroups>(new Map());
    const importedGroups = ref<TagGroups>(new Map());
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

    function cloneTagGroups(groups: TagGroups): TagGroups {
        const clonedGroups: TagGroups = new Map();

        for (const [groupName, tags] of groups)
            clonedGroups.set(groupName, new Set(tags));

        return clonedGroups;
    }

    function areTagGroupsEqual(first: TagGroups, second: TagGroups) {
        if (first.size !== second.size)
            return false;

        const firstEntries = [...first.entries()];
        const secondEntries = [...second.entries()];

        for (let i = 0; i < firstEntries.length; i++) {
            const [firstName, firstTags] = firstEntries[i];
            const [secondName, secondTags] = secondEntries[i];

            if (firstName !== secondName)
                return false;

            const firstTagList = [...firstTags];
            const secondTagList = [...secondTags];

            if (firstTagList.length !== secondTagList.length || firstTagList.some((tag, index) => tag !== secondTagList[index]))
                return false
        }

        return true;
    }

    function clearImportedGroups() {
        importedGroups.value = new Map();
    }

    function replaceTagGroups(groups: TagGroups) {
        tagGroups.value = cloneTagGroups(groups);
        triggerUpdate();
    }

    function replaceGroupTags(group: string, tags: string[]) {
        if (!tagGroups.value.has(group))
            return;

        tagGroups.value.set(group, new Set(tags));
        triggerUpdate();
    }

    function haveSameTagOrder(first: string[], second: string[]) {
        return first.length === second.length && first.every((tag, index) => tag === second[index]);
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
                previousGroups: cloneTagGroups(tagGroups.value)
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

    function mergeTagGroups(incoming: TagGroups, override: boolean, createHistory = true) {
        const previousGroups = cloneTagGroups(tagGroups.value);
        const nextGroups = override
            ? cloneTagGroups(incoming)
            : cloneTagGroups(previousGroups);

        if (!override) {
            for (const [groupName, tags] of incoming) {
                nextGroups.set(groupName, new Set(tags));
            }
        }

        if (areTagGroupsEqual(previousGroups, nextGroups))
            return;

        tagGroups.value = nextGroups;

        if (createHistory) {
            recordHistory({
                type: "import_groups",
                previousGroups,
                nextGroups: cloneTagGroups(nextGroups),
                importedGroups: cloneTagGroups(incoming)
            });
        }

        triggerUpdate();
    }

    function reorderTagsInGroup(group: string, tags: Iterable<string>, toIndex: number, createHistory = true) {
        const tagGroup = tagGroups.value.get(group);
        if (!tagGroup)
            return;

        const tagsToMove = new Set(tags);
        if (tagsToMove.size === 0)
            return;

        const previousTags = [...tagGroup];
        const movingTags = previousTags.filter((tag) => tagsToMove.has(tag));

        if (movingTags.length === 0)
            return;

        const remainingTags = previousTags.filter((tag) => !tagsToMove.has(tag));
        const insertIndex = Math.max(0, Math.min(toIndex, remainingTags.length));
        const nextTags = [...remainingTags];

        nextTags.splice(insertIndex, 0, ...movingTags);

        if (haveSameTagOrder(previousTags, nextTags))
            return;

        tagGroups.value.set(group, new Set(nextTags));

        if (createHistory) {
            recordHistory({
                type: "reorder_tags",
                group,
                previousTags,
                nextTags: [...nextTags]
            });
        }

        triggerUpdate();
    }

    function reorderTagInGroup(group: string, tag: string, toIndex: number, createHistory = true) {
        reorderTagsInGroup(group, [tag], toIndex, createHistory);
    }

    function renameTagInGroup(group: string, originalTag: string, newTagInput: string, createHistory = true) {
        const tagGroup = tagGroups.value.get(group);
        const newTag = newTagInput.trim();

        if (!tagGroup || !newTag || newTag === originalTag || !tagGroup.has(originalTag))
            return;

        const previousTags = [...tagGroup];
        const originalIndex = previousTags.indexOf(originalTag);

        const nextTags = previousTags.filter((tag) => tag !== originalTag && tag !== newTag);
        nextTags.splice(Math.min(originalIndex, nextTags.length), 0, newTag);

        tagGroups.value.set(group, new Set(nextTags));

        if (createHistory) {
            recordHistory({
                type: "rename_tag",
                group,
                previousTags,
                nextTags: [...nextTags]
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
            case "reorder_tags":
                replaceGroupTags(change.group, change.previousTags);
                break;
            case "import_groups":
                replaceTagGroups(change.previousGroups);
                importedGroups.value = cloneTagGroups(change.importedGroups);
                break;
            case "rename_tag":
                replaceGroupTags(change.group, change.previousTags);
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
            case "reorder_tags":
                replaceGroupTags(change.group, change.nextTags);
                break;
            case "import_groups":
                replaceTagGroups(change.nextGroups);
                clearImportedGroups();
                break;
            case "rename_tag":
                replaceGroupTags(change.group, change.nextTags);
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
        const result = await tagGroupsService.importTagGroups();

        if (result)
            importedGroups.value = cloneTagGroups(result);

        return result;
    }

    async function exportTagGroups(tagGroups: TagGroups) {
        await tagGroupsService.exportTagGroups(tagGroups);
    }

    return {
        tagGroups,
        importedGroups,
        dataVersion,
        recordHistory,
        addGroup,
        removeGroup,
        clearGroups,
        clearImportedGroups,
        addTagsToGroup,
        removeTagsFromGroup,
        renameGroup,
        mergeTagGroups,
        reorderTagsInGroup,
        reorderTagInGroup,
        renameTagInGroup,
        undoTagGroupsAction,
        redoTagGroupsAction,
        loadTagGroups,
        saveTagGroups,
        areTagGroupsSaved,
        importTagGroups,
        exportTagGroups
    };
});
