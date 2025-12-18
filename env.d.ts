/// <reference types="vite/client" />
import type { openWikiLink } from "@/services/wikiService";

interface ipcElectronAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  send: (channel: string, ...args: unknown[]) => void;
  on: (channel: string, listener: (...args: unknown[]) => void) => () => void;
}

declare global {
  interface Window {
    ipcRenderer: ipcElectronAPI;
    openWikiLink: typeof openWikiLink;
    __imageUpdatedListenerAdded: boolean;
  }
}

declare module '*.json' {
  const value: unknown;
  export default value;
}
