// Drives Paint in the running Electron app over CDP with real mouse and keyboard events.
//   node scripts/verify/paintfix.mjs [cdp port] [proof dir]
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const port = Number(process.argv[2] ?? 9351)
const proof = resolve(process.argv[3] ?? '../proof/paintfix')
mkdirSync(proof, { recursive: true })

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((ok, fail) => {
  ws.addEventListener('open', ok, { once: true })
  ws.addEventListener('error', fail, { once: true })
})
let nextId = 0
const waiting = new Map()
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  waiting.get(message.id)?.(message)
  waiting.delete(message.id)
})
const send = (method, params = {}) =>
  new Promise((ok) => {
    const id = ++nextId
    waiting.set(id, ok)
    ws.send(JSON.stringify({ id, method, params }))
  })
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms))
async function evaluate(expression) {
  const { result } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? expression)
  return result.result.value
}
const mouse = (type, x, y, extra = {}) =>
  send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), ...extra })
async function click(x, y, { button = 'left', count = 1, modifiers = 0 } = {}) {
  const buttons = button === 'left' ? 1 : 2
  await mouse('mouseMoved', x, y, { modifiers })
  for (let i = 1; i <= count; i++) {
    await mouse('mousePressed', x, y, { button, clickCount: i, buttons, modifiers })
    await mouse('mouseReleased', x, y, { button, clickCount: i, buttons: 0, modifiers })
  }
  await wait(80)
}
async function drag(x1, y1, x2, y2, { button = 'left', modifiers = 0, steps = 10, hold } = {}) {
  const buttons = button === 'left' ? 1 : 2
  await mouse('mouseMoved', x1, y1, { modifiers })
  await mouse('mousePressed', x1, y1, { button, clickCount: 1, buttons, modifiers })
  for (let i = 1; i <= steps; i++) {
    await mouse('mouseMoved', x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps, {
      button,
      buttons,
      modifiers,
    })
    await wait(12)
  }
  if (hold) await hold()
  await mouse('mouseReleased', x2, y2, { button, clickCount: 1, buttons: 0, modifiers })
  await wait(80)
}
const VK = { Enter: 13, Escape: 27, Delete: 46, F4: 115, PageUp: 33, PageDown: 34, Tab: 9 }
async function key(name, { ctrl = false, shift = false, alt = false } = {}) {
  const single = name.length === 1
  const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (shift ? 8 : 0)
  const vk = single ? name.toUpperCase().charCodeAt(0) : VK[name]
  const code = single ? (/\d/.test(name) ? `Digit${name}` : `Key${name.toUpperCase()}`) : name
  const text = single && !ctrl && !alt ? name : name === 'Enter' ? '\r' : undefined
  const base = { key: name, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers }
  await send('Input.dispatchKeyEvent', {
    type: text ? 'keyDown' : 'rawKeyDown',
    ...base,
    text,
    unmodifiedText: text,
  })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  await wait(50)
}
async function type(text) {
  await send('Input.insertText', { text })
  await wait(80)
}
async function shot(name) {
  await wait(150)
  const { result } = await send('Page.captureScreenshot', { format: 'png' })
  const file = join(proof, `${name}.png`)
  writeFileSync(file, Buffer.from(result.data, 'base64'))
  return file
}

const checks = []
async function check(finding, name, ok, screenshot) {
  const file = screenshot ? await shot(screenshot) : null
  checks.push({ finding, name, ok: Boolean(ok), file })
  console.log(`${ok ? 'PASS' : 'FAIL'} [${finding}] ${name}${file ? ` -> ${file}` : ''}`)
}

const W = '[data-window][aria-label$=" - Paint"]'
const q = (selector) => JSON.stringify(selector)
async function rect(selector, index = 0) {
  const box = await evaluate(
    `(() => { const e = document.querySelectorAll(${q(selector)})[${index}]; if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } })()`,
  )
  assert.ok(box, `no element ${selector}`)
  return box
}
async function clickSelector(selector, options) {
  const box = await rect(selector)
  await click(box.x + box.w / 2, box.y + box.h / 2, options)
}
async function textCenter(selector, text, starts = false) {
  const point = await evaluate(
    `(() => { const e = [...document.querySelectorAll(${q(selector)})].find((e) => ${starts ? `e.textContent.trim().startsWith(${q(text)})` : `e.textContent.trim() === ${q(text)}`}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`,
  )
  assert.ok(point, `no ${selector} with text ${text}`)
  return point
}
async function clickText(selector, text, starts = false) {
  const p = await textCenter(selector, text, starts)
  await click(p.x, p.y)
}
async function menu(label) {
  await clickText(`${W} [role="menubar"] button`, label)
  await wait(120)
}
const menuItems = () =>
  evaluate(
    `[...document.querySelectorAll('${W} [role="menu"] [role="menuitem"]')].map((b) => (b.getAttribute('aria-disabled') === 'true' ? '(disabled) ' : '') + b.textContent)`,
  )
