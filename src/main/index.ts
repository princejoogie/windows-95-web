import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { CHANNELS, type HostEvent } from '../shared/ipc'

app.commandLine.appendSwitch('disable-font-subpixel-positioning')
app.commandLine.appendSwitch('disable-lcd-text')
app.commandLine.appendSwitch('enable-blink-features', 'NoFontAntialiasing')

if (process.env.W95_DATA_DIR) app.setPath('userData', process.env.W95_DATA_DIR)
if (process.env.W95_CDP_PORT) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env.W95_CDP_PORT)
  app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion')
}

const rendererDir = join(import.meta.dirname, '../renderer')
let allowQuit = false

function createWindow(): BrowserWindow {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const preference = join(app.getPath('userData'), 'shell-window.json')
  let fullscreen = false
  try {
    const saved: unknown = JSON.parse(readFileSync(preference, 'utf8'))
    fullscreen = Boolean(
      saved && typeof saved === 'object' && 'fullscreen' in saved && saved.fullscreen === true,
    )
  } catch {
    /* The first launch has no window preference. */
  }
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    useContentSize: true,
    minWidth: 640,
    minHeight: 480,
    show: false,
    frame: false,
    fullscreen,
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
  win.on('enter-full-screen', () => writeFileSync(preference, JSON.stringify({ fullscreen: true })))
  win.on('leave-full-screen', () => writeFileSync(preference, JSON.stringify({ fullscreen: false })))
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.on('before-input-event', (event, input) => {
    const forward = (message: HostEvent) => {
      event.preventDefault()
      win.webContents.send(CHANNELS.hostEvent, message)
    }
    if (input.type === 'keyUp' && input.key === 'Alt')
      win.webContents.send(CHANNELS.hostEvent, { type: 'alt-release' } satisfies HostEvent)
    if (input.type === 'keyDown') {
      if (input.alt && input.key === 'F4') forward({ type: 'alt-f4' })
      else if (input.alt && input.key === 'Tab') forward({ type: 'alt-tab', reverse: input.shift })
      else if (input.control && input.key === 'Escape') forward({ type: 'start' })
    }
    if (input.type === 'keyDown' && input.key === 'F11') {
      event.preventDefault()
      win.setFullScreen(!win.isFullScreen())
    }
  })
  win.on('page-title-updated', (event) => event.preventDefault())
  win.on('close', (event) => {
    if (allowQuit) return
    event.preventDefault()
    win.webContents.send(CHANNELS.hostEvent, { type: 'host-close' } satisfies HostEvent)
  })

  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void win.loadFile(join(rendererDir, 'index.html'))
  return win
}

Menu.setApplicationMenu(null)

void app.whenReady().then(() => {
  const win = createWindow()
  const fromOwnWindow = (event: Electron.IpcMainEvent): boolean => event.sender === win.webContents

  ipcMain.on(CHANNELS.shutdown, (event) => {
    if (fromOwnWindow(event)) {
      allowQuit = true
      app.quit()
    }
  })
  ipcMain.on(CHANNELS.restart, (event) => {
    if (fromOwnWindow(event)) win.webContents.reload()
  })
  ipcMain.on(CHANNELS.toggleFullScreen, (event) => {
    if (fromOwnWindow(event)) win.setFullScreen(!win.isFullScreen())
  })
})

app.on('window-all-closed', () => app.quit())
