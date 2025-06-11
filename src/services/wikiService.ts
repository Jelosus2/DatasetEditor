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
  const res = await fetch(`https://danbooru.donmai.us/wiki_pages/${encodeURIComponent(tag.toLowerCase())}.json`);
  const json = await res.json();
  if (res.status === 404) throw new Error(`Wiki page for tag '${tag}' not found!`);
  if (!res.ok && json.error) throw new Error(`[Code ${res.status}] ${json.error}`);
  if (!res.ok) throw new Error(`[Code ${res.status}] Unkown error`);
  return json as { body: string };
}

export async function fetchPosts(tag: string) {
  const res = await fetch(
    `https://danbooru.donmai.us/posts.json?limit=10&tags=${encodeURIComponent(tag.replace(/ /g, '_').toLowerCase())}`
  );
  if (!res.ok) throw new Error(`[Code ${res.status}] Failed to fetch posts related to '${tag}' tag`);
  return res.json() as Promise<Array<{ id: number; file_url: string }>>;
}

export async function parseWikiBody(body: string): Promise<string> {
  let parsed = await DText.parse(body);
  parsed = parsed.replace(/https:\/\/e621\.net/g, 'https://danbooru.donmai.us');
  parsed = parsed.replace(/href="([^"]+)"/g, (_, href) => `onclick="ipcRenderer.invoke('open-url', '${href}')"`);
  return parsed;
}
