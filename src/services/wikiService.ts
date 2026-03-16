import type { Rating } from "../../shared/danbooru";

import { UtilitiesService } from "@/services/utilitiesService";
import { useIpcRenderer } from "@/composables/useIpcRenderer";
import { useAlert } from "@/composables/useAlert";
import DText from "dtext-parser";

DText.options({
    "External link": {
        attrs: [{ name: "class", value: "text-info hover:text-info/80 cursor-pointer" }]
    },
    "Wiki link": {
        attrs: [{ name: "class", value: "text-info hover:text-info/80 cursor-pointer" }]
    },
    "Tag link": {
        attrs: [{ name: "class", value: "text-info hover:text-info/80 cursor-pointer" }]
    },
    "Intern link": {
        attrs: [{ name: "class", value: "text-info hover:text-info/80 cursor-pointer" }]
    }
});

export class WikiService {
    private ipc = useIpcRenderer([]);
    private alert = useAlert();
    private utilitiesService = new UtilitiesService();

    async fetchWiki(tag: string) {
        const result = await this.ipc.invoke("danbooru:fetch_wiki", tag);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return null;
        }

        return result.data!;
    }

    async fetchPosts(tag: string, rating: Rating) {
        const result = await this.ipc.invoke("danbooru:fetch_posts", tag, rating);

        if (result.error) {
            this.alert.showAlert("error", result.message!);
            return [];
        }

        return result.data!;
    }

    openDanbooruPostInBrowser(postUrl: string) {
        this.utilitiesService.openUrlInBrowser(postUrl);
    }

    openTagWikiInBrowser = (event: MouseEvent, href: string) => {
        event.preventDefault();

        if (event.shiftKey) {
            this.utilitiesService.openUrlInBrowser(href);
            return;
        }

        const match = href.match(/\/wiki_pages\/([^?#]+)|[?&]title=([^&#]+)/);
        if (match) {
            const tag = decodeURIComponent(match[1] ?? match[2] ?? "").replace(/\+/g, " ");
            window.dispatchEvent(new CustomEvent("danbooru-wiki-open", { detail: tag }));
        }
    }

    async parseWikiBody(body: string) {
        let parsed = await DText.parse(body);
        parsed = parsed.replace(/https:\/\/e621\.net/g, "https://danbooru.donmai.us");
        parsed = parsed.replace(/href="([^"]+)"/g, (_, href: string) => {
            const safeHref = href.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
            return `onclick="openTagWikiInBrowser(event, '${safeHref}')"`;
        });

        return parsed;
    }
}