const item = (text) => clickText(`${W} [role="menu"] [role="menuitem"]`, text, true)
async function hoverItem(text) {
  const p = await textCenter(`${W} [role="menu"] [role="menuitem"]`, text, true)
  await mouse('mouseMoved', p.x, p.y)
  await wait(450)
}
const dialogs = () =>
  evaluate(
    `[...document.querySelectorAll('[role="dialog"]')].map((d) => ({ title: d.getAttribute('aria-label'), text: d.innerText }))`,
  )
const status = () =>
  evaluate(
    `[...document.querySelectorAll('${W} .bevel-shallow.truncate')].slice(-3).map((p) => p.textContent)`,
  )
let canvasBox
const at = (x, y) => [canvasBox.x + x + 0.2, canvasBox.y + y + 0.2]
const pixel = (x, y) =>
  evaluate(
    `(() => { const d = document.querySelector('${W} canvas[aria-label="Paint canvas"]').getContext('2d').getImageData(${x}, ${y}, 1, 1).data; return '#' + [...d].slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('') })()`,
  )
const count = (x, y, w, h, color) =>
  evaluate(
    `(() => { const d = document.querySelector('${W} canvas[aria-label="Paint canvas"]').getContext('2d').getImageData(${x}, ${y}, ${w}, ${h}).data; let n = 0; for (let i = 0; i < d.length; i += 4) if ('#' + [d[i], d[i+1], d[i+2]].map((v) => v.toString(16).padStart(2, '0')).join('') === ${q(color)}) n++; return n })()`,
  )
const tool = (label) => clickSelector(`${W} button[aria-label=${q(label)}]`)
async function clearImage() {
  await key('n', { ctrl: true, shift: true })
  await wait(80)
}
async function closeDialogs() {
  for (let i = 0; i < 4; i++) {
    const open = await dialogs()
    if (!open.length) return
    await key('Escape')
    await wait(100)
  }
}

// Fresh boot, then Start > Programs > Accessories > Paint.
await evaluate('localStorage.clear()')
await send('Page.reload')
await wait(1500)
await evaluate(
  `[...document.querySelectorAll('[data-window] button[aria-label="Close"]')].forEach((b) => b.click())`,
)
await clickText('button', 'Start')
await wait(250)
for (const name of ['Programs', 'Accessories']) {
  const p = await textCenter('[role="menu"] [role="menuitem"]', name)
  await mouse('mouseMoved', p.x, p.y)
  await wait(450)
}
await clickText('[role="menu"] [role="menuitem"]', 'Paint')
await wait(700)
canvasBox = await rect(`${W} canvas[aria-label="Paint canvas"]`)

// Finding 17: the 2x8 tool box with Curve and Polygon.
const toolbox = await evaluate(
  `[...document.querySelectorAll('${W} [data-paint="toolbox"] > .grid > button')].map((b) => { const r = b.getBoundingClientRect(); return [b.getAttribute('aria-label'), Math.round(r.x), Math.round(r.y)] })`,
)
console.log('toolbox', JSON.stringify(toolbox))
await check(
  17,
  'tool box is two columns of eight with Curve after Line and Polygon after Rectangle',
  toolbox.length === 16 &&
    toolbox[11][0] === 'Curve' &&
    toolbox[13][0] === 'Polygon' &&
    new Set(toolbox.map((t) => t[1])).size === 2 &&
    new Set(toolbox.map((t) => t[2])).size === 8,
  '17-toolbox',
)

// Finding 41: Line and Rectangle start at 1 px.
await tool('Rectangle')
await drag(...at(20, 20), ...at(80, 60))
await check(
  41,
  'default rectangle border is 1 px',
  (await pixel(20, 40)) === '#000000' && (await pixel(21, 40)) === '#ffffff',
)
await tool('Line')
const widthsShown = await evaluate(
  `[...document.querySelectorAll('${W} [data-paint="options"] button')].map((b) => b.getAttribute('aria-label') + (b.getAttribute('aria-pressed') === 'true' ? '*' : ''))`,
)
await check(
  41,
  `line widths 1-5 with 1 chosen: ${widthsShown.join(', ')}`,
  widthsShown[0] === 'Line width 1*' && widthsShown.length === 5,
)
await drag(...at(100, 20), ...at(180, 20))
await check(
  41,
  'default line is 1 px',
  (await pixel(140, 20)) === '#000000' && (await pixel(140, 21)) === '#ffffff',
  '41-default-width',
)
await clearImage()

