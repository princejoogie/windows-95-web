// Live proof for wiring unit W-B. Run against a fresh app:
//   W95_CDP_PORT=9391 W95_DATA_DIR=D:/tmp/wire-b-data bash scripts/verify/relaunch.sh --fresh
//   node scripts/verify/wire-b.mjs <phase>
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const port = Number(process.env.W95_CDP_PORT ?? 9391)
const proof = resolve(process.env.W95_PROOF_DIR ?? '../proof/wire-b')
mkdirSync(proof, { recursive: true })
const phase = process.argv[2] ?? 'all'
const innerWidthGuess = 1024
const app = await connect(port)
const results = []

function check(condition, item, name, detail) {
  assert.ok(condition, `${item}: ${name}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`)
  results.push({ item, name, detail })
  process.stdout.write(`PASS [${item}] ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}\n`)
}
const q = (value) => JSON.stringify(value)
const shot = (name, clip) => app.shot(join(proof, `${name}.png`), clip)
const exists = (selector) => app.eval(`!!document.querySelector(${q(selector)})`)
const dialog = (title) => `document.querySelector('[role="dialog"][aria-label=${q(title)}]')`
const dialogBox = (title, pad = 4) =>
  app.eval(
    `(()=>{const b=${dialog(title)}.getBoundingClientRect();return {x:b.x-${pad},y:b.y-${pad},width:b.width+${pad * 2},height:b.height+${pad * 2}}})()`,
  )
const buttonIn = (title, label) =>
  `[...${dialog(title)}.querySelectorAll('button')].find(b => b.textContent.trim() === ${q(label)} || b.getAttribute('aria-label') === ${q(label)})`
const menuItem = (label) =>
  `[...document.querySelectorAll('[role="menuitem"]')].find(e => e.textContent.replace(/\\s+/g,' ').trim().startsWith(${q(label)}))`
const topWindow = `[...document.querySelectorAll('[data-window]')].sort((a, b) => (Number(b.style.zIndex) || 0) - (Number(a.style.zIndex) || 0))[0]`
const centerOf = (expression) =>
  app.eval(`(()=>{const b=(${expression}).getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`)
async function clickExpr(expression, options) {
  await app.waitFor(`!!(${expression})`)
  const [x, y] = await centerOf(expression)
  await app.click(x, y, options)
}
async function drag(from, to, steps = 12) {
  const at = (type, [x, y], buttons) =>
    app.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 })
  await at('mouseMoved', from, 0)
  await at('mousePressed', from, 1)
  for (let i = 1; i <= steps; i++)
    await at(
      'mouseMoved',
      [from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps],
      1,
    )
  await at('mouseReleased', to, 0)
  await sleep(150)
}
const pickMenu = (label) => clickExpr(menuItem(label))
async function openStartItem(label) {
  await app.clickOn('[data-start-button]')
  await pickMenu(label)
}
async function closeWindows() {
  for (let i = 0; i < 8; i++) {
    if (!(await exists('[data-window] button[aria-label="Close"]'))) return
    await app.clickOn('[data-window] button[aria-label="Close"]')
    await sleep(200)
    for (const label of ['No', "Don't Save"]) {
      const no = `[...document.querySelectorAll('[role="dialog"] button')].find(b => b.textContent.trim() === ${q(label)})`
      if (await app.eval(`!!(${no})`)) await clickExpr(no)
    }
  }
}
async function run(command) {
  await openStartItem('Run...')
  await app.waitFor(`!!document.querySelector('#run-command')`)
  await app.key('a', ['Control'])
  await app.type(command)
  await app.key('Enter')
  await sleep(400)
}
const comboText = (title, label) =>
  app.eval(
    `[...${dialog(title)}.querySelectorAll('[role="combobox"]')].find(c => c.id && ${dialog(title)}.querySelector('label[for="'+c.id+'"]')?.textContent.replace(/\\s+/g,' ').trim() === ${q(label)})?.textContent.trim()`,
  )

