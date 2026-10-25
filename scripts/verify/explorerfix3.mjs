// Live proof for apps fix round 3, unit U3 (Explorer, My Computer, Recycle Bin). Run against a fresh app:
//   W95_CDP_PORT=9412 W95_DATA_DIR=D:/tmp/explorerfix3-data bash scripts/verify/relaunch.sh --fresh
//   node scripts/verify/explorerfix3.mjs <phase>
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const port = Number(process.env.W95_CDP_PORT ?? 9412)
const proof = resolve(process.env.W95_PROOF_DIR ?? '../proof/explorerfix3')
mkdirSync(proof, { recursive: true })
const phase = process.argv[2] ?? 'all'
const app = await connect(port)
const results = []

function check(condition, item, name, detail) {
  assert.ok(condition, `${item}: ${name}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`)
  results.push({ item, name, detail })
  process.stdout.write(`PASS [${item}] ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}\n`)
}
const q = (value) => JSON.stringify(value)
const shot = (name, clip) => app.shot(join(proof, `${name}.png`), clip)
const dialog = (title) => `document.querySelector('[role="dialog"][aria-label=${q(title)}]')`
const anyDialog = `[...document.querySelectorAll('[role="dialog"]')].at(-1)`
const boxOf = (expression, pad = 4) =>
  app.eval(
    `(()=>{const b=(${expression}).getBoundingClientRect();return {x:Math.max(0,b.x-${pad}),y:Math.max(0,b.y-${pad}),width:b.width+${pad * 2},height:b.height+${pad * 2}}})()`,
  )
const dialogBox = (title, pad = 4) => boxOf(dialog(title), pad)
const buttonIn = (scope, label) =>
  `[...(${scope}).querySelectorAll('button')].find(b => b.textContent.trim() === ${q(label)} || b.getAttribute('aria-label') === ${q(label)})`
const menuItem = (label) =>
  `[...document.querySelectorAll('[role="menuitem"]')].find(e => e.innerText.replace(/\\s+/g,' ').trim().startsWith(${q(label)}))`
const menuLabels = () =>
  app.eval(
    `[...document.querySelectorAll('[role="menu"]')].at(-1) ? [...[...document.querySelectorAll('[role="menu"]')].at(-1).querySelectorAll('[role="menuitem"], hr')].map(e => e.tagName === 'HR' ? '-' : e.innerText.replace(/\\s+/g,' ').trim() + (e.disabled || e.getAttribute('aria-disabled') === 'true' ? ' (disabled)' : '')) : []`,
  )
const topWindow = `[...document.querySelectorAll('[data-window]')].filter(w => !w.classList.contains('hidden')).sort((a, b) => (Number(b.style.zIndex) || 0) - (Number(a.style.zIndex) || 0))[0]`
const windowNamed = (title) =>
  `[...document.querySelectorAll('[data-window]')].find(w => w.getAttribute('aria-label') === ${q(title)})`
const centerOf = (expression) =>
  app.eval(`(()=>{const b=(${expression}).getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`)
async function clickExpr(expression, options) {
  await app.waitFor(`!!(${expression})`)
  const [x, y] = await centerOf(expression)
  await app.click(x, y, options)
}
const press = (type, [x, y], buttons) =>
  app.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', buttons, clickCount: 1 })
async function holdDrag(from, to, steps = 8) {
  await press('mouseMoved', from, 0)
  await press('mousePressed', from, 1)
  for (let i = 1; i <= steps; i++)
    await press(
      'mouseMoved',
      [from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps],
      1,
    )
  await sleep(100)
  return { release: () => press('mouseReleased', to, 0) }
}
const pickMenu = (label) => clickExpr(menuItem(label))
async function openMenu(menu, item, scope = topWindow) {
  await clickExpr(
    `[...(${scope}).querySelectorAll('[role="menubar"] *')].find(e => e.textContent.trim() === ${q(menu)})`,
  )
  if (item) await pickMenu(item)
}
async function openStartItem(label) {
  await app.clickOn('[data-start-button]')
  await pickMenu(label)
}
async function run(command) {
  await openStartItem('Run...')
  await app.waitFor(`!!document.querySelector('#run-command')`)
  await app.key('a', ['Control'])
  await app.type(command)
  await app.key('Enter')
  await sleep(500)
}
const desktopItem = (label) =>
  `[...document.querySelectorAll('[data-desktop-item]')].find(e => e.getAttribute('aria-label') === ${q(label)})`
const itemIn = (scope, label) =>
  `[...(${scope}).querySelectorAll('[role="listbox"] [role="option"]')].find(e => e.getAttribute('aria-label') === ${q(label)} || e.textContent.trim() === ${q(label)})`
const statusOf = (scope) =>
  app.eval(
    `[...(${scope}).querySelectorAll('.explorer > div.shrink-0 > .bevel-shallow')].map(e => e.textContent)`,
  )
const fsNodes = () => app.eval(`Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes)`)

