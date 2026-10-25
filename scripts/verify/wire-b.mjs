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
    await clickExpr(`[...${topWindow}.querySelectorAll('button')].find(b => b.textContent.trim() === 'Options')`)
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
  app.eval(`[...${topWindow}.querySelectorAll('*')].filter(e => e.children.length === 0 && /For Help|Opens|Creates|Saves/.test(e.textContent)).map(e => e.textContent.trim())[0] ?? null`)

async function kit() {
  await closeWindows()
  await app.click(600, 755, { button: 'right' })
  await pickMenu('Properties')
  await app.waitFor(`!!${dialog('Taskbar Properties')}`)
  check((await selectedTab('Taskbar Properties')) === 'Taskbar Options', '3b', 'Taskbar Properties opens on its first tab')
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
  const focusedTab = await app.eval(`document.activeElement.getAttribute('role') + ':' + document.activeElement.textContent.trim()`)
  check(back === 'Taskbar Options' && focusedTab === 'tab:Taskbar Options', '3b', 'Left Arrow on a tab selects and focuses the previous tab', focusedTab)
  await app.key('Escape')

  await run('find')
  await app.waitFor(`!!${topWindow}.querySelector('[role="tab"]')`)
  const findTabs = await app.eval(`[...${topWindow}.querySelectorAll('[role="tab"]')].map(t => t.textContent.trim() + (t.getAttribute('aria-selected') === 'true' ? '*' : ''))`)
  check(findTabs.join('|') === 'Name & Location*|Date Modified|Advanced', '3b', 'Find uses the shared property-sheet tabs', findTabs)
  await shot('3b-find-tabs', await app.eval(`(()=>{const b=(${topWindow}).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:Math.min(b.height,260)}})()`))
  await closeWindows()

  await run('mspaint')
  await app.waitFor(`!!document.querySelector('[data-window]')`)
  const idle = await statusText()
  await app.key('f', ['Alt'])
  await app.waitFor(`!!document.querySelector('[role="menu"]')`)
  const onNew = await statusText()
  await app.key('ArrowDown')
  const onOpen = await statusText()
  await shot('3c-paint-menu-help', await app.eval(`(()=>{const b=(${topWindow}).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})()`))
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

const phases = { fileDialog, dialogs, about, kit }
try {
  for (const [name, body] of Object.entries(phases)) if (phase === 'all' || phase === name) await body()
} finally {
  writeFileSync(join(proof, `checks-${phase}.json`), JSON.stringify(results, null, 2))
  app.close()
}
