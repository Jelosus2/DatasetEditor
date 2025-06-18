export async function fetchDanbooruWiki(tag) {
  const res = await fetch(
    `https://danbooru.donmai.us/wiki_pages/${encodeURIComponent(tag.toLowerCase())}.json`
  );

  const json = await res.json();
  if (res.status === 404) throw new Error(`Wiki page for tag '${tag}' not found!`);
  if (!res.ok && json.error) throw new Error(`[Code ${res.status}] ${json.error}`);
  if (!res.ok) throw new Error(`[Code ${res.status}] Unknown error`);
  return json;
}

export async function fetchDanbooruPosts(tag) {
  const res = await fetch(
    `https://danbooru.donmai.us/posts.json?limit=10&tags=${encodeURIComponent(tag.replace(/ /g, '_').toLowerCase())}`
  );

  if (!res.ok) throw new Error(`[Code ${res.status}] Failed to fetch posts related to '${tag}' tag`);
  return await res.json();
}