async function fresh() {
  await sleep(400)
  await app.eval("addEventListener('beforeunload', () => localStorage.clear()); localStorage.clear()")
  await app.send('Page.reload', {})
  await sleep(800)
  await app.waitFor(`!!document.querySelector('[data-desktop-item]')`, 10000)
  await sleep(500)
}
async function openOnDesktop(label, title = label) {
  await clickExpr(desktopItem(label), { count: 2 })
  await app.waitFor(`!!${windowNamed(title)}`)
  await sleep(200)
}
async function openIn(scope, label, title) {
  await clickExpr(itemIn(scope, label), { count: 2 })
  if (title) await app.waitFor(`!!${windowNamed(title)}`)
  await sleep(250)
}

async function panes() {
  await fresh()
  await openOnDesktop('My Computer')
  const mc = windowNamed('My Computer')
  const status = await statusOf(mc)
  check(
    Array.isArray(status) && status.length === 2 && status[1] === '',
    '38',
    "My Computer's right status pane is empty with nothing selected",
    status,
  )
  await clickExpr(itemIn(mc, '(C:)'))
  const withDrive = await statusOf(mc)
  check(
    /^Free Space: .+MB, Capacity: 512MB$/.test(withDrive[1]),
    '38',
    'selecting (C:) shows its free space and capacity',
    withDrive,
  )
  await shot('38-mycomputer-status', await boxOf(mc))

  await clickExpr(itemIn(mc, '3½ Floppy (A:)'), { count: 2 })
  await app.waitFor(`!!${anyDialog}`)
  const floppy = await app.eval(`${anyDialog}.getAttribute('aria-label')`)
  check(floppy === 'A:\\', '24', 'the floppy error box is titled A:\\ with one backslash', floppy)
  await shot('24-floppy-title', await boxOf(anyDialog))
  await clickExpr(buttonIn(anyDialog, 'Cancel'))

  await openIn(mc, '(C:)', '(C:)')
  const c = windowNamed('(C:)')
  await openMenu('View', 'Toolbar', c)
  await sleep(200)
  const bar = await app.eval(
    `(()=>{const t=${c}.querySelector('.explorer-toolbar');const b=[...t.querySelectorAll('button')];return {height:t.offsetHeight,width:t.clientWidth,scroll:t.scrollWidth,rows:new Set(b.map(x=>x.offsetTop)).size}})()`,
  )
  check(
    bar.rows === 1 && bar.height <= 30 && bar.scroll > bar.width,
    '15',
    'the toolbar stays one row in a narrow window and clips the buttons that do not fit',
    bar,
  )
  await shot('15-toolbar-one-row', await boxOf(c))
  await openMenu('View', 'Toolbar', c)

  const layout = await app.eval(
    `[...${c}.querySelectorAll('[role="listbox"] [role="option"]')].map(o => ({ label: o.getAttribute('aria-label'), top: o.offsetTop }))`,
  )
  const lastRowTop = Math.max(...layout.map((item) => item.top))
  const onLastRow = layout.filter((item) => item.top === lastRowTop)
  const firstRow = layout.filter((item) => item.top === layout[0].top)
  const start = firstRow.length < layout.length ? firstRow.at(-1) : layout[0]
  await clickExpr(itemIn(c, start.label))
  await app.key('ArrowDown')
  await sleep(100)
  const afterDown = await app.eval(
    `[...${c}.querySelectorAll('[role="option"][aria-selected="true"]')].map(o => o.getAttribute('aria-label'))`,
  )
  const below = layout.find(
    (item) =>
      item.top > start.top && Math.abs(layout.indexOf(item) - layout.indexOf(start)) === firstRow.length,
  )
  check(
    below ? afterDown[0] === below.label : afterDown[0] === start.label,
    '26',
    'Down with no icon directly below keeps the selection',
    { start: start.label, afterDown, rows: { first: firstRow.length, last: onLastRow.length } },
  )
  await app.key('ArrowRight')
  const afterRight = await app.eval(
    `[...${c}.querySelectorAll('[role="option"][aria-selected="true"]')].map(o => o.getAttribute('aria-label'))`,
  )
  check(afterRight[0] !== afterDown[0], '26', 'Right still moves one icon', afterRight)

  await openIn(c, 'My Documents', 'My Documents')
  const docs = windowNamed('My Documents')
  const before = await app.eval(`(()=>{const s=${docs}.style;return [s.left,s.top]})()`)
  await clickExpr(`${docs}.querySelector('[role="listbox"]')`)
  await app.key('Backspace')
  await sleep(300)
  const moved = await app.eval(
    `(()=>{const w=${topWindow};return {title:w.getAttribute('aria-label'),pos:[w.style.left,w.style.top]}})()`,
  )
  check(
    moved.title === '(C:)' && moved.pos[0] === before[0] && moved.pos[1] === before[1],
    '25',
    'Backspace takes the window up to (C:) and leaves it where it was',
    { before, after: moved },
  )
  await shot('25-backspace-stays')
}