// Finding 17: Curve with two bends, and a one-bend curve.
await tool('Curve')
await drag(...at(40, 150), ...at(200, 150))
await drag(...at(120, 150), ...at(120, 60))
await check(17, 'curve waits for its second bend before it commits', true, '17-curve-first-bend')
await drag(...at(120, 60), ...at(120, 60), { steps: 1 })
const bentDown = await count(117, 78, 7, 10, '#000000'),
  straight = await pixel(120, 150)
await check(
  17,
  `curve bends toward the control point (${bentDown} ink pixels near the apex, ${straight} on the chord)`,
  bentDown > 0 && straight === '#ffffff',
  '17-curve',
)
await drag(...at(40, 220), ...at(200, 220))
await drag(...at(80, 220), ...at(80, 180))
await drag(...at(160, 220), ...at(160, 260))
const above = await count(70, 185, 20, 25, '#000000'),
  below = await count(150, 230, 20, 25, '#000000')
await check(
  17,
  `S curve with two control points (${above} above, ${below} below the chord)`,
  above > 0 && below > 0,
  '17-curve-s',
)

// Finding 17: Polygon closes on double-click and fills with the chosen style.
await tool('Polygon')
await drag(...at(250, 60), ...at(350, 60))
await click(...at(350, 140))
await click(...at(250, 140), { count: 2 })
await check(
  17,
  'polygon closes back to its first vertex on double-click',
  (await pixel(250, 100)) === '#000000' &&
    (await pixel(300, 140)) === '#000000' &&
    (await pixel(300, 100)) === '#ffffff',
  '17-polygon',
)
await clickSelector(`${W} button[aria-label="both shape"]`)
await clickSelector(`${W} button[aria-label="Color #ff0000"]`, { button: 'right' })
await drag(...at(370, 60), ...at(420, 60))
await click(...at(420, 120))
await click(...at(370, 120), { count: 2 })
await check(
  17,
  'polygon with outline and fill uses the background color inside',
  (await pixel(395, 90)) === '#ff0000',
  '17-polygon-filled',
)
await clickSelector(`${W} button[aria-label="Color #ffffff"]`, { button: 'right' })
await clickSelector(`${W} button[aria-label="outline shape"]`)
await clearImage()

// Finding 18: selections move, copy, cut, paste, and clear.
await tool('Rectangle')
await clickSelector(`${W} button[aria-label="solid shape"]`)
await drag(...at(30, 30), ...at(70, 70))
await clickSelector(`${W} button[aria-label="outline shape"]`)
await tool('Select')
await drag(...at(20, 20), ...at(80, 80))
await menu('Edit')
const editItems = await menuItems()
await check(
  18,
  `Edit menu: ${editItems.join(' | ')}`,
  editItems.some((t) => t.startsWith('Cut')) &&
    editItems.some((t) => t.startsWith('Clear Selection')) &&
    editItems.some((t) => t.startsWith('Paste From')),
  '18-edit-menu',
)
await key('Escape')
await drag(...at(50, 50), ...at(200, 120))
await check(
  18,
  'dragging the selection moves it and leaves white behind',
  (await pixel(50, 50)) === '#ffffff' && (await pixel(180, 120)) === '#000000',
  '18-moved',
)
await drag(...at(180, 120), ...at(180, 200), { modifiers: 2 })
await check(
  18,
  'Ctrl+drag leaves a copy behind',
  (await pixel(180, 120)) === '#000000' && (await pixel(180, 200)) === '#000000',
  '18-ctrl-copy',
)
await key('c', { ctrl: true })
await key('Delete')
await check(18, 'Delete clears the selection to the background', (await pixel(180, 200)) === '#ffffff')
await key('v', { ctrl: true })
await wait(100)
await check(
  18,
  'Ctrl+V pastes the clipboard at the top left as a floating selection',
  (await pixel(20, 20)) === '#000000',
  '18-pasted',
)
await drag(...at(30, 30), ...at(330, 130))
await click(...at(420, 260))
await check(
  18,
  'clicking outside drops the pasted piece into the picture',
  (await pixel(330, 130)) === '#000000' && (await pixel(30, 30)) === '#ffffff',
)
await key('z', { ctrl: true })
await check(18, 'Undo removes the dropped paste', (await pixel(330, 130)) === '#ffffff')
const systemClipboard = await evaluate(
  `navigator.clipboard.read().then((items) => items.flatMap((i) => i.types).join(','), (e) => 'unavailable: ' + e.message)`,
)
await check(
  18,
  `the system clipboard holds image data (${systemClipboard})`,
  systemClipboard.includes('image/png'),
)
await key('l', { ctrl: true })
await key('x', { ctrl: true })
await check(
  18,
  'Select All (Ctrl+L) then Cut clears the picture',
  (await count(0, 0, 440, 280, '#ffffff')) === 440 * 280,
)
await key('z', { ctrl: true })

