import { onMounted, onUnmounted } from 'vue'

export interface IpcListener {
  channel: string
  handler: (...args: unknown[]) => void
}

export function useIpcRenderer(listeners: IpcListener[]) {
  onMounted(() => {
    listeners.forEach(({ channel, handler }) => {
      window.ipcRenderer.receive(channel, handler)
    })
  })

  onUnmounted(() => {
    listeners.forEach(({ channel }) => {
      window.ipcRenderer.unsubscribe(channel)
    })
  })

  const invoke = async <T>(channel: string, ...args: unknown[]): Promise<T> => {
    return window.ipcRenderer.invoke(channel, ...args) as T;
  }

  const send = (channel: string, ...args: unknown[]) => {
    window.ipcRenderer.send(channel, ...args)
  }

  return { invoke, send }
}