async function explorer() {
  await fresh()
  await run('explorer')
  await app.waitFor(`!!${windowNamed('Exploring - C:\\')}`)
  const ex = windowNamed('Exploring - C:\\')
  const sash = await app.eval(
    `(()=>{const s=${ex}.querySelector('.explorer-splitter').getBoundingClientRect();return {x:s.x,y:s.y,w:s.width,h:s.height}})()`,
  )
  const treeBefore = await app.eval(`${ex}.querySelector('.explorer-tree-pane').offsetWidth`)
  check(sash.w === 4 && sash.h > 100, '9', 'the splitter is a full-height 4px sash', sash)
  const from = [sash.x + 2, sash.y + sash.h / 2]
  const to = [from[0] + 80, from[1]]
  const gesture = await holdDrag(from, to)
  await sleep(100)
  const during = await app.eval(
    `({bar: !!document.querySelector('.explorer-splitter-bar'), tree: ${ex}.querySelector('.explorer-tree-pane').offsetWidth})`,
  )
  await shot('09-splitter-dragging', await boxOf(ex))
  await gesture.release()
  await sleep(150)
  const treeAfter = await app.eval(`${ex}.querySelector('.explorer-tree-pane').offsetWidth`)
  check(
    during.bar && during.tree === treeBefore && treeAfter === treeBefore + 80,
    '9',
    'dragging tracks a dithered bar, and the tree pane takes the width on release',
    { treeBefore, during, treeAfter },
  )
  await shot('09-splitter-after', await boxOf(ex))

  await clickExpr(`${ex}.querySelector('[role="treeitem"][aria-selected="true"]')`)
  const where = () =>
    app.eval(
      `(()=>{const a=document.activeElement;return a.closest('[role="tree"]')?'tree':a.closest('.explorer-toolbar')?'combo':a.getAttribute('role')==='listbox'?'list':a.className.includes('expander')?'expander':(a.getAttribute('aria-label')||a.tagName)})()`,
    )
  const seen = []
  for (const key of ['Tab', 'Tab', 'Tab']) {
    await app.key(key)
    seen.push(await where())
  }
  await app.key('Tab', ['Shift'])
  seen.push(await where())
  for (const key of ['F6', 'F6']) {
    await app.key(key)
    seen.push(await where())
  }
  check(
    seen.join(',') === 'list,combo,tree,combo,tree,list',
    '18',
    'Tab, Shift+Tab, and F6 cycle the combo, tree, and list, never stopping on an expander',
    seen,
  )

  await openMenu('Tools', 'Go to...', ex)
  await app.waitFor(`!!${dialog('Go to Folder')}`)
  const box = await app.eval(
    `(()=>{const i=${dialog('Go to Folder')}.querySelector('input');return {value:i.value,start:i.selectionStart,end:i.selectionEnd,focused:document.activeElement===i}})()`,
  )
  check(
    box.focused && box.start === 0 && box.end === box.value.length && box.value === 'C:\\',
    '23',
    'Go to Folder opens with its path selected',
    box,
  )
  await shot('23-goto-selected', await dialogBox('Go to Folder'))
  await app.type('C:\\WINDOWS')
  await app.key('Enter')
  await app.waitFor(`!!${windowNamed('Exploring - WINDOWS')}`)
  check(true, '23', 'typing over the selection and Enter goes to C:\\WINDOWS')
}

async function sizes() {
  await fresh()
  await run('explorer')
  await app.waitFor(`!!${windowNamed('Exploring - C:\\')}`)
  const ex = windowNamed('Exploring - C:\\')
  await openMenu('View', 'Details', ex)
  await sleep(200)
  const row = await app.eval(
    `[...${itemIn(ex, 'AUTOEXEC.BAT')}.querySelectorAll('.explorer-cell')].map(c => c.textContent)`,
  )
  check(row[1] === '1KB', '21', 'Details shows 1KB with no space', row)
  await shot('21-details-size', await boxOf(ex))
  await clickExpr(itemIn(ex, 'AUTOEXEC.BAT'))
  await app.key('Enter', ['Alt'])
  await app.waitFor(`!!${dialog('AUTOEXEC Properties')}`)
  const size = await app.eval(
    `[...${dialog('AUTOEXEC Properties')}.querySelectorAll('span')].find(s => s.textContent === 'Size:').nextElementSibling.textContent`,
  )
  check(/^\d+ bytes \(\d+ bytes\)$/.test(size), '21', 'Properties reads N bytes (N bytes)', size)
  await shot('21-properties-size', await dialogBox('AUTOEXEC Properties'))
  await app.key('Escape')
}

const confirmation = () =>
  app.eval(
    `(() => { const d = [...document.querySelectorAll('[role="dialog"]')].find(d => d.querySelector('[role="img"]')); return d && { title: d.getAttribute('aria-label'), picture: d.querySelector('[role="img"]').getAttribute('aria-label'), message: d.querySelector('p').textContent } })()`,
  )
const savedNodes = async () => {
  await sleep(400)
  return fsNodes()
}
async function openDocuments() {
  await openOnDesktop('My Computer')
  await openIn(windowNamed('My Computer'), '(C:)', '(C:)')
  await openIn(windowNamed('(C:)'), 'My Documents', 'My Documents')
  return windowNamed('My Documents')
}
async function newTextDocument(scope) {
  const [x, y] = await centerOf(`${scope}.querySelector('[role="listbox"]')`)
  await app.click(x + 60, y + 40, { button: 'right' })
  await pickMenu('New')
  await pickMenu('Text Document')
  await app.waitFor(`!!${scope}.querySelector('input[aria-label="Rename"]')`)
  await app.key('Enter')
  await sleep(200)
}

async function minimizeAll() {
  await app.click(900, 754, { button: 'right' })
  await pickMenu('Minimize All Windows')
  await sleep(300)
}
const taskButton = (title) =>
  `[...document.querySelectorAll('[data-task]')].find(b => b.textContent.trim() === ${q(title)})`

