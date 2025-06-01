/// <reference types="vite/client" />

export interface ipcElectronAPI {
  send: <T>(channel: string, ...args: T[]) => void;
  receive: <T>(channel: string, callback: (...args: T[]) => void) => void;
  unsubscribe: (channel: string) => void;
  invoke: <T>(channel: string, ...args: T[]) => Promise<unknown>;
}

declare global {
  interface Window {
    ipcRenderer: ipcElectronAPI;
  }
}

declare module '*.json' {
  const value: unknown;
  export default value;
}