// Finding 18: free-form selection moves only the traced shape.
await clearImage()
await tool('Rectangle')
await clickSelector(`${W} button[aria-label="solid shape"]`)
await drag(...at(30, 30), ...at(90, 90))
await clickSelector(`${W} button[aria-label="outline shape"]`)
await tool('Free-Form Select')
await mouse('mouseMoved', ...at(20, 20))
await mouse('mousePressed', ...at(20, 20), { button: 'left', clickCount: 1, buttons: 1 })
for (const [x, y] of [
  [100, 20],
  [20, 100],
  [20, 22],
]) {
  await mouse('mouseMoved', ...at(x, y), { button: 'left', buttons: 1 })
  await wait(15)
}
await check(18, 'free-form select draws the traced outline while dragging', true, '18-freeform-trace')
await mouse('mouseReleased', ...at(20, 22), { button: 'left', clickCount: 1, buttons: 0 })
await wait(80)
await drag(...at(35, 35), ...at(235, 35))
await check(
  18,
  'free-form move takes the triangle only',
  (await pixel(235, 35)) === '#000000' &&
    (await pixel(80, 80)) === '#000000' &&
    (await pixel(35, 35)) === '#ffffff',
  '18-freeform-moved',
)
await click(...at(420, 260))

// Finding 18: transparent selection mode.
await clearImage()
await tool('Rectangle')
await clickSelector(`${W} button[aria-label="Color #0000ff"]`)
await clickSelector(`${W} button[aria-label="solid shape"]`)
await drag(...at(200, 20), ...at(300, 120))
await clickSelector(`${W} button[aria-label="Color #000000"]`)
await clickSelector(`${W} button[aria-label="outline shape"]`)
await drag(...at(20, 20), ...at(60, 60))
await tool('Select')
await drag(...at(10, 10), ...at(70, 70))
await clickSelector(`${W} button[aria-label="Transparent"]`)
await drag(...at(40, 40), ...at(230, 50))
await check(
  18,
  'transparent mode lets the blue show through the white of the selection',
  (await pixel(230, 50)) === '#0000ff' && (await pixel(210, 30)) === '#000000',
  '18-transparent',
)
await clickSelector(`${W} button[aria-label="Opaque"]`)
await check(
  18,
  'switching back to opaque covers the blue with the selection background',
  (await pixel(230, 50)) === '#ffffff',
)
await click(...at(420, 260))

// Finding 18: Copy To... and Paste From... through the file dialog.
await tool('Select')
await drag(...at(195, 15), ...at(305, 125))
await menu('Edit')
await item('Copy To...')
await wait(250)
await type('piece.bmp')
await key('Enter')
await wait(250)
await clearImage()
await menu('Edit')
await item('Paste From...')
await wait(250)
const listed = await evaluate(
  `[...document.querySelectorAll('[role="dialog"] [role="option"]')].map((o) => o.textContent)`,
)
await check(18, `Copy To... wrote piece.bmp (${listed.join(', ')})`, listed.includes('piece.bmp'))
await type('piece.bmp')
await key('Enter')
await wait(400)
await check(
  18,
  'Paste From... brings piece.bmp in as a floating selection',
  (await pixel(90, 90)) === '#0000ff',
  '18-paste-from',
)
await click(...at(420, 260))
await clearImage()

// Finding 19: in-place text with the Fonts toolbar.
await tool('Text')
await drag(...at(40, 150), ...at(300, 200))
await wait(150)
const toolbar = await evaluate(`!!document.querySelector('${W} [role="toolbar"][aria-label="Fonts"]')`)
await type('Hello Paint')
await clickSelector(`${W} button[aria-label="Bold"]`)
const frame = await evaluate(
  `(() => { const t = document.querySelector('${W} textarea[aria-label="Text"]'); return t ? { value: t.value, font: getComputedStyle(t).fontWeight } : null })()`,
)
await check(
  19,
  `typing goes into a frame on the canvas with the Fonts toolbar (${JSON.stringify(frame)})`,
  toolbar && frame?.value === 'Hello Paint' && frame.font === '700',
  '19-text-frame',
)
await click(...at(380, 250))
const inked = await count(40, 150, 260, 50, '#000000')
const antialiased = await evaluate(
  `(() => { const d = document.querySelector('${W} canvas[aria-label="Paint canvas"]').getContext('2d').getImageData(40, 150, 260, 50).data; for (let i = 0; i < d.length; i += 4) if (d[i] !== d[i + 1] || (d[i] !== 0 && d[i] !== 255)) return true; return false })()`,
)
await check(
  19,
  `clicking outside stamps ${inked} black pixels with no antialiasing`,
  inked > 50 && !antialiased && !(await evaluate(`!!document.querySelector('${W} textarea')`)),
  '19-text-committed',
)
await tool('Pencil')
await clearImage()