async function deletion() {
  await fresh()
  const docs = await openDocuments()
  await clickExpr(itemIn(docs, 'Readme.txt'))
  await app.key('Delete', ['Shift'])
  await app.waitFor(`!!${anyDialog}`)
  const shift = await confirmation()
  check(
    shift.title === 'Confirm File Delete' &&
      shift.message === "Are you sure you want to delete 'Readme'?" &&
      shift.picture === 'Delete file',
    '12',
    'Shift+Delete asks to delete for good, not to recycle',
    shift,
  )
  await shot('12-shift-delete', await boxOf(anyDialog))
  await app.key('y')
  const after = await savedNodes()
  check(
    !after.some((node) => node.name === 'Readme.txt'),
    '12',
    'Yes removes the file without putting it in the Recycle Bin',
    after.filter((node) => node.parent === 'recycled').map((node) => node.name),
  )

  await newTextDocument(docs)
  await clickExpr(itemIn(docs, 'New Text Document.txt'))
  await openMenu('File', null, docs)
  await clickExpr(menuItem('Delete'), { mods: ['Shift'] })
  await app.waitFor(`!!${anyDialog}`)
  const menuShift = await confirmation()
  check(
    menuShift.message === "Are you sure you want to delete 'New Text Document'?",
    '12',
    'File > Delete clicked with Shift held also deletes for good',
    menuShift,
  )
  await app.key('n')

  await clickExpr(itemIn(docs, 'New Text Document.txt'))
  await app.key('c', ['Control'])
  await app.key('v', ['Control'])
  await app.waitFor(`!!${itemIn(docs, 'Copy of New Text Document.txt')}`)
  await openMenu('Edit', null, docs)
  const edit = await menuLabels()
  check(edit[0] === 'Undo Copy Ctrl+Z', '20', 'after a copy, Edit offers Undo Copy', edit)
  await shot('20-undo-copy-menu', await boxOf(docs, 40))
  await app.key('Escape')
  await app.key('Escape')
  await clickExpr(`${docs}.querySelector('[role="listbox"]')`)
  await app.key('z', ['Control'])
  await sleep(300)
  const undone = await app.eval(
    `[...${docs}.querySelectorAll('[role="option"]')].map(o => o.getAttribute('aria-label'))`,
  )
  check(
    !undone.includes('Copy of New Text Document.txt') && undone.includes('New Text Document.txt'),
    '20',
    'Ctrl+Z removes the copy and keeps the original',
    undone,
  )
  await shot('20-after-undo-copy', await boxOf(docs))
}

