// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipcRenderer', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  receive: (channel, func) => ipcRenderer.on(channel, (_, ...args) => func(...args)),
  unsubscribe: (channel) => ipcRenderer.removeAllListeners(channel),
  invoke: async (channel, ...args) => {
    return await ipcRenderer.invoke(channel, ...args);
  },
});
