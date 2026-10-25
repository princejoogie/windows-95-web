const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('videoCapture', (file, width, height) =>
  ipcRenderer.invoke('video:capture', file, width, height),
)
