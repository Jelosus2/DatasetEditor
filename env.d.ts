/// <reference types="vite/client" />

import type { openWikiLink } from "@/services/wikiService";

export interface ipcElectronAPI {
  send: <T>(channel: string, ...args: T[]) => void;
  receive: <T>(channel: string, callback: (...args: T[]) => void) => void;
  unsubscribe: (channel: string) => void;
  invoke: <T>(channel: string, ...args: T[]) => Promise<unknown>;
}

declare global {
  interface Window {
    ipcRenderer: ipcElectronAPI;
    openWikiLink: typeof openWikiLink;
  }
}

declare module '*.json' {
  const value: unknown;
  export default value;
}
