import electron from 'electron';

const { contextBridge, ipcRenderer } = electron;

contextBridge.exposeInMainWorld('ipcRenderer', {
    send: (channel: string, data: unknown[]) => ipcRenderer.send(channel, data)
});
