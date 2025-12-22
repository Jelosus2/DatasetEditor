import type { WikiResponse, PostsResponse } from "../types/danbooru.js";

import { APIClient } from "./APIClient.js";

export class DanbooruHelper {
    static async fetchWiki(tag: string): Promise<WikiResponse> {
        const url = `https://danbooru.donmai.us/wiki_pages/${encodeURIComponent(tag.toLowerCase())}.json`
        const [data, responseOk, statusCode] = await APIClient.get<WikiResponse>(url);

        if (statusCode === 404) throw new Error(`Wiki page for tag '${tag}' not found!`);
        if (!responseOk && !data.success) throw new Error(`[Code ${statusCode}] ${data.message}`);
        if (!responseOk) throw new Error(`[Code ${statusCode}] Unknown error`);
        return data;
    }

    static async fetchPosts(tag: string): Promise<PostsResponse[]> {
        const url = `https://danbooru.donmai.us/posts.json?limit=10&tags=${encodeURIComponent(tag.replaceAll(" ", "_").toLowerCase())}`;
        const [data, responseOk, statusCode] = await APIClient.get<PostsResponse[]>(url);

        if (!responseOk) throw new Error(`[Code ${statusCode}] Failed to fetch posts related to '${tag}' tag`);
        return data;
    }
}
