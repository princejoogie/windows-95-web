import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { CHANNELS } from '../shared/ipc'

if (process.env.W95_DATA_DIR) app.setPath('userData', process.env.W95_DATA_DIR)
if (process.env.W95_CDP_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.W95_CDP_PORT)
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
}

const rendererDir = join(import.meta.dirname, '../renderer')

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    useContentSize: true,
    minWidth: 640,
    minHeight: 480,
    show: false,
    backgroundColor: '#000000',
    title: 'Windows 95',
    icon: join(rendererDir, 'icon.ico'),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
    },
  })

  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault()
      win.setFullScreen(!win.isFullScreen())
    }
  })
  win.on('page-title-updated', (event) => event.preventDefault())

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(rendererDir, 'index.html'))
  return win
}

Menu.setApplicationMenu(null)

void app.whenReady().then(() => {
  const win = createWindow()
  const fromOwnWindow = (event: Electron.IpcMainEvent): boolean => event.sender === win.webContents

  ipcMain.on(CHANNELS.shutdown, (event) => {
    if (fromOwnWindow(event)) app.quit()
  })
  ipcMain.on(CHANNELS.restart, (event) => {
    if (fromOwnWindow(event)) win.webContents.reload()
  })
  ipcMain.on(CHANNELS.toggleFullScreen, (event) => {
    if (fromOwnWindow(event)) win.setFullScreen(!win.isFullScreen())
  })
})

app.on('window-all-closed', () => app.quit())
