import DText from 'dtext-parser';

DText.options({
  "External link": {
    attrs: [{ name: 'class', value: 'text-info hover:text-info/80 cursor-pointer' }]
  },
  "Wiki link": {
    attrs: [{ name: 'class', value: 'text-info hover:text-info/80 cursor-pointer' }]
  },
  "Tag link": {
    attrs: [{ name: 'class', value: 'text-info hover:text-info/80 cursor-pointer' }]
  },
  "Intern link": {
    attrs: [{ name: 'class', value: 'text-info hover:text-info/80 cursor-pointer' }]
  }
});

export async function fetchWiki(tag: string) {
  const json = (await window.ipcRenderer.invoke('fetch_danbooru_wiki', tag)) as { body: string };
  return json;
}

export async function fetchPosts(tag: string) {
  const posts = (await window.ipcRenderer.invoke('fetch_danbooru_posts', tag)) as Array<{
    id: number;
    file_url: string;
  }>;
  return posts;
}

export async function parseWikiBody(body: string): Promise<string> {
  let parsed = await DText.parse(body);
  parsed = parsed.replace(/https:\/\/e621\.net/g, 'https://danbooru.donmai.us');
  parsed = parsed.replace(/href="([^"]+)"/g, (_, href) => `onclick="ipcRenderer.invoke('open-url', '${href}')"`);
  return parsed;
}
