import { contextBridge, ipcRenderer } from 'electron'
import { CHANNELS, type Win95Host } from '../shared/ipc'

const host: Win95Host = {
  shutdown: () => ipcRenderer.send(CHANNELS.shutdown),
  restart: () => ipcRenderer.send(CHANNELS.restart),
  toggleFullScreen: () => ipcRenderer.send(CHANNELS.toggleFullScreen),
}

contextBridge.exposeInMainWorld('win95', host)