async function fileDialog() {
  await openStartItem('Run...')
  await clickExpr(buttonIn('Run', 'Browse...'))
  await app.waitFor(`!!${dialog('Browse')}`)
  check(
    await app.eval(`${dialog('Browse')}.querySelectorAll('[role="combobox"]').length === 2`),
    '1c',
    "Run's Browse is the common dialog, with Look in and Files of type combo boxes",
  )
  const lookIn = await comboText('Browse', 'Look in:')
  const type = await comboText('Browse', 'Files of type:')
  check(lookIn === 'WINDOWS' && type === 'Programs', '1c', 'Browse starts in WINDOWS on Programs', [
    lookIn,
    type,
  ])
  const listed = () =>
    app.eval(`[...${dialog('Browse')}.querySelectorAll('[role="option"]')].map(o => o.textContent.trim())`)
  const programs = await listed()
  check(
    programs.includes('CALC.EXE') &&
      programs.includes('NOTEPAD.EXE') &&
      !programs.some((n) => /\.(ini|txt)$/i.test(n)),
    '1c',
    'Programs lists installed program nodes and no documents',
    programs,
  )
  await shot('1c-run-browse-programs', await dialogBox('Browse'))

  await clickExpr(buttonIn('Browse', 'Help'))
  check(await exists('[data-whats-this]'), '1b', "the caption ? arms What's This")
  const [nx, ny] = await centerOf(`${dialog('Browse')}.querySelector('input')`)
  await app.click(nx, ny)
  await app.waitFor(`!!document.querySelector('[role="tooltip"]')`)
  const popup = await app.eval(`document.querySelector('[role="tooltip"]').textContent`)
  check(
    popup === 'Type or select the name of the file you want to open.' && !(await exists('[data-whats-this]')),
    '1b',
    'clicking File name shows its help popup instead of focusing it',
    popup,
  )
  await shot('1b-whats-this-popup')
  await app.key('Escape')
  check(
    !(await exists('[role="tooltip"]')) && (await app.eval(`!!${dialog('Browse')}`)),
    '1b',
    'Esc dismisses the popup and leaves the dialog open',
  )

  const calc = `[...${dialog('Browse')}.querySelectorAll('[role="option"]')].find(o => o.textContent.trim() === 'CALC.EXE')`
  await clickExpr(calc)
  await clickExpr(buttonIn('Browse', 'Open'))
  const command = await app.eval(`document.querySelector('#run-command').value`)
  check(command === 'C:\\WINDOWS\\CALC.EXE', '1c', 'picking CALC.EXE fills Run with its path', command)
  const focused = await app.eval('document.activeElement.textContent.trim()')
  check(focused === 'OK', '1c', 'focus lands on OK after Browse, so Enter runs it', focused)
  await app.key('Enter')
  await app.waitFor(
    `[...document.querySelectorAll('[data-window]')].some(w => w.textContent.includes('Calculator'))`,
  )
  check(true, '1c', 'OK runs the program picked in Browse')
  await closeWindows()

  await run('mspaint')
  await app.waitFor(`!!document.querySelector('[data-window]')`)
  const openSaveAs = async () => {
    await clickExpr(
      `[...document.querySelectorAll('[data-window] [role="menubar"] *')].find(e => e.textContent.trim() === 'File')`,
    )
    await pickMenu('Save As...')
    await app.waitFor(`!!${dialog('Save As')}`)
  }
  await openSaveAs()
  const initial = await comboText('Save As', 'Save as type:')
  check(initial === '24-bit Bitmap (*.bmp;*.dib)', '1a', 'Paint opens Save As on its current depth', initial)
  const typeCombo = `${dialog('Save As')}.querySelectorAll('[role="combobox"]')[1]`
  await clickExpr(typeCombo)
  const order = await app.eval(
    `[...document.querySelectorAll('[role="listbox"] [role="option"]')].map(o => o.textContent.trim()).filter(t => t.includes('Bitmap'))`,
  )
  check(
    order.join('|') ===
      'Monochrome Bitmap (*.bmp;*.dib)|16 Color Bitmap (*.bmp;*.dib)|256 Color Bitmap (*.bmp;*.dib)|24-bit Bitmap (*.bmp;*.dib)',
    '1a',
    'Save as type lists the depths in Windows order',
    order,
  )
  await shot('1a-paint-save-as-types', await dialogBox('Save As', 60))
  await clickExpr(
    `[...document.querySelectorAll('[role="option"]')].find(o => o.textContent.trim().startsWith('Monochrome'))`,
  )
  const name = `${dialog('Save As')}.querySelector('input')`
  await clickExpr(name)
  await app.key('a', ['Control'])
  await app.type('mono')
  await app.key('Enter')
  await app.waitFor(`!${dialog('Save As')}`)
  const title = await app.eval(`document.querySelector('[data-window]').textContent`)
  check(title.includes('mono'), '1a', 'Paint saved under the typed name', title.slice(0, 40))
  await openSaveAs()
  const after = await comboText('Save As', 'Save as type:')
  check(
    after === 'Monochrome Bitmap (*.bmp;*.dib)',
    '1a',
    'the chosen type reached Paint, which now saves 1-bit',
    after,
  )
  await app.key('Escape')
  await closeWindows()
}

async function openMenu(menu, item) {
  await clickExpr(
    `[...${topWindow}.querySelectorAll('[role="menubar"] *')].find(e => e.textContent.trim() === ${q(menu)})`,
  )
  await pickMenu(item)
}

