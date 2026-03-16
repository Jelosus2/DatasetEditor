import type { TagGroups } from "../../shared/tag-groups";

import { useTagGroupsStore } from "@/stores/tagGroupsStore";
import { useAlert } from "@/composables/useAlert";

export function useTagGroupsOperations() {
    const tagGroupsStore = useTagGroupsStore();
    const alert = useAlert();

    function addGroup(name: string, tagsInput: string) {
        const tags = tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

        tagGroupsStore.addGroup(name, tags);
    }

    function removeGroup(name: string) {
        tagGroupsStore.removeGroup(name);
    }

    function renameGroup(oldName: string, newName: string) {
        if (!oldName || !newName || !tagGroupsStore.tagGroups.has(oldName))
            return false;

        if (oldName === newName) {
            alert.showAlert("warning", "You can't use the same name");
            return false;
        }

        if (tagGroupsStore.tagGroups.has(newName)) {
            alert.showAlert("warning", "A tag group with that name already exists");
            return false;
        }

        tagGroupsStore.renameGroup(oldName, newName);
        return true;
    }

    function clearGroups() {
        tagGroupsStore.clearGroups();
    }

    function addTag(group: string, tagsInput: string) {
        const tags = tagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);

        tagGroupsStore.addTagsToGroup(group, tags);
    }

    function removeTag(group: string, tag: string) {
        tagGroupsStore.removeTagsFromGroup(group, [tag]);
    }

    function mergeTagGroups(incoming: TagGroups, override: boolean) {
        tagGroupsStore.mergeTagGroups(incoming, override);
    }

    async function importTagGroups() {
        const result = await tagGroupsStore.importTagGroups();

        if (result) {
            alert.showAlert("success", "Tag groups imported successfully");
            return result;
        }

        return null;
    }

    async function exportTagGroups(group?: string) {
        if (tagGroupsStore.tagGroups.size === 0)
            return;

        let map: TagGroups | null = null;
        if (group) {
            const tags = tagGroupsStore.tagGroups.get(group);
            if (!tags)
                return;

            map = new Map([[group, new Set(tags)]]);
        }

        await tagGroupsStore.exportTagGroups(map ?? tagGroupsStore.tagGroups);
    }

    return {
        addGroup,
        removeGroup,
        renameGroup,
        clearGroups,
        addTag,
        removeTag,
        mergeTagGroups,
        importTagGroups,
        exportTagGroups
    };
}
