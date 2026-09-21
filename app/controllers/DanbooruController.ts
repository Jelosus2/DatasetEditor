import type { IpcInvokeMap } from "../../shared/ipc-types.js";
import type { Rating } from "../../shared/danbooru.js";
import type { IpcMainInvokeEvent } from "electron";

import { DanbooruHelper } from "../utils/DanbooruHelper.js";
import { IpcClass, IpcHandle } from "../decorators/ipc.js";
import { Utilities } from "../utils/Utilities.js";
import { App } from "../App.js";

@IpcClass()
export class DanbooruController {

    @IpcHandle("danbooru:fetch_wiki")
    async fetchWiki(_event: IpcMainInvokeEvent, tag: string): Promise<IpcInvokeMap["danbooru:fetch_wiki"]["result"]> {
        try {
            const data = await DanbooruHelper.fetchWiki(tag);

            return { error: false, data };
        } catch (error) {
            console.error(error);

            const message = Utilities.getErrorMessage(error);
            App.logger.error(`[Danbooru Manager] Error while trying to fetch the Danbooru wiki: ${message}`);

            return { error: true, message };
        }
    }

    @IpcHandle("danbooru:fetch_posts")
    async fetchPosts(_event: IpcMainInvokeEvent, tag: string, rating: Rating): Promise<IpcInvokeMap["danbooru:fetch_posts"]["result"]> {
        try {
            const data = await DanbooruHelper.fetchPosts(tag, rating);

            return { error: false, data };
        } catch (error) {
            console.error(error);

            const message = Utilities.getErrorMessage(error);
            App.logger.error(`[Danbooru Manager] Error while trying to fetch the Danbooru posts: ${message}`);

            return { error: true, message };
        }
    }
}