async function bin() {
  await fresh()
  const docs = await openDocuments()
  await clickExpr(itemIn(docs, 'Readme.txt'))
  await app.key('Delete')
  await app.key('y')
  await sleep(200)
  await run('recycle')
  await app.waitFor(`!!${windowNamed('Recycle Bin')}`)
  const rb = windowNamed('Recycle Bin')
  await clickExpr(itemIn(rb, 'Readme.txt'), { button: 'right' })
  const menu = await menuLabels()
  check(
    menu.join('|') === 'Restore|-|Cut|-|Delete|-|Properties',
    '28',
    'a recycled item offers Restore, Cut, Delete, and Properties',
    menu,
  )
  await shot('28-recycled-context-menu', await boxOf(rb, 60))
  await pickMenu('Properties')
  await app.waitFor(`!!${dialog('Readme Properties')}`)
  const rows = await app.eval(
    `[...${dialog('Readme Properties')}.querySelectorAll('span')].filter(s => /^[A-Z][A-Za-z -]+:$/.test(s.textContent)).map(s => s.textContent)`,
  )
  check(
    rows.includes('Origin:') &&
      rows.includes('Deleted:') &&
      !rows.includes('Location:') &&
      !rows.includes('Accessed:'),
    '28',
    'recycled Properties shows Origin and Deleted instead of Location and Accessed',
    rows,
  )
  await shot('28-recycled-properties', await dialogBox('Readme Properties'))
  await app.key('Escape')
  await clickExpr(itemIn(rb, 'Readme.txt'), { button: 'right' })
  await pickMenu('Cut')
  await clickExpr(taskButton('My Documents'))
  await sleep(500)
  await clickExpr(`${docs}.querySelector('[role="listbox"]')`)
  await app.key('v', ['Control'])
  await sleep(300)
  const nodes = await savedNodes()
  const readme = nodes.find((node) => node.name === 'Readme.txt')
  const record = await app.eval(`JSON.parse(localStorage.getItem('w95.fs.v1')).recycled`)
  check(
    readme?.parent === 'documents' && Object.keys(record).length === 0,
    '28',
    'Cut in the bin and Paste in My Documents brings the file back there',
    { parent: readme?.parent, record },
  )

  await minimizeAll()
  await clickExpr(desktopItem('Recycle Bin'), { button: 'right' })
  const desk = await menuLabels()
  check(desk.at(-1) === 'Properties', '29', "the desktop Recycle Bin's Properties is enabled", desk)
  await pickMenu('Properties')
  await app.waitFor(`!!${dialog('Recycle Bin Properties')}`)
  const sheet = dialog('Recycle Bin Properties')
  const global = await app.eval(
    `({ tabs: [...${sheet}.querySelectorAll('[role="tab"]')].map(t => t.textContent), radios: [...${sheet}.querySelectorAll('input[type=radio]')].map(r => r.parentElement.parentElement.textContent + (r.checked ? ' *' : '')), slider: ${sheet}.querySelector('[role="slider"]').getAttribute('aria-valuenow'), confirm: [...${sheet}.querySelectorAll('label')].find(l => l.textContent === 'Display delete confirmation dialog').querySelector('input').checked })`,
  )
  check(
    global.tabs.join('|') === 'Global|(C:)' &&
      global.radios[1].endsWith(' *') &&
      global.slider === '10' &&
      global.confirm,
    '29',
    'Recycle Bin Properties has Global and (C:) pages, one setting for all drives, 10%, and the confirmation box',
    global,
  )
  await shot('29-bin-properties-global', await dialogBox('Recycle Bin Properties'))
  await clickExpr(`[...${sheet}.querySelectorAll('[role="tab"]')][1]`)
  const drive = await app.eval(`${sheet}.querySelector('[role="tabpanel"]').innerText`)
  check(
    drive.includes('Size of drive:') && drive.includes('512MB') && drive.includes('51.2MB'),
    '29',
    'the (C:) page shows the drive size and the space reserved',
    drive,
  )
  await shot('29-bin-properties-drive', await dialogBox('Recycle Bin Properties'))
  await clickExpr(`[...${sheet}.querySelectorAll('[role="tab"]')][0]`)
  const [sx, sy] = await centerOf(`${sheet}.querySelector('[role="slider"]')`)
  await app.click(sx + 40, sy)
  const moved = await app.eval(`${sheet}.querySelector('[role="slider"]').getAttribute('aria-valuenow')`)
  check(moved === '20', '29', 'clicking the channel right of the pointer pages it up by 10', moved)
  await clickExpr(
    `[...${sheet}.querySelectorAll('label')].find(l => l.textContent.startsWith('Do not move files'))`,
  )
  await clickExpr(buttonIn(sheet, 'OK'))
  await clickExpr(taskButton('My Documents'))
  await sleep(500)
  await clickExpr(itemIn(docs, 'Readme.txt'))
  await app.key('Delete')
  await app.waitFor(`!!${anyDialog}`)
  const nuke = await confirmation()
  check(
    nuke.message === "Are you sure you want to delete 'Readme'?",
    '29',
    'with Do not move files to the Recycle Bin, Delete deletes for good',
    nuke,
  )
  await app.key('n')
  await minimizeAll()
  await clickExpr(desktopItem('Recycle Bin'), { button: 'right' })
  await pickMenu('Properties')
  await app.waitFor(`!!${dialog('Recycle Bin Properties')}`)
  await clickExpr(
    `[...${sheet}.querySelectorAll('label')].find(l => l.textContent.startsWith('Do not move files'))`,
  )
  await clickExpr(
    `[...${sheet}.querySelectorAll('label')].find(l => l.textContent === 'Display delete confirmation dialog')`,
  )
  await clickExpr(buttonIn(sheet, 'OK'))
  await clickExpr(taskButton('My Documents'))
  await sleep(500)
  await clickExpr(itemIn(docs, 'Readme.txt'))
  await app.key('Delete')
  await sleep(400)
  const quiet = await app.eval(
    `({ dialog: !!${anyDialog}, recycled: JSON.parse(localStorage.getItem('w95.fs.v1')).recycled })`,
  )
  check(
    !quiet.dialog && Object.keys(quiet.recycled).includes('readme'),
    '29',
    'with the confirmation unchecked, Delete recycles without asking',
    quiet,
  )
}