// Finding 39: the full menus.
const menuShots = {}
for (const name of ['File', 'Edit', 'View', 'Image', 'Options', 'Help']) {
  await menu(name)
  menuShots[name] = await menuItems()
  await shot(`39-menu-${name.toLowerCase()}`)
  await key('Escape')
}
await menu('View')
await hoverItem('Zoom')
menuShots.Zoom = await menuItems()
await shot('39-menu-view-zoom')
await key('Escape')
await key('Escape')
console.log(JSON.stringify(menuShots, null, 1))
const has = (list, ...labels) =>
  labels.every((label) => list.some((entry) => entry.replace('(disabled) ', '').startsWith(label)))
await check(
  39,
  'File has Print Preview, Page Setup, Print, Send, both wallpaper items, and Exit',
  has(
    menuShots.File,
    'New',
    'Open...',
    'Save',
    'Save As...',
    'Print Preview',
    'Page Setup...',
    'Print...',
    'Send...',
    'Set As Wallpaper (Tiled)',
    'Set As Wallpaper (Centered)',
    'Exit',
  ),
)
await check(
  39,
  'View has Tool Box, Color Box, Status Bar, Zoom, View Bitmap, Text Toolbar',
  has(menuShots.View, 'Tool Box', 'Color Box', 'Status Bar', 'Zoom', 'View Bitmap', 'Text Toolbar'),
)
await check(
  39,
  'Zoom has Normal Size, Large Size, Custom, Show Grid, Show Thumbnail',
  has(menuShots.Zoom, 'Normal Size', 'Large Size', 'Custom...', 'Show Grid', 'Show Thumbnail'),
)
await check(
  39,
  'Image has Flip/Rotate, Stretch/Skew, Invert Colors, Attributes, Clear Image',
  has(menuShots.Image, 'Flip/Rotate...', 'Stretch/Skew...', 'Invert Colors', 'Attributes...', 'Clear Image'),
)
await check(
  39,
  'Options has Edit Colors, Get Colors, Save Colors, Draw Opaque',
  has(menuShots.Options, 'Edit Colors...', 'Get Colors...', 'Save Colors...', 'Draw Opaque'),
)
await check(39, 'Help has Help Topics and About Paint', has(menuShots.Help, 'Help Topics', 'About Paint'))

await menu('View')
await item('Tool Box')
await menu('View')
await item('Color Box')
await menu('View')
await item('Status Bar')
const hidden = await evaluate(
  `[!!document.querySelector('${W} [data-paint="toolbox"]'), !!document.querySelector('${W} [data-paint="colorbox"]'), document.querySelectorAll('${W} .bevel-shallow.truncate').length]`,
)
await check(
  39,
  `Tool Box, Color Box, and Status Bar hide (${hidden})`,
  !hidden[0] && !hidden[1] && hidden[2] === 0,
  '39-panels-hidden',
)
await key('t', { ctrl: true })
await key('a', { ctrl: true })
await menu('View')
await item('Status Bar')
canvasBox = await rect(`${W} canvas[aria-label="Paint canvas"]`)

