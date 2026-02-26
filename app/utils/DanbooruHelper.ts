import type { DanbooruPostPreview, DanbooruWikiPage } from "../../shared/danbooru.js";
import type { WikiResponse, PostsResponse } from "../types/danbooru.js";

import { APIClient } from "./APIClient.js";

export class DanbooruHelper {
    static async fetchWiki(tag: string): Promise<DanbooruWikiPage> {
        const url = `https://danbooru.donmai.us/wiki_pages/${encodeURIComponent(tag.toLowerCase())}.json`;
        const [data, responseOk, statusCode] = await APIClient.get<WikiResponse>(url);

        if (statusCode === 404)
            throw new Error(`Wiki page for tag '${tag}' not found!`);
        if (!responseOk && data?.message)
            throw new Error(`[Code ${statusCode}] ${data.message}`);
        if (!responseOk)
            throw new Error(`[Code ${statusCode}] Failed to fetch wiki page`);

        return {
            body: data.body?.trim() ?? ""
        };
    }

    static async fetchPosts(tag: string): Promise<DanbooruPostPreview[]> {
        const url = `https://danbooru.donmai.us/posts.json?limit=10&tags=${encodeURIComponent(tag.replaceAll(" ", "_").toLowerCase())}`;
        const [data, responseOk, statusCode] = await APIClient.get<PostsResponse[]>(url);

        if (!responseOk)
            throw new Error(`[Code ${statusCode}] Failed to fetch posts related to '${tag}' tag`);

        const mapped: DanbooruPostPreview[] = [];

        for (const post of data) {
            const mediaUrl = post.file_url ?? post.large_file_url ?? post.preview_file_url;
            if (!mediaUrl)
                continue;

            const isVideo = post.media_asset.duration != null;
            const previewUrl = isVideo ? post.preview_file_url! : mediaUrl;

            mapped.push({
                id: post.id,
                mediaType: isVideo ? "video" : "image",
                mediaUrl,
                previewUrl,
                postUrl: `https://danbooru.donmai.us/posts/${post.id}`
            });
        }

        return mapped;
    }
}