async function shared() {
  await fresh()
  await openStartItem('Find')
  await pickMenu('Files or Folders...')
  await app.waitFor(`!!document.activeElement && document.activeElement.name === 'named'`)
  await app.type('*.txt')
  await app.key('Enter')
  const findWindow = `[...document.querySelectorAll('[data-window]')].find(w => w.getAttribute('aria-label').startsWith('Find'))`
  const result = `[...${findWindow}.querySelectorAll('tr, [role="option"], [role="row"]')].find(r => r.textContent.includes('Readme') && r.textContent.includes('My Documents'))`
  await app.waitFor(`!!(${result})`)
  await clickExpr(result, { button: 'right' })
  await pickMenu('Open Containing Folder')
  await app.waitFor(`!!${windowNamed('My Documents')}`)
  await sleep(300)
  const docs = windowNamed('My Documents')
  const selected = await app.eval(
    `[...${docs}.querySelectorAll('[role="option"][aria-selected="true"]')].map(o => o.getAttribute('aria-label'))`,
  )
  check(
    selected.join() === 'Readme.txt',
    '37',
    "Find's Open Containing Folder opens My Documents with the file selected",
    selected,
  )
  await shot('37-containing-folder-selected', await boxOf(docs))

  await run('notepad')
  await app.waitFor(`!!${windowNamed('Untitled - Notepad')}`)
  const pad = windowNamed('Untitled - Notepad')
  await openMenu('File', 'Open...', windowNamed('Untitled - Notepad'))
  await app.waitFor(`!!${dialog('Open')}`)
  await clickExpr(`${dialog('Open')}.querySelector('input')`)
  await app.key('a', ['Control'])
  await app.type('nothere')
  await app.key('Enter')
  await app.waitFor(`[...document.querySelectorAll('[role="dialog"]')].length > 1`)
  const missing = await app.eval(`${anyDialog}.innerText`)
  check(
    missing.includes('nothere.txt\nFile not found.\nPlease verify the correct file name was given.'),
    '30',
    'Open on a missing name gives the common dialog File not found wording',
    missing,
  )
  await shot('30-open-missing', await boxOf(anyDialog))
  await app.key('Enter')
  await app.key('Escape')
  await clickExpr(`${pad}.querySelector('textarea')`)
  await app.type('hello')
  await openMenu('File', 'Save As...', pad)
  await app.waitFor(`!!${dialog('Save As')}`)
  const listed = await app.eval(
    `[...${dialog('Save As')}.querySelectorAll('[role="option"]')].map(o => o.textContent.trim())`,
  )
  check(
    listed.includes('Readme') && !listed.includes('Readme.txt'),
    '30',
    'Save As lists Readme with its registered extension hidden',
    listed,
  )
  await clickExpr(
    `[...${dialog('Save As')}.querySelectorAll('[role="option"]')].find(o => o.textContent.trim() === 'Readme')`,
  )
  const field = await app.eval(`${dialog('Save As')}.querySelector('input').value`)
  await shot('30-save-as-hidden-extension', await dialogBox('Save As'))
  await clickExpr(buttonIn(dialog('Save As'), 'Save'))
  await app.waitFor(`[...document.querySelectorAll('[role="dialog"]')].length > 1`)
  const box = await app.eval(`${anyDialog}.innerText`)
  check(
    field === 'Readme' &&
      box.includes('C:\\My Documents\\Readme.txt\nThis file already exists.') &&
      box.includes('Replace existing file?'),
    '30',
    'saving over Readme asks with the full path, This file already exists, and Replace existing file?',
    { field, box },
  )
  await shot('30-overwrite-prompt', await boxOf(anyDialog))
  await clickExpr(buttonIn(anyDialog, 'No'))
  await app.key('Escape')
}

async function tree() {
  await fresh()
  await run('explorer')
  await app.waitFor(`!!${windowNamed('Exploring - C:\\')}`)
  const ex = `[...document.querySelectorAll('[data-window]')].find(w => w.getAttribute('aria-label').startsWith('Exploring'))`
  for (const folder of ['Control Panel', 'Printers']) {
    await clickExpr(
      `[...${ex}.querySelectorAll('[role="treeitem"]')].find(r => r.textContent.trim() === ${q(folder)})`,
    )
    await app.waitFor(`${ex}.getAttribute('aria-label') === ${q(`Exploring - ${folder}`)}`)
    const view = await app.eval(
      `({ windows: document.querySelectorAll('[data-window]').length, heading: [...${ex}.querySelectorAll('.explorer-pane-heading')].map(h => h.textContent), items: [...${ex}.querySelectorAll('[role="listbox"] [role="option"]')].map(o => o.textContent.trim()) })`,
    )
    check(
      view.windows === 1 && view.heading[1] === `Contents of '${folder}'` && view.items.length > 0,
      '8',
      `the tree's ${folder} opens in the Exploring window's right pane`,
      view,
    )
    await shot(`08-tree-${folder.toLowerCase().replace(' ', '-')}`, await boxOf(ex))
  }
}

async function drive() {
  await fresh()
  await openOnDesktop('My Computer')
  const mc = windowNamed('My Computer')
  await clickExpr(itemIn(mc, '(C:)'), { button: 'right' })
  await pickMenu('Properties')
  await app.waitFor(`!!${dialog('(C:) Properties')}`)
  const sheet = dialog('(C:) Properties')
  const general = await app.eval(
    `({ tabs: [...${sheet}.querySelectorAll('[role="tab"]')].map(t => t.textContent), text: ${sheet}.querySelector('[role="tabpanel"]').innerText, pie: !!${sheet}.querySelector('canvas[role="img"]'), label: ${sheet}.querySelector('input').value })`,
  )
  check(
    general.tabs.join('|') === 'General|Tools' &&
      /Used space:\s+[\d,]+ bytes/.test(general.text) &&
      /Free space:\s+[\d,]+ bytes/.test(general.text) &&
      /Capacity:\s+536,870,912 bytes\s+512MB/.test(general.text) &&
      general.text.includes('Type:\nLocal Disk') &&
      general.text.includes('Drive C') &&
      general.pie,
    '14',
    '(C:) Properties is the drive sheet: Label, Type, used and free space, capacity, the pie, and Drive C',
    general,
  )
  await shot('14-drive-general', await dialogBox('(C:) Properties'))
  await clickExpr(`[...${sheet}.querySelectorAll('[role="tab"]')][1]`)
  const tools = await app.eval(
    `({ groups: [...${sheet}.querySelectorAll('legend')].map(l => l.textContent), buttons: [...${sheet}.querySelectorAll('[role="tabpanel"] button')].map(b => b.textContent) })`,
  )
  check(
    tools.groups.join('|') === 'Error-checking status|Backup status|Defragmentation status' &&
      tools.buttons.join('|') === 'Check Now...|Backup Now...|Defragment Now...',
    '14',
    'the Tools page has error-checking, backup, and defragmentation status with their buttons',
    tools,
  )
  await shot('14-drive-tools', await dialogBox('(C:) Properties'))
  await clickExpr(buttonIn(sheet, 'Check Now...'))
  await app.waitFor(`!!${dialog('ScanDisk')}`)
  const scandisk = await app.eval(`${dialog('ScanDisk')}.innerText`)
  check(scandisk.includes('not installed'), '14', 'Check Now says the tool is not installed', scandisk)
  await app.key('Enter')
  await clickExpr(`[...${sheet}.querySelectorAll('[role="tab"]')][0]`)
  await clickExpr(`${sheet}.querySelector('input')`)
  await app.type('Work')
  await clickExpr(buttonIn(sheet, 'OK'))
  await sleep(200)
  const named = await app.eval(
    `[...${mc}.querySelectorAll('[role="option"]')].map(o => o.textContent.trim())`,
  )
  check(named.includes('Work (C:)'), '14', 'a typed label renames the drive Work (C:)', named)
  await shot('14-drive-labeled', await boxOf(mc))
}