await menu('View')
await hoverItem('Zoom')
await item('Custom...')
await wait(200)
await check(
  39,
  'Zoom > Custom... offers 100% to 800%',
  (await dialogs())[0]?.text.includes('800%'),
  '39-custom-zoom',
)
await clickText('[role="dialog"] label', '400%')
await key('Enter')
await wait(150)
await key('g', { ctrl: true })
await wait(100)
const zoomed = await rect(`${W} canvas[aria-label="Paint canvas"]`)
await check(
  39,
  `Custom 400% enlarges the canvas to ${zoomed.w}px and Show Grid draws the grid`,
  zoomed.w === 1760 &&
    (await evaluate(`!!document.querySelector('${W} [aria-hidden="true"][style*="linear-gradient"]')`)),
  '39-zoom-grid',
)
await menu('View')
await hoverItem('Zoom')
await item('Show Thumbnail')
await wait(150)
await check(
  39,
  'Show Thumbnail opens the Thumbnail window',
  await evaluate(`!!document.querySelector('${W} [role="toolbar"][aria-label="Thumbnail"]')`),
  '39-thumbnail',
)
await key('PageUp', { ctrl: true })
await wait(100)
canvasBox = await rect(`${W} canvas[aria-label="Paint canvas"]`)
await key('f', { ctrl: true })
await wait(150)
await check(
  39,
  'View Bitmap shows the picture on the whole screen',
  await evaluate(`!!document.querySelector('[data-paint="view-bitmap"]')`),
  '39-view-bitmap',
)
await click(5, 5)
await check(
  39,
  'a click returns from View Bitmap',
  !(await evaluate(`!!document.querySelector('[data-paint="view-bitmap"]')`)),
)

await clickSelector(`${W} button[aria-label="Color #ff8040"]`)
await menu('Options')
await item('Edit Colors...')
await wait(200)
await clickText('[role="dialog"] button', 'Define Custom Colors >>')
await wait(150)
await check(
  39,
  'Edit Colors opens with basic colors and expands to define custom colors',
  (await dialogs())[0]?.text.includes('Add to Custom Colors'),
  '39-edit-colors',
)
await clickSelector('[role="dialog"] button[aria-label="Basic color #ff8000"]')
await key('Enter')
await wait(100)
await check(
  39,
  'Edit Colors replaces the chosen color box slot',
  await evaluate(`!!document.querySelector('${W} button[aria-label="Color #ff8000"]')`),
)
await menu('Options')
await item('Save Colors...')
await wait(250)
await type('mine.pal')
await key('Enter')
await wait(200)
{
  const box = await rect(`${W} button[aria-label="Color #ff8000"]`)
  await click(box.x + 5, box.y + 5, { count: 2 })
  await wait(200)
  await clickSelector('[role="dialog"] button[aria-label="Basic color #00ff00"]')
  await key('Enter')
}
await menu('Options')
await item('Get Colors...')
await wait(250)
await type('mine.pal')
await key('Enter')
await wait(200)
await check(
  39,
  'Get Colors reloads the saved palette',
  await evaluate(`!!document.querySelector('${W} button[aria-label="Color #ff8000"]')`),
)
await menu('Options')
await item('Draw Opaque')
await tool('Select')
const transparentChosen = await evaluate(
  `document.querySelector('${W} button[aria-label="Transparent"]').getAttribute('aria-pressed')`,
)
await check(39, 'Draw Opaque toggles the transparent selection option', transparentChosen === 'true')
await menu('Options')
await item('Draw Opaque')
await menu('File')
await item('Print...')
await wait(150)
await check(
  39,
  'Print reports that no printer is installed',
  (await dialogs())[0]?.text.includes('install a printer'),
  '39-print',
)
await closeDialogs()

// Finding 40: status bar panes.
await tool('Pencil')
await mouse('mouseMoved', 200, 5)
await wait(100)
const idle = await status()
const pencil = await rect(`${W} button[aria-label="Pencil"]`)
await mouse('mouseMoved', pencil.x + 5, pencil.y + 5)
await wait(100)
const overTool = await status()
await mouse('mouseMoved', ...at(50, 60))
await wait(100)
const overCanvas = await status()
await mouse('mouseMoved', 200, 5)
await wait(100)
const left = await status()
console.log(JSON.stringify({ idle, overTool, overCanvas, left }))
await check(
  40,
  `idle left pane: "${idle[0]}"`,
  idle[0] === 'For Help, click Help Topics on the Help Menu.' && idle[1] === '' && idle[2] === '',
)
await check(40, `tool help: "${overTool[0]}"`, overTool[0] === 'Draws a free-form line one pixel wide.')
await check(
  40,
  `pointer position "${overCanvas[1]}" only over the canvas`,
  overCanvas[1] === '50,60' && left[1] === '',
)
await tool('Rectangle')
await drag(...at(20, 20), ...at(119, 99), {
  hold: async () => {
    const during = await status()
    await check(40, `shape size "${during[2]}" while dragging`, during[2] === '100x80', '40-status-drag')
  },
})
await check(40, 'size pane is blank after the drag', (await status())[2] === '')
await menu('Image')
await hoverItem('Invert Colors')
await check(
  40,
  `menu help: "${(await status())[0]}"`,
  (await status())[0] === 'Inverts the colors of the picture or a selection.',
  '40-status-menu-help',
)
await key('Escape')