async function dialogs() {
  await closeWindows()
  await run('notepad')
  await app.waitFor(`!!document.querySelector('[data-window] textarea')`)
  await openMenu('File', 'Open...')
  await app.waitFor(`!!${dialog('Open')}`)
  await clickExpr(buttonIn('Open', 'Cancel'))
  await app.waitFor(`!${dialog('Open')}`)
  const focus = await app.eval(`document.activeElement.tagName`)
  check(focus === 'TEXTAREA', '2', 'Cancel on Open gives focus back to the Notepad text, not the body', focus)
  await openMenu('File', 'Open...')
  await app.waitFor(`!!${dialog('Open')}`)
  await app.key('Escape')
  await app.waitFor(`!${dialog('Open')}`)
  check(
    (await app.eval(`document.activeElement.tagName`)) === 'TEXTAREA',
    '2',
    'Esc restores focus the same way',
  )
  await closeWindows()

  await run('winmine')
  await app.waitFor(`!!document.querySelector('[data-window]')`)
  const caption = await app.eval(
    `(()=>{const b=document.querySelector('[data-window] [data-caption], [data-window] .bg-title, [data-window] .bg-title-inactive').getBoundingClientRect();return [b.x+20,b.y+8]})()`,
  )
  await drag(caption, [innerWidthGuess - 40, 690])
  const game = `[...${topWindow}.querySelectorAll('[role="menubar"] button')].find(e => e.textContent.trim() === 'Game')`
  await clickExpr(game)
  await app.waitFor(`!!document.querySelector('[role="menu"]')`)
  const flip = await app.eval(
    `(()=>{const m=document.querySelector('[role="menu"]').getBoundingClientRect(),b=(${game}).getBoundingClientRect();return {menuBottom:m.bottom,menuTop:m.top,barTop:b.top}})()`,
  )
  check(
    flip.menuBottom <= flip.barTop && flip.menuTop >= 0,
    '2',
    'a menu with no room below opens above its title instead of under the pointer',
    flip,
  )
  await shot('2-menu-opens-upward', { x: 700, y: 400, width: 324, height: 368 })
  await pickMenu('Custom...')
  await app.waitFor(`!!${dialog('Custom Field')}`)
  const placed = await app.eval(
    `(()=>{const b=${dialog('Custom Field')}.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,w:innerWidth,h:innerHeight}})()`,
  )
  check(
    placed.left >= 4 &&
      placed.right <= placed.w - 4 &&
      placed.bottom <= placed.h - 28 &&
      Number.isInteger(placed.left),
    '2',
    'Minesweeper Custom Field, from a window dragged to the corner, stays on screen on whole pixels',
    placed,
  )
  await shot('2-minesweeper-custom-clamped')
  await app.send('Emulation.setDeviceMetricsOverride', {
    width: 800,
    height: 600,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await sleep(300)
  const resized = await app.eval(
    `(()=>{const b=${dialog('Custom Field')}.getBoundingClientRect();return {right:b.right,bottom:b.bottom,w:innerWidth,h:innerHeight}})()`,
  )
  await shot('2-minesweeper-custom-after-resize')
  await app.send('Emulation.clearDeviceMetricsOverride')
  await sleep(300)
  check(
    resized.w === 800 && resized.right <= 796 && resized.bottom <= 572,
    '2',
    'shrinking the screen moves the open dialog back on screen',
    resized,
  )
  await app.key('Escape')
  await closeWindows()
}

const ABOUT = [
  ['notepad', 'About Notepad', 'Microsoft Notepad'],
  ['calc', 'About Calculator', 'Microsoft Calculator'],
  ['mspaint', 'About Paint', 'Microsoft Paint'],
  ['wordpad', 'About WordPad', 'Microsoft WordPad'],
  ['winmine', 'About Minesweeper', 'Microsoft Minesweeper', 'by Robert Donner and Curt Johnson'],
  ['sol', 'About Solitaire', 'Microsoft Solitaire', 'by Wes Cherry'],
  ['freecell', 'About FreeCell...', 'Microsoft FreeCell', 'by Jim Horne'],
  ['explorer', 'About Windows 95', 'Microsoft Windows 95'],
  ['nethood', 'About Windows 95', 'Microsoft Windows 95'],
  ['find', 'About Windows', 'Microsoft Windows 95'],
  ['winhlp32', 'About Windows Help', 'Microsoft Windows Help'],
  ['command', 'About MS-DOS Prompt', 'Microsoft MS-DOS Prompt'],
]

const treeItem = (index) => `[...${topWindow}.querySelectorAll('[role="treeitem"]')][${index}]`
const openAbout = {
  async winhlp32() {
    await clickExpr(treeItem(0), { count: 2 })
    await app.waitFor(`${topWindow}.querySelectorAll('[role="treeitem"]').length > 4`)
    await clickExpr(treeItem(1), { count: 2 })
    await clickExpr(
      `[...${topWindow}.querySelectorAll('button')].find(b => b.textContent.trim() === 'Options')`,
    )
    await pickMenu('About Windows Help')
  },
  async command() {
    const [x, y] = await centerOf(topWindow)
    await app.click(x, y + 40, { button: 'right' })
    await pickMenu('About MS-DOS Prompt')
  },
}

async function about() {
  await closeWindows()
  for (const [exe, item, product, credit] of ABOUT) {
    await run(exe)
    await app.waitFor(`!!document.querySelector('[data-window]')`)
    await sleep(300)
    await (openAbout[exe] ?? (() => openMenu('Help', item)))()
    const title = item.replace('...', '')
    await app.waitFor(`!!${dialog(title)}`)
    const lines = await app.eval(`[...${dialog(title)}.querySelectorAll('p')].map(p => p.textContent.trim())`)
    const focused = await app.eval(`document.activeElement.textContent.trim()`)
    check(
      lines[0] === product &&
        lines[1] === 'Windows 95' &&
        lines[2] === 'Copyright © 1981-1995 Microsoft Corp.' &&
        (credit ? lines[3] === credit : lines[3] === 'This product is licensed to:') &&
        focused === 'OK',
      '3a',
      `${exe}: ${title} is the shared About box with OK focused`,
      lines.slice(0, credit ? 4 : 3),
    )
    if (exe === 'mspaint' || exe === 'winmine') await shot(`3a-about-${exe}`, await dialogBox(title))
    await app.key('Enter')
    await app.waitFor(`!${dialog(title)}`)
    await closeWindows()
  }
}

const selectedTab = (title) =>
  app.eval(`${dialog(title)}.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim()`)
const statusText = () =>
  app.eval(
    `[...${topWindow}.querySelectorAll('*')].filter(e => e.children.length === 0 && /For Help|Opens|Creates|Saves/.test(e.textContent)).map(e => e.textContent.trim())[0] ?? null`,
  )

async function kit() {
  await closeWindows()
  await app.click(600, 755, { button: 'right' })
  await pickMenu('Properties')
  await app.waitFor(`!!${dialog('Taskbar Properties')}`)
  check(
    (await selectedTab('Taskbar Properties')) === 'Taskbar Options',
    '3b',
    'Taskbar Properties opens on its first tab',
  )
  await clickExpr(`${dialog('Taskbar Properties')}.querySelector('input[type="checkbox"]')`)
  await app.key('Tab', ['Control'])
  check(
    (await selectedTab('Taskbar Properties')) === 'Start Menu Programs',
    '3b',
    'Ctrl+Tab from a control on the page turns to the next tab',
  )
  await shot('3b-taskbar-tabs', await dialogBox('Taskbar Properties'))
  await clickExpr(`${dialog('Taskbar Properties')}.querySelector('[role="tab"][aria-selected="true"]')`)
  await app.key('ArrowLeft')
  const back = await selectedTab('Taskbar Properties')
  const focusedTab = await app.eval(
    `document.activeElement.getAttribute('role') + ':' + document.activeElement.textContent.trim()`,
  )
  check(
    back === 'Taskbar Options' && focusedTab === 'tab:Taskbar Options',
    '3b',
    'Left Arrow on a tab selects and focuses the previous tab',
    focusedTab,
  )
  await app.key('Escape')

  await run('find')
  await app.waitFor(`!!${topWindow}.querySelector('[role="tab"]')`)
  const findTabs = await app.eval(
    `[...${topWindow}.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim() + (t.getAttribute('aria-selected') === 'true' ? '*' : ''))`,
  )
  check(
    findTabs.join('|') === 'Name & Location*|Date Modified|Advanced',
    '3b',
    'Find uses the shared property-sheet tabs',
    findTabs,
  )
  await shot(
    '3b-find-tabs',
    await app.eval(
      `(()=>{const b=(${topWindow}).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:Math.min(b.height,260)}})()`,
    ),
  )
  await closeWindows()

  await run('mspaint')
  await app.waitFor(`!!document.querySelector('[data-window]')`)
  const idle = await statusText()
  await app.key('f', ['Alt'])
  await app.waitFor(`!!document.querySelector('[role="menu"]')`)
  const onNew = await statusText()
  await app.key('ArrowDown')
  const onOpen = await statusText()
  await shot(
    '3c-paint-menu-help',
    await app.eval(
      `(()=>{const b=(${topWindow}).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})()`,
    ),
  )
  await app.key('Escape')
  await app.key('Escape')
  await sleep(100)
  const after = await statusText()
  check(
    idle === 'For Help, click Help Topics on the Help Menu.' &&
      onNew === 'Creates a new document.' &&
      onOpen === 'Opens an existing document.' &&
      after === idle,
    '3c',
    'Paint status bar follows the keyboard-highlighted menu item and returns to idle',
    [idle, onNew, onOpen, after],
  )
  await closeWindows()
}

async function systemMenu() {
  await closeWindows()
  await run('winmine')
  await app.waitFor(`!!document.querySelector('[data-window] [aria-label*="minefield"]')`)
  await clickExpr(`document.querySelector('[data-window] [aria-label^="Row 5, column 5"]')`)
  const opened = await app.eval(
    `[...document.querySelectorAll('[data-window] [aria-label^="Row "]')].filter(c => !c.getAttribute('aria-label').endsWith('hidden')).length`,
  )
  await app.key(' ', ['Alt'])
  await app.waitFor(`!!document.querySelector('[role="menu"]')`)
  const entries = await app.eval(
    `[...document.querySelector('[role="menu"]').querySelectorAll('[role="menuitem"]')].map(m => m.textContent.replace('Alt+F4','').trim() + (m.getAttribute('aria-disabled') === 'true' ? '~' : ''))`,
  )
  check(
    entries.join('|') === 'Restore~|Move|Size~|Minimize|Maximize~|Close',
    'G1',
    'Alt+Space opens the system menu with Size and Maximize disabled on the fixed window',
    entries,
  )
  await shot(
    'g1-system-menu-open',
    await app.eval(
      `(()=>{const b=(${topWindow}).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width+60,height:b.height}})()`,
    ),
  )
  await app.key('Escape')
  await sleep(150)
  const after = await app.eval(
    `({ menus: document.querySelectorAll('[role="menu"]').length, armed: [...document.querySelectorAll('[role="menubar"] button')].some(b => /bg-select|bevel-shallow/.test(b.className)) })`,
  )
  check(
    after.menus === 0 && !after.armed,
    'G1',
    'Escape closes the system menu and leaves no menu bar armed',
    after,
  )
  await shot(
    'g1-system-menu-after-escape',
    await app.eval(
      `(()=>{const b=(${topWindow}).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width+60,height:b.height}})()`,
    ),
  )
  await app.key('F2')
  await sleep(150)
  const reset = await app.eval(
    `[...document.querySelectorAll('[data-window] [aria-label^="Row "]')].filter(c => !c.getAttribute('aria-label').endsWith('hidden')).length`,
  )
  check(
    opened > 0 && reset === 0,
    'G1',
    'after Escape the window owns the keyboard, so F2 starts a new field',
    { opened, reset },
  )
  await closeWindows()
}

// Records every buffer the real WebAudio graph starts, named by the wav file it was decoded from.
const audioProbe = `(() => {
  window.__audio = []
  const bytes = new WeakMap(), buffers = new WeakMap()
  const arrayBuffer = Response.prototype.arrayBuffer
  Response.prototype.arrayBuffer = async function(...args) {
    const result = await arrayBuffer.apply(this, args)
    bytes.set(result, this.url.split('/').pop().split(/[-.]/)[0])
    return result
  }
  const decode = AudioContext.prototype.decodeAudioData
  AudioContext.prototype.decodeAudioData = async function(data, ...args) {
    const buffer = await decode.call(this, data, ...args)
    buffers.set(buffer, bytes.get(data))
    return buffer
  }
  const start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function(...args) {
    window.__audio.push(buffers.get(this.buffer))
    return start.apply(this, args)
  }
})()`
const SCHEME = {
  'Critical Stop': 'chord',
  Exclamation: 'notify',
  Asterisk: 'ding',
  Question: 'recycle',
  'Default Sound': 'chimes',
  'Restore Up': 'tada',
  'Restore Down': 'chord',
  'Start Windows': '(None)',
  'Exit Windows': '(None)',
  'Empty Recycle Bin': '(None)',
}

async function played(name, item, label, action) {
  await app.eval('window.__audio = []')
  await action()
  await sleep(900)
  const log = await app.eval('window.__audio')
  check(log.length === 1 && log[0] === name, item, label, log)
}

async function sounds() {
  await app.send('Page.enable')
  await app.send('Page.addScriptToEvaluateOnNewDocument', { source: audioProbe })
  await app.eval(
    `(() => { const s = JSON.parse(localStorage.getItem('win95.settings.v1') ?? '{}'); s.soundScheme = { ...(s.soundScheme ?? {}), ...${JSON.stringify(SCHEME)} }; localStorage.setItem('win95.settings.v1', JSON.stringify(s)) })()`,
  )
  await app.send('Page.reload')
  await sleep(2500)
  await app.waitFor(`!!document.querySelector('[data-start-button]') && Array.isArray(window.__audio)`, 15000)
  await closeWindows()

  await played('chord', 'S1', 'an error box (Run, missing program) plays Critical Stop once', async () => {
    await run('nosuchprogram')
    await app.waitFor(
      `[...document.querySelectorAll('[role="dialog"]')].some(d => d.textContent.includes('Cannot find'))`,
    )
  })
  await shot('s1-error-box')
  await app.key('Enter')
  await app.key('Escape')

  await run('notepad')
  await app.waitFor(`!!document.querySelector('[data-window] textarea')`)
  await openMenu('File', 'Save As...')
  await app.waitFor(`!!${dialog('Save As')}`)
  await played('notify', 'S1', 'a warning box (invalid file name) plays Exclamation once', async () => {
    await clickExpr(`${dialog('Save As')}.querySelector('input')`)
    await app.key('a', ['Control'])
    await app.type('bad?.txt')
    await app.key('Enter')
    await app.waitFor(`document.querySelectorAll('[role="dialog"]').length >= 2`)
  })
  await app.key('Enter')
  await app.key('Escape')
  await app.waitFor(`!document.querySelector('[role="dialog"]')`)

  await clickExpr(`document.querySelector('[data-window] textarea')`)
  await app.type('unsaved')
  await played('recycle', 'S1', 'a question box (Notepad, save changes) plays Question once', async () => {
    await openMenu('File', 'New')
    await app.waitFor(`!!document.querySelector('[role="dialog"]')`)
  })
  await played(
    'chimes',
    'S1',
    'clicking the owner window under the modal box plays Default Sound once',
    async () => {
      const box = await app.eval(
        `document.querySelector('[data-window] textarea').getBoundingClientRect().toJSON()`,
      )
      await app.click(box.x + 12, box.y + 12)
    },
  )
  const [nx, ny] = await centerOf(buttonIn('Notepad', 'No'))
  await app.click(nx, ny)
  await closeWindows()

  await run('command')
  await app.waitFor(`!!document.querySelector('[data-window]')`)
  await sleep(300)
  await played('ding', 'S1', 'an information box (DOS Prompt Help) plays Asterisk once', async () => {
    await app.key('F1')
    await app.waitFor(`!!${dialog('MS-DOS Prompt Help')}`)
  })
  await app.key('Enter')
  await closeWindows()

  await run('freecell')
  await app.waitFor(`document.querySelectorAll('[data-card]').length === 52`)
  const pair = await app.eval(`(() => {
    const columns = [...Array(8)].map((_, i) => [...document.querySelectorAll('[data-card]')].filter(c => c.getAttribute('aria-label').endsWith('column ' + (i + 1))).at(-1))
    const red = (c) => /heart|diamond/i.test(c.dataset.card)
    const rank = (c) => Number(c.dataset.card.split('-')[0])
    for (const a of columns) for (const b of columns)
      if (a !== b && !(rank(b) === rank(a) + 1 && red(a) !== red(b))) return [a.getAttribute('aria-label'), b.getAttribute('aria-label')]
  })()`)
  await played(
    'notify',
    'S1',
    'FreeCell illegal move box plays Exclamation once, with no extra chord',
    async () => {
      await clickExpr(`document.querySelector('[aria-label=${JSON.stringify(pair[0])}]')`)
      await clickExpr(`document.querySelector('[aria-label=${JSON.stringify(pair[1])}]')`)
      await app.waitFor(`!!document.querySelector('[role="dialog"]')`)
    },
  )
  await shot('s1-freecell-illegal')
  await app.key('Enter')
  await closeWindows()

  await run('notepad')
  await app.waitFor(`!!document.querySelector('[data-window] textarea')`)
  await clickExpr(`${topWindow}.querySelector('button[aria-label="Maximize"]')`)
  await sleep(600)
  await played('chord', 'S2', 'restoring from maximized plays Restore Down', async () => {
    await clickExpr(`${topWindow}.querySelector('button[aria-label="Restore"]')`)
  })
  await clickExpr(`${topWindow}.querySelector('button[aria-label="Minimize"]')`)
  await sleep(600)
  await played('tada', 'S2', 'restoring from the taskbar plays Restore Up', async () => {
    await clickExpr(
      `[...document.querySelectorAll('[data-taskbar] button')].find(b => b.textContent.includes('Notepad'))`,
    )
  })
  await closeWindows()
}

const desktopLabels = () =>
  app.eval(`[...document.querySelectorAll('[data-desktop-item]')].map(e => e.getAttribute('aria-label'))`)
const desktopItem = (label) =>
  `[...document.querySelectorAll('[data-desktop-item]')].find(e => e.getAttribute('aria-label') === ${q(label)})`
const rowsOf = (title) =>
  app.eval(
    `[...${dialog(title)}.querySelectorAll('[role="tabpanel"] span')].filter(s => /^[A-Z][A-Za-z -]+:$/.test(s.textContent) && s.nextElementSibling).map(s => s.textContent + s.nextElementSibling.textContent.trim())`,
  )

async function properties() {
  await closeWindows()
  await app.click(700, 400, { button: 'right' })
  await pickMenu('New')
  await pickMenu('Text Document')
  await app.waitFor(`!!document.querySelector('[data-desktop-item] input')`)
  const editing = await app.eval(`document.querySelector('[data-desktop-item] input').value`)
  await app.key('a', ['Control'])
  await app.type('Notes')
  await app.key('Enter')
  await sleep(300)
  const nodes = await app.eval(
    `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).filter(n => n.parent === 'desktop').map(n => n.name)`,
  )
  const labels = await desktopLabels()
  check(
    editing === 'New Text Document' && labels.includes('Notes') && nodes.includes('Notes.txt'),
    '4',
    'desktop hides the registered .txt extension, and a rename keeps it',
    { editing, labels, nodes },
  )

  await clickExpr(desktopItem('Minesweeper'), { button: 'right' })
  await pickMenu('Properties')
  await app.waitFor(`!!${dialog('Minesweeper Properties')}`)
  const tabs = await app.eval(
    `[...${dialog('Minesweeper Properties')}.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim())`,
  )
  await clickExpr(
    `[...${dialog('Minesweeper Properties')}.querySelectorAll('[role="tab"]')].find(t => t.textContent.trim() === 'Shortcut')`,
  )
  const fields = await app.eval(
    `Object.fromEntries([...${dialog('Minesweeper Properties')}.querySelectorAll('input[aria-label]')].map(i => [i.getAttribute('aria-label'), i.value]))`,
  )
  const run = await app.eval(
    `${dialog('Minesweeper Properties')}.querySelector('[role="combobox"]').textContent.trim()`,
  )
  check(
    tabs.join('|') === 'General|Shortcut' &&
      /WINMINE\.EXE$/i.test(fields.Target) &&
      fields['Start in'] === fields.Target.slice(0, fields.Target.lastIndexOf('\\')) &&
      run === 'Normal window',
    '4',
    'a shortcut adds the Shortcut tab with Target, Start in, and Run',
    { tabs, fields, run },
  )
  await shot('4-shortcut-tab', await dialogBox('Minesweeper Properties'))
  await app.key('Escape')

  await clickExpr(desktopItem('Notes'))
  await app.key('Delete')
  await app.waitFor(`!!document.querySelector('[role="dialog"]')`)
  await app.key('Enter')
  await sleep(300)
  await clickExpr(desktopItem('Recycle Bin'), { count: 2 })
  await app.waitFor(
    `[...document.querySelectorAll('[data-window]')].some(w => w.getAttribute('aria-label') === 'Recycle Bin')`,
  )
  await sleep(400)
  const item = `[...${topWindow}.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Notes')`
  await clickExpr(item, { button: 'right' })
  await pickMenu('Properties')
  await app.waitFor(`!!${dialog('Notes Properties')}`)
  const rows = await rowsOf('Notes Properties')
  const renamable = await app.eval(
    `!!${dialog('Notes Properties')}.querySelector('input[aria-label="Name"]')`,
  )
  const attributes = await app.eval(
    `[...${dialog('Notes Properties')}.querySelectorAll('input[type="checkbox"]')].every(c => c.disabled)`,
  )
  check(
    rows[0]?.startsWith('Origin:C:\\WINDOWS\\Desktop') &&
      rows.some((row) => row.startsWith('Deleted:')) &&
      !rows.some((row) => row.startsWith('Location:')) &&
      !renamable &&
      attributes,
    '4',
    'a recycled item shows Origin and Deleted, with a read-only name and attributes',
    { rows, renamable, attributes },
  )
  await shot('4-recycled-properties', await dialogBox('Notes Properties'))
  await app.key('Escape')
  await closeWindows()
}

async function captions() {
  await closeWindows()
  await run('notepad')
  await app.waitFor(`!!document.querySelector('[data-window] textarea')`)
  const file = `[...${topWindow}.querySelectorAll('[role="menubar"] button')].find(b => b.textContent.trim() === 'File')`
  await clickExpr(file)
  await app.waitFor(`!!document.querySelector('[role="menu"]')`)
  const open = await app.eval(
    `(() => { const s = getComputedStyle(${file}); return [s.backgroundColor, s.color, s.boxShadow] })()`,
  )
  await shot(
    'a2-open-menu-title',
    await app.eval(
      `(()=>{const b=(${topWindow}).getBoundingClientRect();return {x:b.x,y:b.y,width:260,height:140}})()`,
    ),
  )
  await app.key('Escape')
  await app.key('Escape')
  check(
    open[0] === 'rgb(0, 0, 128)' && open[1] === 'rgb(255, 255, 255)' && open[2] === 'none',
    'A2',
    'an open menu title is navy with white text, not sunken',
    open,
  )

  await app.key('f', ['Control'])
  await app.waitFor(`!!${dialog('Find')}`)
  await sleep(150)
  const captionsNow = () =>
    app.eval(
      `({ owner: (${topWindow}).querySelector('.bg-title, .bg-title-inactive').className.includes('bg-title-inactive') ? 'inactive' : 'active', find: ${dialog('Find')}.querySelector('.bg-title, .bg-title-inactive').className.includes('bg-title-inactive') ? 'inactive' : 'active' })`,
    )
  const withFind = await captionsNow()
  await shot(
    'a19-find-focused',
    await app.eval(
      `(()=>{const b=(${topWindow}).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})()`,
    ),
  )
  const box = await app.eval(
    `document.querySelector('[data-window] textarea').getBoundingClientRect().toJSON()`,
  )
  await app.click(box.x + 20, box.y + box.height - 20)
  await sleep(150)
  const withOwner = await captionsNow()
  check(
    withFind.owner === 'inactive' &&
      withFind.find === 'active' &&
      withOwner.owner === 'active' &&
      withOwner.find === 'inactive',
    'A19',
    'the focused modeless Find owns the active caption, and the owner takes it back on click',
    { withFind, withOwner },
  )
  await closeWindows()
}

const confirmation = () =>
  app.eval(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => d.querySelector('[role="img"]')); return d && { caption: d.querySelector('[data-dialog-caption]').className.includes('bg-title-inactive') ? 'inactive' : 'active', dialogs: document.querySelectorAll('[role=dialog]').length, title: d.getAttribute('aria-label'), picture: d.querySelector('[role="img"]').getAttribute('aria-label'), message: d.querySelector('p').textContent } })()`,
  )
const onDesktop = (name) =>
  app.eval(
    `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).some(n => n.parent === 'desktop' && n.name === ${q(name)})`,
  )

async function deletion() {
  await closeWindows()
  await app.click(700, 400, { button: 'right' })
  await pickMenu('New')
  await pickMenu('Text Document')
  await app.waitFor(`!!document.querySelector('[data-desktop-item] input')`)
  await app.key('a', ['Control'])
  await app.type('Notes')
  await app.key('Enter')
  await sleep(700)
  await clickExpr(desktopItem('Notes'))
  await app.key('Delete')
  await app.waitFor(`!!document.querySelector('[role="dialog"] [role="img"]')`)
  await sleep(200)
  const desktop = await confirmation()
  await shot('5-desktop-delete-confirmation')
  check(
    desktop.title === 'Confirm File Delete' &&
      desktop.picture === 'Send file to Recycle Bin' &&
      desktop.message === "Are you sure you want to send 'Notes' to the Recycle Bin?",
    '5',
    'the desktop asks with the shared confirmation picture and wording, by display name',
    desktop,
  )
  await app.key('y')
  await sleep(400)
  const gone = !(await onDesktop('Notes.txt'))
  await app.click(700, 400, { button: 'right' })
  const undoItem = await app.eval(
    `[...document.querySelectorAll('[role="menuitem"]')].find(m => m.textContent.startsWith('Undo'))?.textContent`,
  )
  await app.key('Escape')
  await app.click(700, 400)
  await app.key('z', ['Control'])
  await sleep(400)
  check(
    gone && undoItem === 'Undo Delete' && (await onDesktop('Notes.txt')),
    '5',
    'the desktop menu offers Undo Delete, and Ctrl+Z brings the file back',
    { gone, undoItem },
  )

  await run('C:\\My Documents')
  await app.waitFor(
    `[...document.querySelectorAll('[data-window]')].some(w => w.getAttribute('aria-label').endsWith('My Documents'))`,
  )
  await sleep(400)
  const readme = `[...${topWindow}.querySelectorAll('*')].find(e => e.children.length === 0 && e.textContent.trim() === 'Readme')`
  await clickExpr(readme)
  await app.key('Delete')
  await app.waitFor(`!!document.querySelector('[role="dialog"] [role="img"]')`)
  const explorer = await confirmation()
  check(
    explorer.title === 'Confirm File Delete' &&
      explorer.picture === 'Send file to Recycle Bin' &&
      explorer.message === "Are you sure you want to send 'Readme' to the Recycle Bin?",
    '5',
    'Explorer asks with the same promoted confirmation',
    explorer,
  )
  await app.key('y')
  await sleep(300)
  await clickExpr(desktopItem('Notes'))
  await app.key('Delete')
  await app.waitFor(`!!document.querySelector('[role="dialog"] [role="img"]')`)
  await app.key('y')
  await sleep(300)
  await clickExpr(
    `[...document.querySelectorAll('[data-window]')].find(w => w.getAttribute('aria-label').endsWith('My Documents'))`,
  )
  await openMenu('Edit', 'Undo Delete')
  await sleep(300)
  check(
    await onDesktop('Notes.txt'),
    '5',
    "Explorer's Undo reverses the desktop's delete, so both share one history",
  )
  await closeWindows()
}

const desktopCells = () =>
  app.eval(
    `[...document.querySelectorAll('[data-desktop-item]')].map(e => { const b = e.getBoundingClientRect(); return { label: e.getAttribute('aria-label'), x: Math.round(b.x), y: Math.round(b.y) } })`,
  )

async function labels() {
  await closeWindows()
  for (let i = 0; i < 2; i++) {
    await app.click(600, 300, { button: 'right' })
    await pickMenu('New')
    await pickMenu('Text Document')
    await app.waitFor(`!!document.querySelector('[data-desktop-item] input')`)
    await app.key('Enter')
    await sleep(700)
  }
  const cells = await desktopCells()
  const spots = new Set(cells.map((cell) => `${cell.x}:${cell.y}`))
  check(
    spots.size === cells.length && cells.some((cell) => cell.label === 'New Text Document (2)'),
    '6',
    'two documents created on the same spot land in separate cells',
    cells.filter((cell) => cell.label.startsWith('New Text')),
  )
  await shot('6-desktop-no-overlap')
  const ids = await app.eval(
    `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).filter(n => n.parent === 'desktop' && n.name.startsWith('New Text')).map(n => n.id)`,
  )
  await app.eval(
    `localStorage.setItem('w95.desktop.v1', JSON.stringify(Object.fromEntries(${JSON.stringify(ids)}.map(id => [id, { x: 302, y: 154 }]))))`,
  )
  await app.send('Page.reload')
  await sleep(2500)
  await app.waitFor(`document.querySelectorAll('[data-desktop-item]').length > 3`, 15000)
  const after = await desktopCells()
  check(
    new Set(after.map((cell) => `${cell.x}:${cell.y}`)).size === after.length,
    '6',
    'saved positions that collide (stale data) still draw in separate cells after a reload',
    after.filter((cell) => cell.label.startsWith('New Text')),
  )
}

async function fixedWindows() {
  await closeWindows()
  for (const exe of ['winmine', 'calc']) {
    await run(exe)
    await app.waitFor(`!!document.querySelector('[data-window]')`)
    await sleep(300)
    const before = await app.eval(`(${topWindow}).getBoundingClientRect().toJSON()`)
    const button = await app.eval(
      `(() => { const b = (${topWindow}).querySelector('button[aria-label="Maximize"]'); return { disabled: b.disabled, glyph: b.querySelector('img').getAttribute('src').length } })()`,
    )
    const caption = await app.eval(
      `(()=>{const b=(${topWindow}).querySelector('.bg-title').getBoundingClientRect();return [b.x+b.width/2,b.y+8]})()`,
    )
    await app.click(caption[0], caption[1], { count: 2 })
    await sleep(300)
    const after = await app.eval(`(${topWindow}).getBoundingClientRect().toJSON()`)
    check(
      button.disabled && after.width === before.width && after.height === before.height,
      '7',
      `${exe}: the fixed window's Maximize is disabled and a caption double-click does not maximize`,
      { button, before: [before.width, before.height], after: [after.width, after.height] },
    )
    await shot(`7-${exe}-maximize-disabled`, {
      x: after.x + after.width - 70,
      y: after.y,
      width: 70,
      height: 24,
    })
    await closeWindows()
  }
}