async function options() {
  await fresh()
  await openOnDesktop('My Computer')
  await openIn(windowNamed('My Computer'), '(C:)', '(C:)')
  const c = windowNamed('(C:)')
  await openMenu('View', 'Options...', c)
  await app.waitFor(`!!${dialog('Options')}`)
  const sheet = dialog('Options')
  const tab = (index) => clickExpr(`[...${sheet}.querySelectorAll('[role="tab"]')][${index}]`)
  const page = () => app.eval(`${sheet}.querySelector('[role="tabpanel"]').innerText`)
  const tabs = await app.eval(`[...${sheet}.querySelectorAll('[role="tab"]')].map(t => t.textContent)`)
  const folder = await page()
  check(
    tabs.join('|') === 'Folder|View|File Types' &&
      folder.includes('Browsing options') &&
      folder.includes('Browse folders using a separate window for each folder.') &&
      (await app.eval(`${sheet}.querySelectorAll('[role="tabpanel"] img').length`)) === 2,
    '22',
    'Options has Folder, View, and File Types, and Folder pictures both browsing options',
    { tabs, folder },
  )
  await shot('22-options-folder', await dialogBox('Options'))
  await tab(1)
  const view = await page()
  check(
    [
      'Hidden files',
      'Show all files',
      'Hide files of these types:',
      'Display the full MS-DOS path in the title bar',
      'Hide MS-DOS file extensions for file types that are registered',
      'Include description bar for right and left panes',
    ].every((text) => view.includes(text)),
    '22',
    'the View page has the hidden-files list and the three Windows 95 options',
    view,
  )
  await shot('22-options-view', await dialogBox('Options'))
  await tab(2)
  await app.eval(
    "[...document.querySelectorAll('[role=option]')].find(o => o.textContent.trim() === 'Text Document').scrollIntoView({ block: 'nearest' })",
  )
  await clickExpr(
    `[...${sheet}.querySelectorAll('[role="option"]')].find(o => o.textContent.trim() === 'Text Document')`,
  )
  const types = await page()
  check(
    types.includes('Registered file types:') &&
      /Extension:\s+TXT/.test(types) &&
      /Opens with:\s+NOTEPAD/.test(types),
    '22',
    'File Types lists registered types and details Text Document as TXT opened with NOTEPAD',
    types,
  )
  await shot('22-options-file-types', await dialogBox('Options'))
  await tab(1)
  await clickExpr(
    `[...${sheet}.querySelectorAll('label')].find(l => l.textContent === 'Display the full MS-DOS path in the title bar')`,
  )
  await clickExpr(
    `[...${sheet}.querySelectorAll('label')].find(l => l.textContent === 'Include description bar for right and left panes')`,
  )
  await clickExpr(buttonIn(sheet, 'OK'))
  await app.waitFor(`!!${windowNamed('C:\\')}`)
  await openIn(windowNamed('C:\\'), 'My Documents', 'C:\\My Documents')
  check(true, '22', 'with the full path option, folder windows are titled C:\\ and C:\\My Documents')
  await run('explorer')
  await app.waitFor(`!!${windowNamed('Exploring - C:\\')}`)
  const headings = await app.eval(
    `${windowNamed('Exploring - C:\\')}.querySelectorAll('.explorer-pane-heading').length`,
  )
  check(
    headings === 0,
    '22',
    'without the description bar, Explorer drops All Folders and Contents of',
    headings,
  )
  await shot('22-options-applied')
}

