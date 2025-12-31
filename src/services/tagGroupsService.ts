import type { TagGroups } from "../../shared/tag-groups";

import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAlert } from "@/composables/useAlert";
import { toRaw } from "vue";

export class TagGroupsService {
    private ipc = useIpcRenderer([]);
    private alert = useAlert();

    constructor() {}

    private getRawTagGroups(tagGroups: TagGroups) {
        const rawMap = toRaw(tagGroups);
        const cleanMap: TagGroups = new Map();

        for (const [groupName, tagSet] of rawMap.entries()) {
            const rawTagSet = toRaw(tagSet);

            cleanMap.set(groupName, rawTagSet);
        }

        return cleanMap;
    }

    async loadTagGroups() {
        const result = await this.ipc.invoke("tag_groups:load");

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return null;
        }

        return result.tagGroups!;
    }

    async saveTagGroups(tagGroups: TagGroups) {
        const rawTagGroups = this.getRawTagGroups(tagGroups);
        const result = await this.ipc.invoke("tag_groups:save", rawTagGroups);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return;
        }

        this.alert.showAlert("success", "Tag groups saved successfully");
    }

    async importTagGroups() {
        const result = await this.ipc.invoke("tag_groups:import");

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return null;
        }

        if (result.canceled) {
            this.alert.showAlert("info", "Tag groups import was canceled");
            return null;
        }

        return result.tagGroups!;
    }

    async exportTagGroups(tagGroups: TagGroups) {
        const rawTagGroups = this.getRawTagGroups(tagGroups);
        const result = await this.ipc.invoke("tag_groups:export", rawTagGroups);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return;
        }

        if (result.canceled) {
            this.alert.showAlert("info", "Tag groups export was canceled");
            return;
        }

        this.alert.showAlert("success", "Tag groups exported successfully");
    }

    async compareTagGroups(tagGroups: TagGroups) {
        const rawTagGroups = this.getRawTagGroups(tagGroups);
        return this.ipc.invoke("tag_groups:compare", rawTagGroups);
    }
}
