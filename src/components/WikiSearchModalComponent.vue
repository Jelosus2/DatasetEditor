<script setup lang="ts">
import type { DanbooruWikiPage, DanbooruPostPreview } from "../../shared/danbooru";

import AutocompletionInput from "@/components/AutocompletionInput.vue";

import { WikiService } from "@/services/wikiService";
import { ref, computed, onMounted, onUnmounted } from "vue";

const SKELETON_POST_COUNT = 10;
const skeletonSlots = Array.from({ length: SKELETON_POST_COUNT }, (_, i) => i);

const wikiService = new WikiService();
window.openTagWikiInBrowser = wikiService.openTagWikiInBrowser;

const tag = ref("");
const wiki = ref<DanbooruWikiPage | null>(null);
const posts = ref<DanbooruPostPreview[]>([]);
const html = ref("");
const loading = ref(false);
const hasSearched = ref(false);

let latestSearchId = 0;

const showEmptyPostsState = computed(() =>
    hasSearched.value && !loading.value && posts.value.length === 0
);

async function search() {
    const query = tag.value.trim();

    hasSearched.value = false;
    wiki.value = null;
    posts.value = [];
    html.value = "";

    if (!query)
        return;

    const searchId = ++latestSearchId;
    loading.value = true;
    hasSearched.value = true;

    const [nextWiki, nextPosts] = await Promise.all([
        wikiService.fetchWiki(query),
        wikiService.fetchPosts(query)
    ]);

    if (searchId !== latestSearchId)
        return;

    const sourceBody = nextWiki?.body.trim() || "";
    const description = sourceBody.match(/^[\s\S]*?(?=^h[1-6]\.\s+)/m);
    const descriptionBody = (description ? description[0] : sourceBody) || "No description was found for this wiki page";
    const parsedHtml = await wikiService.parseWikiBody(descriptionBody);

    if (searchId !== latestSearchId)
        return;

    wiki.value = nextWiki;
    posts.value = nextPosts;
    html.value = parsedHtml;

    if (searchId === latestSearchId)
        loading.value = false;
}

function openPost(postUrl: string) {
    wikiService.openDanbooruPostInBrowser(postUrl);
}

function handleWikiOpen(event: Event) {
    const tagName = (event as CustomEvent<string>).detail;
    tag.value = tagName;
    search();
}

onMounted(() => {
    window.addEventListener("danbooru-wiki-open", handleWikiOpen);
});

onUnmounted(() => {
    window.removeEventListener("danbooru-wiki-open", handleWikiOpen);
});
</script>

<template>
    <input type="checkbox" id="danbooru_wiki_modal" class="modal-toggle" />
    <div class="modal z-50" role="dialog">
        <div class="modal-box h-9/12 w-11/12 max-w-5xl">
            <label for="danbooru_wiki_modal" class="absolute top-1 right-2 cursor-pointer">✕</label>
            <div class="flex items-end justify-center gap-2 pb-4">
                <label class="input pl-1 pr-0 outline-none!">
                    <AutocompletionInput
                        v-model="tag"
                        placeholder="Search tag"
                        :dropdown-below="true"
                        @on-complete="search"
                    />
                </label>
                <button class="btn btn-primary" @click="search">Search</button>
            </div>
            <div v-if="loading" class="space-y-2">
                <div class="skeleton bg-base-content/30 h-4 w-full"></div>
                <div class="skeleton bg-base-content/30 h-4 w-10/12"></div>
                <div class="skeleton bg-base-content/30 h-4 w-8/12"></div>
            </div>
            <div v-else-if="wiki" class="prose max-w-none" v-html="html"></div>
            <div v-else-if="hasSearched" class="text-base-content/70 py-1">
                No wiki description found.
            </div>
            <div class="pt-4">
                <div class="grid grid-cols-5 gap-2">
                    <template v-if="loading || showEmptyPostsState">
                        <div
                            v-for="slot in skeletonSlots"
                            :key="`skeleton-${slot}`"
                            class="skeleton bg-base-content/30 w-full h-80 rounded-md"
                        ></div>
                    </template>
                    <template v-else>
                        <button
                            v-for="post in posts"
                            :key="post.id"
                            class="relative w-full rounded-md border border-base-content/20"
                            @click="openPost(post.postUrl)"
                        >
                            <img
                                :src="post.previewUrl"
                                class="w-full cursor-pointer"
                                loading="lazy"
                                decoding="async"
                            />
                            <span
                                v-if="post.mediaType === 'video'"
                                class="badge badge-neutral badge-sm absolute top-1 right-1"
                            >
                                Video
                            </span>
                        </button>
                    </template>
                </div>
                <div v-if="showEmptyPostsState" class="pt-3 text-center text-base-content/70">
                    No related posts found for this tag.
                </div>
            </div>
        </div>
        <label class="modal-backdrop" for="danbooru_wiki_modal"></label>
    </div>
</template>