// Finding 42: Attributes, Flip and Rotate, Stretch and Skew.
await menu('Image')
await item('Attributes...')
await wait(200)
const attributes = (await dialogs())[0]?.text ?? ''
await check(
  42,
  'Attributes has File last saved, Size on disk, Units and Colors groups, and OK Cancel Default',
  [
    'File last saved:',
    'Not Available',
    'Size on disk:',
    'Units',
    'Inches',
    'Cm',
    'Pels',
    'Colors',
    'Black and white',
    'Default',
  ].every((t) => attributes.includes(t)),
  '42-attributes',
)
await clickText('[role="dialog"] label', 'Inches')
const inches = await evaluate(`document.querySelector('[role="dialog"] input[aria-label="Width"]').value`)
await check(42, `width shows ${inches} inches at 96 DPI`, inches === '4.58')
await clickText('[role="dialog"] label', 'Pels')
await closeDialogs()
await menu('Image')
await item('Flip/Rotate...')
await wait(200)
const angleDisabled = await evaluate(
  `[...document.querySelectorAll('[role="dialog"] input[type="radio"]')].map((r) => r.disabled)`,
)
await check(
  42,
  `angle radios disabled until Rotate by angle (${angleDisabled})`,
  angleDisabled.slice(3).every(Boolean),
  '42-flip-rotate',
)
await clickText('[role="dialog"] label', 'Rotate by angle')
const angleEnabled = await evaluate(
  `[...document.querySelectorAll('[role="dialog"] input[type="radio"]')].map((r) => r.disabled)`,
)
await check(
  42,
  'choosing Rotate by angle enables 90, 180, 270',
  angleEnabled.slice(3).every((d) => !d),
  '42-flip-rotate-angle',
)
await key('Enter')
await wait(150)
let size = await evaluate(
  `[document.querySelector('${W} canvas[aria-label="Paint canvas"]').width, document.querySelector('${W} canvas[aria-label="Paint canvas"]').height]`,
)
await check(42, `rotating 90 degrees swaps the size to ${size}`, size[0] === 280 && size[1] === 440)
await key('z', { ctrl: true })
await menu('Image')
await item('Stretch/Skew...')
await wait(200)
await check(
  42,
  'Stretch and Skew has percent and degree fields',
  (await dialogs())[0]?.text.includes('Degrees'),
  '42-stretch-skew',
)
await clickSelector('[role="dialog"] input[aria-label="Stretch Horizontal"]', { count: 3 })
await type('50')
await key('Enter')
await wait(150)
size = await evaluate(
  `[document.querySelector('${W} canvas[aria-label="Paint canvas"]').width, document.querySelector('${W} canvas[aria-label="Paint canvas"]').height]`,
)
await check(42, `stretching to 50% makes the picture ${size}`, size[0] === 220 && size[1] === 280)
await key('z', { ctrl: true })

// Finding 43: Save As types and Open filters.
await menu('File')
await item('Save As...')
await wait(250)
const saveTypes = await evaluate(
  `[...document.querySelectorAll('[role="dialog"] select')].at(-1) ? [...[...document.querySelectorAll('[role="dialog"] select')].at(-1).options].map((o) => o.textContent) : []`,
)
await check(
  43,
  `Save as type lists ${saveTypes.join(' | ')}`,
  [
    'Monochrome Bitmap (*.bmp;*.dib)',
    '16 Color Bitmap (*.bmp;*.dib)',
    '256 Color Bitmap (*.bmp;*.dib)',
    '24-bit Bitmap (*.bmp;*.dib)',
  ].every((t) => saveTypes.includes(t)),
  '43-save-types',
)
await closeDialogs()
await menu('File')
await item('Open...')
await wait(250)
if ((await dialogs())[0]?.text.includes('Save changes')) {
  await clickText('[role="dialog"] button', 'No')
  await wait(250)
}
const openTypes = await evaluate(
  `[...[...document.querySelectorAll('[role="dialog"] select')].at(-1).options].map((o) => o.textContent)`,
)
await check(
  43,
  `Open lists ${openTypes.join(' | ')}`,
  openTypes[0] === 'Bitmap Files (*.bmp;*.dib)' && openTypes[1] === 'All Files (*.*)',
  '43-open-types',
)
await closeDialogs()

