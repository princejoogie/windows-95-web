// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { deflateSync, inflateSync } from 'node:zlib'

const [port = '9310', proof = 'D:/codes/worktrees/windows-95-web/proof/assets', mode = 'pixels'] =
  process.argv.slice(2)
mkdirSync(proof, { recursive: true })
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((target) => target.type === 'page')
assert(page, 'Electron exposes a renderer page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})
let id = 0
const pending = new Map()
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  const entry = pending.get(message.id)
  if (!entry) return
  clearTimeout(entry.timeout)
  pending.delete(message.id)
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)))
  else entry.resolve(message.result)
})
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const call = ++id
    const timeout = setTimeout(() => {
      pending.delete(call)
      reject(new Error(`CDP timeout for ${method}`))
    }, 10000)
    pending.set(call, { resolve, reject, timeout })
    ws.send(JSON.stringify({ id: call, method, params }))
  })
}
async function evaluate(expression, userGesture = false) {
  const result = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture,
  })
  assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
  return result.result.value
}

function decodePng(png) {
  let width = 0
  let height = 0
  let channels = 0
  const compressed = []
  for (let offset = 8; offset < png.length; ) {
    const size = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + size)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      assert.equal(data[8], 8, 'PNG uses 8-bit components')
      assert([2, 6].includes(data[9]), 'PNG uses RGB or RGBA')
      assert.equal(data[12], 0, 'PNG is not interlaced')
      channels = data[9] === 2 ? 3 : 4
    }
    if (type === 'IDAT') compressed.push(data)
    offset += size + 12
  }
  const raw = inflateSync(Buffer.concat(compressed))
  const stride = width * channels
  const pixels = Buffer.alloc(height * stride)
  const paeth = (a, b, c) => {
    const p = a + b - c
    const da = Math.abs(p - a)
    const db = Math.abs(p - b)
    const dc = Math.abs(p - c)
    return da <= db && da <= dc ? a : db <= dc ? b : c
  }
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]
    assert(filter <= 4, 'PNG filter is supported')
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[y * stride + x - channels] : 0
      const above = y > 0 ? pixels[(y - 1) * stride + x] : 0
      const corner = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0
      const prediction = [0, left, above, Math.floor((left + above) / 2), paeth(left, above, corner)][filter]
      pixels[y * stride + x] = (raw[y * (stride + 1) + x + 1] + prediction) & 255
    }
  }
  return { width, height, channels, pixels }
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function encodePng(width, height, rgb) {
  const chunk = (type, data) => {
    const payload = Buffer.concat([Buffer.from(type), data])
    const length = Buffer.alloc(4)
    length.writeUInt32BE(data.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(payload))
    return Buffer.concat([length, payload, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const scanlines = Buffer.alloc(height * (width * 3 + 1))
  for (let y = 0; y < height; y++)
    rgb.copy(scanlines, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function inspectCrop(image, rect, expected, file) {
  const left = Math.floor(rect.x)
  const top = Math.floor(rect.y)
  const width = Math.ceil(rect.x + rect.width) - left
  const height = Math.ceil(rect.y + rect.height) - top
  assert(
    left >= 0 && top >= 0 && left + width <= image.width && top + height <= image.height,
    'Crop stays within the screenshot',
  )
  const zoom = Buffer.alloc(width * height * 16 * 3)
  const colors = new Map()
  let intermediate = 0
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = ((top + y) * image.width + left + x) * image.channels
      const color = [...image.pixels.subarray(offset, offset + 3)]
      const key = color.join(',')
      colors.set(key, (colors.get(key) ?? 0) + 1)
      if (!expected.includes(key)) intermediate++
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) zoom.set(color, ((y * 4 + dy) * width * 4 + x * 4 + dx) * 3)
      }
    }
  }
  assert(
    colors.has(expected[0]) && colors.has(expected[1]),
    'Crop contains both glyph ink and its background',
  )
  writeFileSync(join(proof, file), encodePng(width * 4, height * 4, zoom))
  return {
    rect: { x: left, y: top, width, height },
    intermediate,
    colors: Object.fromEntries(colors),
    screenshot: resolve(proof, file),
  }
}

try {
  if (mode === 'sound' || mode === 'sound-missing' || mode === 'sound-locked') {
    const result = await evaluate(
      `(async () => {
      const url = location.protocol === 'file:' ? new URL('./system-sound/sound.js', location.href).href : '/src/system/sound.ts'
      const {playSound} = await import(url)
      const played = await playSound('chord')
      const replayed = await playSound('chord')
      return {played, replayed}
    })()`,
      mode === 'sound',
    )
    if (mode === 'sound') {
      assert(result.played?.duration > 0, 'The real chord buffer starts playback')
      assert.deepEqual(result.played, result.replayed, 'Cached playback has the same decoded metrics')
    } else {
      assert.equal(result.played, null, 'Unavailable audio returns silence')
      assert.equal(result.replayed, null, 'Repeated unavailable audio returns silence')
    }
    writeFileSync(join(proof, `${mode}.json`), `${JSON.stringify(result, null, 2)}\n`)
    console.log(JSON.stringify(result))
  } else if (mode === 'fallback') {
    const result = await evaluate(
      `({title: document.title, text: document.body.innerText, font: getComputedStyle(document.body).fontFamily, cursor: getComputedStyle(document.body).cursor, customFonts: [...document.fonts].filter(f => f.family.includes('Bitmap')).length})`,
    )
    assert(
      result.text.includes('My Computer') && result.text.includes('Start'),
      'Fallback Electron boots to the desktop',
    )
    assert.equal(result.customFonts, 0, 'Fallback defines no imported bitmap fonts')
    assert.equal(result.cursor, 'default', 'Fallback uses the default CSS cursor')
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(proof, 'fallback-desktop.png'), Buffer.from(shot.data, 'base64'))
    writeFileSync(join(proof, 'fallback.json'), `${JSON.stringify(result, null, 2)}\n`)
    console.log(JSON.stringify(result))
  } else {
    await evaluate('document.fonts.ready')
    const result = await evaluate(`(() => {
      const title = document.querySelector('.bg-title .font-bold')
      const menu = [...document.querySelectorAll('[role="menuitem"]')].find(e => e.textContent === 'Programs')?.querySelector('span.flex-1')
      const area = document.querySelector('textarea[aria-label="Document text"]')
      if (!title || !menu || !area) throw new Error('Open Notepad and the Start menu before this check')
      const rangeRect = element => { const r = document.createRange(); r.selectNodeContents(element); return r.getBoundingClientRect().toJSON() }
      const style = getComputedStyle(area)
      const bounds = area.getBoundingClientRect()
      const editor = {x: bounds.x + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft), y: bounds.y + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop), width: Math.min(400, bounds.width - 10), height: parseFloat(style.lineHeight)}
      const edge = document.querySelector('[style*="cursor: ns-resize"]')
      return {dpr: devicePixelRatio, title: rangeRect(title), menu: rangeRect(menu), editor, monoFamily: style.fontFamily, monoSize: style.fontSize, monoHeight: style.lineHeight, cursor: {desktop: getComputedStyle(document.body).cursor, editor: style.cursor, edge: edge && getComputedStyle(edge).cursor}, loadedFonts: [...document.fonts].map(f => ({family:f.family, weight:f.weight, status:f.status}))}
    })()`)
    assert.equal(result.dpr, 1, 'Screenshot uses the 96 DPI target')
    assert(result.monoFamily.includes('Fixedsys Bitmap'), 'Notepad selects the imported Fixedsys family')
    assert.equal(result.monoSize, '12px', 'Notepad uses the native Fixedsys pixel size')
    assert(
      result.loadedFonts.some((font) => font.family === 'Fixedsys Bitmap' && font.status === 'loaded'),
      'The Fixedsys font has loaded',
    )
    assert(result.cursor.desktop.includes('.cur'), 'Desktop uses the imported arrow')
    assert(result.cursor.editor.includes('.cur'), 'Notepad uses the imported I-beam')
    assert(result.cursor.edge?.includes('.cur'), 'Window edge uses the imported resize cursor')
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    const png = Buffer.from(shot.data, 'base64')
    writeFileSync(join(proof, 'electron-assets.png'), png)
    const image = decodePng(png)
    result.pixels = {
      caption: inspectCrop(image, result.title, ['255,255,255', '0,0,128'], 'caption-4x.png'),
      startMenu: inspectCrop(image, result.menu, ['0,0,0', '192,192,192'], 'start-menu-4x.png'),
      notepad: inspectCrop(image, result.editor, ['0,0,0', '255,255,255'], 'notepad-4x.png'),
    }
    await send('DOM.enable')
    await send('CSS.enable')
    const dom = await send('DOM.getDocument')
    result.renderedFonts = {}
    for (const [name, selector] of [
      ['caption', '.bg-title .font-bold'],
      ['notepad', 'textarea'],
      ['menu', '[role="menuitem"] span.flex-1'],
    ]) {
      const node = await send('DOM.querySelector', { nodeId: dom.root.nodeId, selector })
      result.renderedFonts[name] = await send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId })
    }
    writeFileSync(join(proof, 'pixels-and-cursors.json'), `${JSON.stringify(result, null, 2)}\n`)
    console.log(JSON.stringify(result))
    for (const [name, pixels] of Object.entries(result.pixels))
      assert.equal(pixels.intermediate, 0, `${name} has no antialiasing colors`)
  }
} finally {
  ws.close()
}