async function icons() {
  await fresh()
  await openOnDesktop('My Computer')
  await openIn(windowNamed('My Computer'), '(C:)', '(C:)')
  const c = windowNamed('(C:)')
  const iconOf = (scope, name) => app.eval(`${itemIn(scope, name)}.querySelector('img').src`)
  await openIn(c, 'My Documents', 'My Documents')
  const readme = await iconOf(windowNamed('My Documents'), 'Readme.txt')
  const autoexec = await iconOf(c, 'AUTOEXEC.BAT')
  const config = await iconOf(c, 'CONFIG.SYS')
  check(
    new Set([readme, autoexec, config]).size === 3,
    '27',
    'AUTOEXEC.BAT, CONFIG.SYS, and Readme.txt each have their own type icon',
  )
  await clickExpr(taskButton('(C:)'))
  await sleep(400)
  await shot('27-c-drive-icons', await boxOf(c))
  await openIn(c, 'WINDOWS', 'WINDOWS')
  const win = windowNamed('WINDOWS')
  await openMenu('View', 'Details', win)
  const programs = await app.eval(
    `Object.fromEntries(['CALC.EXE', 'NOTEPAD.EXE', 'WINMINE.EXE'].map(n => [n, [...${win}.querySelectorAll('[role="option"]')].find(o => o.getAttribute('aria-label') === n)?.querySelector('img').src]))`,
  )
  check(
    new Set(Object.values(programs)).size === 3 && !Object.values(programs).includes(autoexec),
    '27',
    "CALC.EXE, NOTEPAD.EXE, and WINMINE.EXE show their programs' icons",
  )
  await shot('27-windows-programs', await boxOf(win))
}

async function shortcut() {
  await fresh()
  const openSheet = async () => {
    await clickExpr(desktopItem('Minesweeper'), { button: 'right' })
    await pickMenu('Properties')
    await app.waitFor(`!!${dialog('Minesweeper Properties')}`)
    await clickExpr(`[...${dialog('Minesweeper Properties')}.querySelectorAll('[role="tab"]')][1]`)
  }
  const sheet = dialog('Minesweeper Properties')
  const field = (label) => `${sheet}.querySelector('input[aria-label=${q(label)}]')`
  const setField = async (label, value) => {
    await clickExpr(field(label))
    await app.key('a', ['Control'])
    await app.type(value)
  }
  await openSheet()
  await setField('Target', 'C:\\nothere.exe')
  await clickExpr(buttonIn(sheet, 'Apply'))
  await app.waitFor(`!!${dialog('Problem with Shortcut')}`)
  const invalid = await app.eval(`${dialog('Problem with Shortcut')}.innerText`)
  check(
    invalid.includes("The name 'C:\\nothere.exe' specified in the Target box is not valid."),
    'S',
    'an unknown Target is refused with the Windows 95 message',
    invalid,
  )
  await app.key('Enter')
  await setField('Target', 'C:\\WINDOWS\\NOTEPAD.EXE')
  await setField('Start in', 'C:\\My Documents')
  await clickExpr(`${sheet}.querySelector('[role="combobox"][aria-label="Run"]')`)
  await clickExpr(
    `[...document.querySelectorAll('[role="option"]')].find(o => o.textContent.trim() === 'Maximized')`,
  )
  await clickExpr(buttonIn(sheet, 'Change Icon...'))
  await app.waitFor(`!!${dialog('Change Icon')}`)
  await clickExpr(`${dialog('Change Icon')}.querySelector('[role="option"][aria-label="myComputer"]')`)
  await shot('S-change-icon', await dialogBox('Change Icon'))
  await clickExpr(buttonIn(dialog('Change Icon'), 'OK'))
  await shot('S-shortcut-tab-edited', await dialogBox('Minesweeper Properties'))
  await clickExpr(buttonIn(sheet, 'OK'))
  await sleep(400)
  const link = await app.eval(
    `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).find(n => n.name === 'Minesweeper' && n.parent === 'desktop')`,
  )
  check(
    link.app === 'notepad' &&
      link.startIn === 'C:\\My Documents' &&
      link.run === 'maximized' &&
      link.icon === 'myComputer',
    'S',
    'OK re-points the shortcut to NOTEPAD.EXE and saves Start in, Run, and the icon',
    link,
  )
  const icon = await app.eval(`${desktopItem('Minesweeper')}.querySelector('img').src`)
  const myComputer = await app.eval(`${desktopItem('My Computer')}.querySelector('img').src`)
  check(icon === myComputer, 'S', 'the desktop draws the shortcut with the chosen icon')
  await clickExpr(desktopItem('Minesweeper'), { count: 2 })
  await app.waitFor(`!!${windowNamed('Untitled - Notepad')}`)
  await sleep(500)
  const state = await app.eval(
    `(() => { const w = ${windowNamed('Untitled - Notepad')}; return { width: w.offsetWidth, screen: innerWidth } })()`,
  )
  check(state.width >= state.screen, 'S', 'the shortcut opens Notepad maximized', state)
  await shot('S-opens-maximized')
  await clickExpr(`${windowNamed('Untitled - Notepad')}.querySelector('button[aria-label="Close"]')`)
  await openSheet()
  const fields = await app.eval(
    `({ target: ${field('Target')}.value, startIn: ${field('Start in')}.value, run: ${sheet}.querySelector('[role="combobox"][aria-label="Run"]').textContent })`,
  )
  check(
    fields.target === 'C:\\WINDOWS\\NOTEPAD.EXE' &&
      fields.startIn === 'C:\\My Documents' &&
      fields.run === 'Maximized',
    'S',
    'reopening the sheet shows the saved target, Start in, and Run',
    fields,
  )
  await app.key('Escape')
}

const phases = { panes, explorer, sizes, deletion, bin, shared, tree, drive, options, icons, shortcut }
try {
  for (const [name, body] of Object.entries(phases)) if (phase === 'all' || phase === name) await body()
} finally {
  writeFileSync(join(proof, `checks-${phase}.json`), JSON.stringify(results, null, 2))
  app.close()
}
