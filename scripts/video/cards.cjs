const { app, BrowserWindow, ipcMain } = require('electron')
const { writeFileSync } = require('node:fs')
const path = require('node:path')

app.commandLine.appendSwitch('remote-debugging-port', process.env.W95_VIDEO_CARDS_PORT || '9441')
app.commandLine.appendSwitch('disable-font-subpixel-positioning')
app.commandLine.appendSwitch('disable-lcd-text')
app.commandLine.appendSwitch('enable-blink-features', 'NoFontAntialiasing')
app.setPath('userData', process.env.W95_DATA_DIR)
app.whenReady().then(() => {
  const window = new BrowserWindow({
    width: 1920,
    height: 1080,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: { backgroundThrottling: false, preload: path.join(__dirname, 'cards-preload.cjs') },
  })
  ipcMain.handle('video:capture', async (event, file, width, height) => {
    if (event.sender !== window.webContents) throw new Error('Wrong capture sender')
    window.setContentSize(width, height)
    const image = await window.webContents.capturePage(
      { x: 0, y: 0, width, height },
      { stayHidden: true, stayAwake: true },
    )
    const size = image.getSize()
    if (size.width !== width || size.height !== height)
      throw new Error(`Wrong card capture size ${JSON.stringify(size)}`)
    writeFileSync(file, image.toPNG())
  })
  window.loadFile(path.join(__dirname, 'title.html'))
})
app.on('window-all-closed', () => app.quit())
