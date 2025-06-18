<script setup lang="ts">
import AutocompletionComponent from '@/components/AutocompletionComponent.vue';

import { ref } from 'vue';
import { fetchWiki, fetchPosts, parseWikiBody } from '@/services/wikiService';
import { useLogStore } from '@/stores/logStore';

const tag = ref('');
const wiki = ref<{ body: string } | null>(null);
const posts = ref<Array<{ id: number; file_url: string }>>([]);
const html = ref('');
const loading = ref(false);
const error = ref('');

const logStore = useLogStore();

async function search() {
  error.value = '';
  loading.value = true;

  try {
    wiki.value = await fetchWiki(tag.value);
    posts.value = await fetchPosts(tag.value);

    const description = wiki.value.body.match(/^[\s\S]*?(?=^h[1-6]\.\s+)/m);
    const result = description ? description[0] : wiki.value.body;
    html.value = await parseWikiBody(result || 'No description was found for this wiki page');
  } catch (err) {
    wiki.value = null;
    posts.value = [];
    const message = `Failed to fetch wiki: ${(err as Error).message}`;
    error.value = message;
    logStore.addLog('error', message);
  } finally {
    loading.value = false;
  }
}

function openImage(id: number) {
  window.ipcRenderer.invoke('open-url', `https://danbooru.donmai.us/posts/${id}`);
}
</script>

<template>
  <input type="checkbox" id="danbooru_wiki_modal" class="modal-toggle" />
  <div class="modal" role="dialog">
    <div class="modal-box w-11/12 max-w-5xl h-9/12">
      <label for="danbooru_wiki_modal" class="absolute right-2 top-1 cursor-pointer">✕</label>
      <div class="flex justify-center items-end gap-2 pb-4">
        <label class="input input-sm pr-0 pl-1 !outline-none">
          <AutocompletionComponent
            v-model="tag"
            :id="'wiki-search-list'"
            :placeholder="'Search tag'"
            :dropdown-below="true"
            @on-complete="search"
          />
        </label>
        <button class="btn btn-primary btn-sm" @click="search">Search</button>
      </div>
      <div v-if="loading" class="flex justify-center py-4">
        <span class="loading loading-spinner"></span>
      </div>
      <div v-else>
        <div v-if="wiki" class="prose max-w-none" v-html="html"></div>
        <div v-if="posts.length && wiki" class="grid grid-cols-2 gap-2 pt-4 sm:grid-cols-3 md:grid-cols-5">
          <img
            v-for="post in posts"
            :key="post.id"
            :src="post.file_url"
            class="w-full cursor-pointer"
            @click="openImage(post.id)"
          />
        </div>
        <div v-if="error" class="flex justify-center items-center bg-error font-bold p-2">
          <span>{{ error }}</span>
        </div>
      </div>
    </div>
    <label class="modal-backdrop" for="danbooru_wiki_modal"></label>
  </div>
</template>
