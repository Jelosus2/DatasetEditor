import type { IpcMainInvokeEvent } from "electron";

import { DanbooruHelper } from "../utils/DanbooruHelper.js";
import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";

@IpcClass()
export class DanbooruController {
    constructor() {}

    @IpcHandle("danbooru:fetch_wiki")
    async fetchWiki(_event: IpcMainInvokeEvent, tag: string) {
        try {
            const data = await DanbooruHelper.fetchWiki(tag);
            return { error: false, data }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Danbooru Manager] Error while trying to fetch the Danbooru wiki: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to fetch wiki, check the logs for more information" }
        }
    }

    @IpcHandle("danbooru:fetch_posts")
    async fetchPosts(_event: IpcMainInvokeEvent, tag: string) {
        try {
            const data = await DanbooruHelper.fetchPosts(tag);
            return { error: false, data }
        } catch (error) {
            console.error(error);
            App.logger.error(`[Danbooru Manager] Error while trying to fetch the Danbooru posts: ${Utilities.getErrorMessage(error)}`);
            return { error: true, message: "Failed to fetch posts, check the logs for more information" }
        }
    }
}
