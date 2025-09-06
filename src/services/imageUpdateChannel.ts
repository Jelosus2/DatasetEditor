import { reactive } from 'vue';

export const imageUpdateMap = reactive(new Map<string, number>());

function normalizePath(p: string): string {
  return p.replace(/\\|\\\\/g, '/');
}

if (!window?.__imageUpdatedListenerAdded) {
  window.ipcRenderer.receive('image-updated', (payload: unknown) => {
    const data = (payload ?? {}) as { path?: string; mtime?: number };
    if (!data?.path) return;

    const key = normalizePath(data.path);
    const next = typeof data.mtime === 'number' ? data.mtime : (imageUpdateMap.get(key) ?? 0) + 1;
    imageUpdateMap.set(key, next);
  });
  window.__imageUpdatedListenerAdded = true;
}

export function getImageUpdateVersion(path: string): number {
  return imageUpdateMap.get(normalizePath(path)) ?? 0;
}