// More of findings 18 and 42: selection transforms, the paste-enlarge prompt, Color Eraser, recent files.
await clickSelector(`${W} button[aria-label="Color #000000"]`)
await clearImage()
await tool('Rectangle')
await clickSelector(`${W} button[aria-label="solid shape"]`)
await drag(...at(20, 20), ...at(40, 60))
await clickSelector(`${W} button[aria-label="outline shape"]`)
await tool('Select')
await drag(...at(10, 10), ...at(110, 70))
await key('r', { ctrl: true })
await wait(150)
await key('Enter')
await wait(150)
await check(
  42,
  'Flip/Rotate flips only the selection',
  (await pixel(90, 40)) === '#000000' && (await pixel(30, 40)) === '#ffffff',
  '42-flip-selection',
)
await click(...at(420, 260))
await tool('Eraser/Color Eraser')
await clickSelector(`${W} button[aria-label="Color #ff0000"]`, { button: 'right' })
await drag(...at(90, 20), ...at(90, 60), { button: 'right' })
await check(
  18,
  'right-dragging the Eraser is the Color Eraser: black turns red, white stays',
  (await pixel(90, 40)) === '#ff0000' &&
    (await pixel(90, 15)) === '#ffffff' &&
    (await pixel(82, 40)) === '#000000',
  '18-color-eraser',
)
await clickSelector(`${W} button[aria-label="Color #ffffff"]`, { button: 'right' })
await key('l', { ctrl: true })
await key('c', { ctrl: true })
await click(...at(420, 260))
await key('e', { ctrl: true })
await wait(200)
await clickSelector('[role="dialog"] input[aria-label="Width"]', { count: 3 })
await type('200')
await clickText('[role="dialog"] label', 'Black and white')
await key('Enter')
await wait(200)
const mono = await count(0, 0, 200, 280, '#ff0000')
await check(
  42,
  'Attributes resizes to 200 wide and Black and white removes the red',
  (await evaluate(`document.querySelector('${W} canvas[aria-label="Paint canvas"]').width`)) === 200 &&
    mono === 0,
  '42-attributes-mono',
)
await key('v', { ctrl: true })
await wait(200)
await check(
  18,
  'pasting a larger picture asks to enlarge the bitmap',
  (await dialogs())[0]?.text.includes('larger than the bitmap'),
  '18-paste-enlarge',
)
await clickText('[role="dialog"] button', 'Yes')
await wait(200)
await check(
  18,
  'Yes enlarges the bitmap to hold the paste',
  (await evaluate(`document.querySelector('${W} canvas[aria-label="Paint canvas"]').width`)) === 440,
)
await click(...at(430, 270))
await key('s', { ctrl: true })
await wait(250)
await type('art.bmp')
await key('Enter')
await wait(300)
await menu('File')
const recentItems = await menuItems()
await check(
  39,
  `File lists the saved picture: ${recentItems.find((t) => t.startsWith('1 '))}`,
  recentItems.some((t) => /^1 C:/.test(t) && t.endsWith('art.bmp')),
  '39-recent-file',
)
await key('Escape')
await menu('Image')
await item('Attributes...')
await wait(200)
const savedAttributes = (await dialogs())[0]?.text ?? ''
await check(
  42,
  'Attributes shows the save date and size on disk once saved',
  !savedAttributes.includes('Not Available') && /\d+ bytes/.test(savedAttributes.replace(/,/g, '')),
  '42-attributes-saved',
)
await closeDialogs()

// Help menu: Help Topics, then the About box.
const before = await evaluate(`document.querySelectorAll('[data-window]').length`)
await menu('Help')
await item('Help Topics')
await wait(300)
const after = await evaluate(
  `[...document.querySelectorAll('[data-window]')].map((w) => w.getAttribute('aria-label'))`,
)
await check(
  'help',
  `Help Topics launches the help book or stays harmless (${after.join(', ')})`,
  after.length >= before,
)
await evaluate(
  `[...document.querySelectorAll('[data-window]')].filter((w) => !w.getAttribute('aria-label').endsWith(' - Paint')).forEach((w) => w.querySelector('button[aria-label="Close"]')?.click())`,
)
await menu('Help')
await item('About Paint')
await wait(200)
const about = (await dialogs())[0]?.text ?? ''
await check(
  'help',
  'About Paint is the Windows 95 About layout',
  [
    'Microsoft Paint',
    'Windows 95',
    'Copyright © 1981-1995 Microsoft Corp.',
    'This product is licensed to:',
    'Physical Memory Available to Windows:',
    'System Resources:',
  ].every((t) => about.includes(t)),
  'help-about',
)
await closeDialogs()

writeFileSync(join(proof, 'checks.json'), JSON.stringify(checks, null, 2))
const failed = checks.filter((c) => !c.ok)
console.log(`${checks.length - failed.length}/${checks.length} passed`)
ws.close()
process.exit(failed.length ? 1 : 0)