async function displayProperties() {
  await closeWindows()
  await app.click(700, 400, { button: 'right' })
  await pickMenu('Properties')
  await app.waitFor(`!!${dialog('Display Properties')}`)
  const tabs = await app.eval(
    `[...${dialog('Display Properties')}.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim())`,
  )
  await clickExpr(`${dialog('Display Properties')}.querySelector('[role="tab"][aria-selected="true"]')`)
  await app.key('Tab', ['Control'])
  const second = await selectedTab('Display Properties')
  await shot('3b-display-properties-tabs', await dialogBox('Display Properties'))
  await app.key('Escape')
  check(
    tabs.join('|') === 'Background|Screen Saver|Appearance|Settings' && second === 'Screen Saver',
    '3b',
    'Display Properties uses the shared tabs, and Ctrl+Tab turns the page',
    { tabs, second },
  )
}

const phases = {
  fileDialog,
  dialogs,
  about,
  kit,
  systemMenu,
  sounds,
  properties,
  captions,
  deletion,
  labels,
  fixedWindows,
  displayProperties,
}
try {
  for (const [name, body] of Object.entries(phases)) if (phase === 'all' || phase === name) await body()
} finally {
  writeFileSync(join(proof, `checks-${phase}.json`), JSON.stringify(results, null, 2))
  app.close()
}
