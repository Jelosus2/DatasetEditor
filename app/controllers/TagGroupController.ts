import type { TagGroups } from "../../shared/tag-groups.js";
import type { TagGroupsRaw } from "../types/tag-groups.js";
import type { IpcMainInvokeEvent } from "electron";

import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";
import fs from "fs-extra";
import _ from "lodash";

@IpcClass()
export class TagGroupsController {
    originalTagGroups: TagGroups | null;

    constructor() {
        this.originalTagGroups = null;
    }

    @IpcHandle("tag_groups:load")
    async loadTagGroups() {
        try {
            if (!await fs.pathExists(App.paths.tagGroupsFilePath))
                return { error: false, tagGroups: new Map() }

            const data: TagGroupsRaw = await fs.readJson(App.paths.tagGroupsFilePath);
            if (typeof data !== "object" || data === null)
                return { error: true, message: "Invalid JSON structure: Expect an object" }

            const tagGroups: TagGroups = new Map();
            for (const groupName in data) {
                const tags = data[groupName];
                if (Array.isArray(tags))
                    tagGroups.set(groupName, new Set(tags));
            }

            this.originalTagGroups = tagGroups;

            App.logger.info("[Tag Groups Manager] Tag groups loaded successfully");
            return { error: false, tagGroups }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tag Groups Manager] Error loading tag groups: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to load tag groups, check the logs for more information" }
        }
    }

    @IpcHandle("tag_groups:save")
    async saveTagGroups(_event: IpcMainInvokeEvent, tagGroups: TagGroups) {
        try {
            const jsonOutput: TagGroupsRaw = {};
            for (const [groupName, tagsSet] of tagGroups)
                jsonOutput[groupName] = Array.from(tagsSet);

            await fs.outputJson(App.paths.tagGroupsFilePath, jsonOutput, { spaces: 2, encoding: "utf-8" });
            this.originalTagGroups = tagGroups;

            App.logger.info("[Tag Groups Manager] Tag groups saved successfully");
            return { error: false }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Tag Groups Manager] Error saving tag groups: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to save tag groups, check the logs for more information" }
        }
    }

    @IpcHandle("tag_groups:import")
    async importTagGroups() {
        try {
            const result = await App.showOpenDialog({
                title: "Select the tag group JSON file to load",
                properties: ["openFile"],
                filters: [
                    {
                        name: "JSON File",
                        extensions: ["json"]
                    }
                ]
            });

            const filePath = result.filePaths[0];
            if (!filePath) {
                App.logger.info("[Tag Groups Manager] Tag groups import was canceled by the user");
                return { error: false, canceled: true }
            }

            const data: TagGroupsRaw = await fs.readJson(filePath);
            if (!this.validateTagGroupsData(data)) {
                App.logger.error(`[Tag Groups Manager] Invalid JSON strucuture in ${filePath}`);
                return { error: true, message: "Failed to import tag groups, check the logs for more information" }
            }

            const tagGroups: TagGroups = new Map();
            for (const groupName in data) {
                const tags = data[groupName]
                tagGroups.set(groupName, new Set(tags));
            }

            return { error: false, tagGroups }
        } catch (error) {
            console.log(error);
            App.logger.error(`[Tag Groups Manager] Error importing tag groups: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to import tag groups, check the logs for more information" }
        }
    }

    @IpcHandle("tag_groups:export")
    async exportTagGroups(_event: IpcMainInvokeEvent, tagGroups: TagGroups) {
        try {
            const result = await App.showSaveDialog({
                title: "Export tag groups",
                defaultPath: "tag_groups.json",
                filters: [
                    {
                        name: "JSON File",
                        extensions: ["json"]
                    }
                ]
            });

            const filePath = result.filePath;
            if (!filePath) {
                App.logger.info("[Tag Groups Manager] Tag groups export was canceled by the user");
                return { error: false, canceled: true }
            }

            const jsonOutput: TagGroupsRaw = {};
            for (const [groupName, tagsSet] of tagGroups)
                jsonOutput[groupName] = Array.from(tagsSet);

            await fs.outputJson(filePath, jsonOutput, { spaces: 2, encoding: "utf-8" });
            return { error: false }
        } catch (error) {
            console.log(error);
            App.logger.error(`[Tag Groups Manager] Error exporting tag groups: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to export tag groups, check the logs for more information" }
        }
    }

    @IpcHandle("tag_groups:compare")
    compare(_event: IpcMainInvokeEvent, tagGroups: TagGroups) {
        if (!this.originalTagGroups)
            return true;

        return _.isEqualWith(this.originalTagGroups, tagGroups, (val1, val2) => {
            if (val1 instanceof Set && val2 instanceof Set) {
                if (val1.size !== val2.size)
                    return false;

                for (const tag of val1) {
                    if (!val2.has(tag)) {
                        return false;
                    }
                }
                return true;
            }

            return undefined;
        });
    }

    validateTagGroupsData(data: TagGroupsRaw) {
        if (!_.isPlainObject(data))
            return false;

        for (const key in data) {
            const tags = data[key];
            if (!Array.isArray(tags))
                return false;

            for (let i = 0; i < tags.length; i++) {
                if (typeof tags[i] !== "string")
                    return false;
            }
        }

        return true;
    }
}
