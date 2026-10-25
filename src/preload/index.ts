import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type HostEvent, type Win95Host } from '../shared/ipc'

const host: Win95Host = {
  shutdown: () => ipcRenderer.send(CHANNELS.shutdown),
  restart: () => ipcRenderer.send(CHANNELS.restart),
  toggleFullScreen: () => ipcRenderer.send(CHANNELS.toggleFullScreen),
  onEvent: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, event: HostEvent) => handler(event)
    ipcRenderer.on(CHANNELS.hostEvent, listener)
    return () => {
      ipcRenderer.removeListener(CHANNELS.hostEvent, listener)
    }
  },
}

contextBridge.exposeInMainWorld('win95', host)
