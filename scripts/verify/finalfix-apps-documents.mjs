import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const port = process.argv[2] ?? '9450'
const proof = resolve(process.argv[3] ?? '../proof/finalfix-apps-documents')
const mode = process.argv[4] ?? 'all'
mkdirSync(proof, { recursive: true })
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((target) => target.type === 'page')
assert.ok(page?.url.startsWith('file:'), 'production Electron file target')
writeFileSync(
  join(proof, 'runtime-target.json'),
  JSON.stringify({ port, url: page.url, title: page.title }, null, 2),
)
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((done) => ws.addEventListener('open', done, { once: true }))
let serial = 0
const pending = new Map()
ws.addEventListener('message', ({ data }) => {
  const response = JSON.parse(data)
  pending.get(response.id)?.(response)
  pending.delete(response.id)
})
const send = (method, params = {}) =>
  new Promise((done) => {
    const id = ++serial
    pending.set(id, done)
    ws.send(JSON.stringify({ id, method, params }))
  })
const pause = (ms = 120) => new Promise((done) => setTimeout(done, ms))
const evaluate = async (expression) => {
  const response = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  assert.ok(!response.result.exceptionDetails, JSON.stringify(response.result.exceptionDetails))
  return response.result.result.value
}
const top = `[...document.querySelectorAll('[data-window]')].filter(e=>!e.classList.contains('hidden')).sort((a,b)=>Number(b.style.zIndex)-Number(a.style.zIndex))[0]`
const dialog = `[...document.querySelectorAll('[role="dialog"]')].at(-1)`
const q = JSON.stringify
const button = (text, scope = top) =>
  `[...(${scope}).querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')||e.textContent.trim())===${q(text)})`
const click = async (expression, clickCount = 1) => {
  const rect = await evaluate(
    `(()=>{const e=${expression};if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  )
  assert.ok(rect, `element exists: ${expression}`)
  for (let i = 1; i <= clickCount; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...rect,
      button: 'left',
      buttons: 1,
      clickCount: i,
    })
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...rect,
      button: 'left',
      buttons: 0,
      clickCount: i,
    })
  }
  await pause()
}
const key = async (name, modifiers = 0) => {
  const vk =
    {
      Enter: 13,
      Escape: 27,
      Tab: 9,
      F1: 112,
      F4: 115,
      F5: 116,
      Home: 36,
      End: 35,
      Delete: 46,
      ArrowDown: 40,
      ArrowRight: 39,
    }[name] ?? name.toUpperCase().charCodeAt(0)
  const base = {
    key: name,
    code: name.length === 1 ? `Key${name.toUpperCase()}` : name,
    windowsVirtualKeyCode: vk,
    modifiers,
  }
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  await pause()
}
const type = async (text) => {
  await send('Input.insertText', { text })
  await pause()
}
const shot = async (name) => {
  await pause()
  const response = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(proof, `${name}.png`), Buffer.from(response.result.data, 'base64'))
}
const rows = []
const check = async (name, value, expected = true) => {
  rows.push({ name, value, expected })
  writeFileSync(join(proof, `${mode}-checks.json`), JSON.stringify(rows, null, 2))
  assert.deepEqual(value, expected, name)
  console.log(`PASS ${name}`)
}
const run = async (command) => {
  await click(`document.querySelector('[data-taskbar] button')`)
  await click(`[...document.querySelectorAll('[role="menuitem"]')].find(e=>e.innerText.trim()==='Run...')`)
  await type(command)
  await key('Enter')
  await pause(500)
}
const menu = async (title, label) => {
  await click(
    `[...(${top}).querySelectorAll('[role="menubar"] button')].find(e=>e.textContent.trim()===${q(title)})`,
  )
  await click(
    `[...document.querySelectorAll('[role="menuitem"]')].find(e=>e.children[1]?.textContent.trim()===${q(label)})`,
  )
}
const reset = async () => {
  await evaluate(`addEventListener('beforeunload',()=>localStorage.clear(),{once:true});localStorage.clear()`)
  await send('Page.reload')
  await pause(6000)
}
const persisted = () => evaluate(`JSON.parse(localStorage.getItem('w95.fs.v1'))`)
const drag = async (x, y, endX, endY) => {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })
  for (let i = 1; i <= 10; i++) {
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: x + ((endX - x) * i) / 10,
      y: y + ((endY - y) * i) / 10,
      button: 'left',
      buttons: 1,
    })
    await pause(20)
  }
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: endX,
    y: endY,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
  await pause()
}
const imagePixels = () =>
  evaluate(
    `Promise.all([...document.querySelectorAll('[contenteditable] img')].map(async img=>{await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d');g.drawImage(img,0,0);const data=g.getImageData(0,0,c.width,c.height).data;let colored=0,hash=2166136261;for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619)>>>0;if(i%4===0&&data[i]<240)colored++}return {width:c.width,height:c.height,colored,hash}}))`,
  )
const saveAs = async (name) => {
  await menu('File', 'Save As...')
  await click(`(${dialog}).querySelector('input[id$="-name"]')`)
  await key('a', 2)
  await type(name)
  await click(button('Save', dialog))
  await pause(450)
}
const openFile = async (name) => {
  await key('o', 2)
  await type(name)
  await key('Enter')
  await pause(400)
}
const fill = async (expression, value) => {
  await click(expression)
  await key('a', 2)
  await type(value)
}
const applet = async (name) => {
  await run('control')
  await click(`[...(${top}).querySelectorAll('.explorer-item')].find(e=>e.innerText.trim()===${q(name)})`, 2)
}
const chooseOption = async (text) => {
  const scroll = await evaluate(
    `(()=>{const list=[...document.querySelectorAll('[role="listbox"]')].at(-1);const option=[...list.querySelectorAll('[role="option"]')].find(e=>e.textContent.includes(${q(text)}));if(!option)return null;const r=list.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,deltaY:option.offsetTop-list.scrollTop-4}})()`,
  )
  assert.ok(scroll, `option ${text} exists`)
  await send('Input.dispatchMouseEvent', { type: 'mouseWheel', ...scroll, deltaX: 0 })
  await pause(250)
  await click(`[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.includes(${q(text)}))`)
}
const close = async () => {
  await click(button('Close'))
  await pause()
}
const nodeNamed = async (name) => Object.values((await persisted()).nodes).find((node) => node.name === name)
const lockFile = async (name) => {
  await run('find')
  await type(name)
  await click(button('Find Now'))
  await pause(350)
  await click(`(${top}).querySelector('tbody tr')`)
  await menu('File', 'Properties')
  await click(`[...(${dialog}).querySelectorAll('label')].find(e=>e.textContent.includes('Read-only'))`)
  await click(button('OK', dialog))
  await close()
  await pause(300)
  await check(`${name} locked through Properties`, (await nodeNamed(name)).attributes.readOnly)
}
const readonlyScenario = async () => {
  await reset()
  await run('notepad')
  await type('original protected text')
  await saveAs('readonly.txt')
  const original = await nodeNamed('readonly.txt')
  await lockFile('readonly.txt')
  await click(`document.querySelector('textarea')`)
  await key('End', 2)
  await type(' recovered edit')
  await key('s', 2)
  await check(
    'Notepad visibly rejects read-only Save',
    await evaluate(`(${dialog}).innerText.includes('read-only')`),
  )
  await shot('after-notepad-readonly-save')
  await click(button('OK', dialog))
  await check(
    'persisted original text and timestamp unchanged',
    {
      content: (await nodeNamed('readonly.txt')).content,
      modified: (await nodeNamed('readonly.txt')).modified,
    },
    { content: original.content, modified: original.modified },
  )
  await close()
  await check(
    'Notepad rejected Save keeps unsaved changes',
    await evaluate(`(${dialog}).innerText.includes('save') || (${dialog}).innerText.includes('Save')`),
  )
  await click(button('Cancel', dialog))
  await saveAs('recovered.txt')
  await check(
    'Notepad Save As recovers the unsaved edit',
    (await nodeNamed('recovered.txt')).content,
    'original protected text recovered edit',
  )
  await close()
  await run('wordpad')
  await type('protected rich text')
  await saveAs('readonly.rtf')
  const rich = await nodeNamed('readonly.rtf')
  await lockFile('readonly.rtf')
  await click(`document.querySelector('[contenteditable]')`)
  await key('End', 2)
  await type(' recovered rich edit')
  await key('s', 2)
  await check(
    'WordPad visibly rejects read-only Save',
    await evaluate(`(${dialog}).innerText.includes('read-only')`),
  )
  await shot('after-wordpad-readonly-save')
  await click(button('OK', dialog))
  await check('persisted original RTF unchanged', (await nodeNamed('readonly.rtf')).content, rich.content)
  await close()
  await check(
    'WordPad rejected Save keeps unsaved changes',
    await evaluate(`(${dialog}).innerText.includes('Save changes')`),
  )
  await click(button('Cancel', dialog))
  await saveAs('recovered.rtf')
  await check(
    'WordPad Save As recovers unsaved rich edit',
    (await nodeNamed('recovered.rtf')).content.includes('recovered rich edit'),
  )
  await close()
  await run('mspaint')
  await saveAs('readonly.bmp')
  const bmp = await nodeNamed('readonly.bmp')
  await lockFile('readonly.bmp')
  const canvas = await evaluate(`(${top}).querySelector('canvas').getBoundingClientRect().toJSON()`)
  await drag(canvas.x + 15, canvas.y + 15, canvas.x + 85, canvas.y + 55)
  await key('s', 2)
  await check(
    'Paint visibly rejects read-only Save',
    await evaluate(`(${dialog}).innerText.includes('read-only')`),
  )
  await shot('after-paint-readonly-save')
  await click(button('OK', dialog))
  await check('persisted original bitmap unchanged', (await nodeNamed('readonly.bmp')).content, bmp.content)
  await close()
  await check(
    'Paint rejected Save keeps unsaved drawing',
    await evaluate(`(${dialog}).innerText.includes('Save changes')`),
  )
  await click(button('Cancel', dialog))
  await saveAs('recovered.bmp')
  await check(
    'Paint Save As recovers unsaved drawing',
    (await nodeNamed('recovered.bmp')).content !== bmp.content,
  )
  await close()
  await run('command')
  await type('echo replacement > "C:\\My Documents\\readonly.txt"')
  await key('Enter')
  await check(
    'DOS redirection displays Access denied',
    await evaluate(`(${top}).innerText.includes('Access denied')`),
  )
  await type('copy "C:\\My Documents\\recovered.txt" "C:\\My Documents\\readonly.txt"')
  await key('Enter')
  await check(
    'DOS COPY leaves read-only text unchanged',
    (await nodeNamed('readonly.txt')).content,
    original.content,
  )
  await shot('after-dos-readonly')
}
const clockScenario = async () => {
  await reset()
  await applet('Date/Time')
  await click(`[...document.querySelectorAll('[role="tab"]')].find(e=>e.textContent.trim()==='Time Zone')`)
  await click(`document.querySelector('[aria-label="Time zone"]')`)
  await chooseOption('Hong Kong')
  await click(`[...document.querySelectorAll('[role="tab"]')].find(e=>e.textContent.trim()==='Date & Time')`)
  await fill(`document.querySelector('[aria-label="Year"]')`, '1995')
  await click(`document.querySelector('[aria-label="Month"]')`)
  await click(`[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()==='August')`)
  await click(`document.querySelector('[aria-label="Day 24"]')`)
  await fill(`document.querySelector('[aria-label="Time"]')`, '01:05:00 PM')
  await key('Tab')
  await click(button('OK', dialog))
  await shot('after-clock-set-1995')
  await close()
  await run('notepad')
  await key('F5')
  const stamp = await evaluate(`document.querySelector('textarea').value`)
  await check('Notepad F5 uses virtual 1995 and U.S. short date', stamp, '1:05 PM 8/24/95')
  await saveAs('clock.txt')
  const file = await nodeNamed('clock.txt')
  await check('newly saved file uses virtual timestamp', new Date(file.modified).getUTCFullYear(), 1995)
  await shot('after-notepad-virtual-date')
  await close()
  await run('find')
  await type('clock.txt')
  await click(button('Find Now'))
  await pause(300)
  await check(
    'Find Modified includes shared date and time',
    await evaluate(`(${top}).querySelector('tbody tr').textContent.includes('8/24/95 1:05 PM')`),
  )
  await shot('after-find-virtual-modified')
  await close()
  await applet('Regional Settings')
  await click(`[...document.querySelectorAll('[role="tab"]')].find(e=>e.textContent.trim()==='Date')`)
  await click(`[...(${dialog}).querySelectorAll('[role="combobox"]')].at(-1)`)
  await click(
    `[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()==='dd/MM/yyyy')`,
  )
  await click(button('OK', dialog))
  await close()
  await run('notepad')
  await key('F5')
  await check(
    'Notepad uses changed regional date',
    await evaluate(`document.querySelector('textarea').value`),
    '1:05 PM 24/08/1995',
  )
  await key('a', 2)
  await type('.LOG')
  await saveAs('journal.txt')
  await close()
  await run('notepad')
  await openFile('journal.txt')
  const log = await evaluate(
    `(()=>{const e=document.querySelector('textarea');return {text:e.value,start:e.selectionStart,end:e.selectionEnd}})()`,
  )
  await check('.LOG load appends virtual regional stamp', log.text, '.LOG\n1:05 PM 24/08/1995\n')
  await check('.LOG caret starts after timestamp', [log.start, log.end], [log.text.length, log.text.length])
  await shot('after-notepad-log-loaded')
  await close()
  await check(
    '.LOG appended timestamp remains dirty',
    await evaluate(`(${dialog}).innerText.includes('save') || (${dialog}).innerText.includes('Save')`),
  )
  await click(button('Cancel', dialog))
  await key('s', 2)
  await pause(400)
  await check(
    '.LOG Save persists appended timestamp',
    (await nodeNamed('journal.txt')).content,
    '.LOG\r\n1:05 PM 24/08/1995\r\n',
  )
  await close()
  await run('find')
  await type('clock.txt')
  await click(button('Find Now'))
  await pause(300)
  await check(
    'Find uses changed region without changing persisted timestamp',
    await evaluate(`(${top}).querySelector('tbody tr').textContent.includes('24/08/1995 1:05 PM')`),
  )
  await shot('after-find-regional-modified')
  await close()
  await applet('Date/Time')
  await click(`[...document.querySelectorAll('[role="tab"]')].find(e=>e.textContent.trim()==='Time Zone')`)
  await click(`document.querySelector('[aria-label="Time zone"]')`)
  await chooseOption('Monrovia')
  await click(button('OK', dialog))
  await check(
    'Date/Time persists configured UTC zone',
    await evaluate(`JSON.parse(localStorage.getItem('win95.settings.v1')).timeZone`),
    'UTC',
  )
  await close()
  await run('notepad')
  await key('F5')
  await check(
    'Notepad applies configured time zone to virtual time',
    await evaluate(`document.querySelector('textarea').value`),
    '5:05 AM 24/08/1995',
  )
  await shot('after-notepad-utc-zone')
  await close()
  await click(button('No', dialog))
  await run('wordpad')
  await menu('Insert', 'Date and Time...')
  await check(
    'WordPad date chooser uses virtual 1995 in configured zone',
    await evaluate(`(${dialog}).innerText.includes('1995') && (${dialog}).innerText.includes('5:05')`),
  )
  await shot('after-wordpad-virtual-date')
  writeFileSync(
    join(proof, 'clock-persisted-state.json'),
    JSON.stringify(
      {
        file: await nodeNamed('clock.txt'),
        log: await nodeNamed('journal.txt'),
        settings: await evaluate(`JSON.parse(localStorage.getItem('win95.settings.v1'))`),
      },
      null,
      2,
    ),
  )
  await click(button('Cancel', dialog))
  await close()
  await run('C:\\My Documents')
  await click(`document.querySelector('[data-node-id="${file.id}"]')`)
  await key('c', 2)
  const beforeCopy = Object.keys((await persisted()).nodes)
  await key('v', 2)
  await pause(400)
  const copied = Object.values((await persisted()).nodes).find(
    (node) => node.kind === 'file' && !beforeCopy.includes(node.id),
  )
  await check(
    'FolderView copy uses virtual filesystem timestamp',
    new Date(copied.created ?? copied.modified).getUTCFullYear(),
    1995,
  )
  await menu('File', 'Create Shortcut')
  await pause(400)
  const shortcut = Object.values((await persisted()).nodes).find(
    (node) => node.kind === 'shortcut' && node.target === copied.id,
  )
  await check(
    'FolderView shortcut uses virtual filesystem timestamp',
    new Date(shortcut.modified).getUTCFullYear(),
    1995,
  )
  await click(`document.querySelector('[data-node-id="${copied.id}"]')`)
  await key('x', 2)
  await key('m', 4)
  await pause(600)
  await click(`document.querySelector('[data-desktop]')`)
  await key('v', 2)
  await pause(400)
  const moved = (await persisted()).nodes[copied.id]
  await check(
    'Desktop paste move uses virtual filesystem timestamp',
    new Date(moved.modified).getUTCFullYear(),
    1995,
  )
  await check('Desktop paste moves to Desktop', moved.parent, 'desktop')
  await key('z', 2)
  await pause(400)
  const undone = (await persisted()).nodes[copied.id]
  await check(
    'Desktop Undo uses virtual filesystem timestamp',
    new Date(undone.modified).getUTCFullYear(),
    1995,
  )
  await check('Desktop Undo restores source folder', undone.parent, file.parent)
  await run('C:\\My Documents')
  await menu('File', 'New')
  await click(
    `[...document.querySelectorAll('[role="menuitem"]')].find(e=>e.children[1]?.textContent.trim()==='Folder')`,
  )
  await type('Clock folder')
  await key('Enter')
  await pause(400)
  const folder = await nodeNamed('Clock folder')
  const dragSource = await evaluate(
    `(${top}).querySelector('[data-node-id="${copied.id}"]').getBoundingClientRect().toJSON()`,
  )
  const dragTarget = await evaluate(
    `(${top}).querySelector('[data-node-id="${folder.id}"]').getBoundingClientRect().toJSON()`,
  )
  await drag(
    dragSource.x + dragSource.width / 2,
    dragSource.y + dragSource.height / 2,
    dragTarget.x + dragTarget.width / 2,
    dragTarget.y + dragTarget.height / 2,
  )
  await pause(400)
  const dragged = (await persisted()).nodes[copied.id]
  await check('file drag moves into the selected folder', dragged.parent, folder.id)
  await check(
    'file drag uses virtual filesystem timestamp',
    new Date(dragged.modified).getUTCFullYear(),
    1995,
  )
  await key('z', 2)
  await pause(400)
  await check(
    'FolderView Undo uses virtual filesystem timestamp',
    new Date((await persisted()).nodes[copied.id].modified).getUTCFullYear(),
    1995,
  )
  await shot('after-filesystem-virtual-mutations')
  writeFileSync(join(proof, 'mutation-persisted-state.json'), JSON.stringify(await persisted(), null, 2))
}
const helpScenario = async () => {
  await reset()
  await run('winhlp32')
  await check(
    'Help Topics has fixed dialog caption',
    await evaluate(`!!(${button('Help')}) && !(${button('Maximize')})`),
  )
  await key('F1')
  await check(
    'Help Topics F1 keeps Topics open',
    await evaluate(`(${top}).getAttribute('aria-label').startsWith('Help Topics:')`),
  )
  await click(button('Help'))
  await check(
    'Help Topics preserves caption context Help',
    await evaluate(`(${dialog}).innerText.includes('Click Contents')`),
  )
  await click(button('OK', dialog))
  await click(
    `[...(${top}).querySelectorAll('[role="treeitem"]')].find(e=>e.textContent.trim()==='Introducing Windows')`,
    2,
  )
  await click(
    `[...(${top}).querySelectorAll('[role="treeitem"]')].find(e=>e.textContent.trim()==='Welcome to Windows')`,
    2,
  )
  await check('opened Help topic enables Maximize', await evaluate(`!(${button('Maximize')}).disabled`))
  const frame = await evaluate(`(${top}).getBoundingClientRect().toJSON()`)
  await drag(frame.right - 2, frame.bottom - 2, frame.right + 110, frame.bottom + 70)
  const larger = await evaluate(`(${top}).getBoundingClientRect().toJSON()`)
  await check(
    'Help topic resizes through frame drag',
    larger.width > frame.width + 80 && larger.height > frame.height + 40,
  )
  await shot('after-help-topic-resized')
  await click(button('Maximize'))
  await pause(600)
  await check(
    'Help topic reaches the maximized desktop bounds',
    await evaluate(
      `(${top}).getBoundingClientRect().width >= innerWidth && (${top}).getBoundingClientRect().height > innerHeight - 50`,
    ),
  )
  await check(
    'Help topic content fills maximized client',
    await evaluate(
      `(()=>{const a=document.querySelector('article'),w=${top};return a.clientWidth>w.clientWidth-30&&a.clientHeight>w.clientHeight-90})()`,
    ),
  )
  await shot('after-help-topic-maximized')
  await click(button('Help Topics'))
  await check(
    'Help Topics returns to fixed presentation',
    await evaluate(
      `!!(${button('Help')}) && !(${button('Maximize')}) && (${top}).getBoundingClientRect().width < 510`,
    ),
  )
  await shot('after-help-topics-fixed')
}
const charmapScenario = async () => {
  await reset()
  await run('charmap')
  await click(button('Close'))
  await run('charmap')
  await key('s', 1)
  await check(
    'Character Map Alt+S works from initial font focus',
    await evaluate(`(${top}).querySelector('input').value`),
    'A',
  )
  await key('a', 1)
  await check('Alt+A focuses copy field', await evaluate(`document.activeElement.tagName==='INPUT'`))
  await type(' typed')
  await check(
    'copy field typing is preserved',
    await evaluate(`(${top}).querySelector('input').value`),
    'A typed',
  )
  await key('c', 1)
  await check('Alt+C copies characters', await evaluate(`navigator.clipboard.readText()`), 'A typed')
  await key('f', 1)
  await check(
    'Alt+F focuses Font',
    await evaluate(`document.activeElement.getAttribute('aria-label')==='Font'`),
  )
  await shot('after-charmap-accelerators')
  await key('h', 1)
  await check(
    'Alt+H opens Character Map Help',
    await evaluate(`(${top}).getAttribute('aria-label')`),
    'Help Topics: Character Map Help',
  )
  await shot('after-charmap-help')
}
const pictureScenario = async (baseline = false) => {
  await reset()
  await run('mspaint')
  const canvas = await evaluate(`(${top}).querySelector('canvas').getBoundingClientRect().toJSON()`)
  await drag(canvas.x + 20, canvas.y + 20, canvas.x + 120, canvas.y + 75)
  await key('l', 2)
  await key('c', 2)
  await pause(300)
  await shot(`${baseline ? 'before' : 'after'}-paint-source`)
  await run('wordpad')
  await click(`document.querySelector('[contenteditable]')`)
  await key('v', 2)
  await pause(250)
  const keyboard = await imagePixels()
  await shot(`${baseline ? 'before' : 'after'}-wordpad-keyboard-paste`)
  if (!baseline)
    await check('keyboard imports Paint PNG pixels', keyboard.length === 1 && keyboard[0].colored > 30)
  await menu('Edit', 'Paste')
  await pause(250)
  const both = await imagePixels()
  await shot(`${baseline ? 'before' : 'after'}-wordpad-menu-paste`)
  if (!baseline) await check('Edit Paste imports the same Paint pixels', both, [keyboard[0], keyboard[0]])
  await saveAs('picture.rtf')
  const file = Object.values((await persisted()).nodes).find((node) => node.name === 'picture.rtf')
  writeFileSync(join(proof, `${baseline ? 'before' : 'after'}-picture.rtf`), file.content)
  if (!baseline) {
    await check('persisted file contains RTF PNG groups', file.content.split('\\pngblip').length - 1, 2)
    await check(
      'persisted file is RTF without HTML substitute',
      file.content.startsWith('{\\rtf1') && !file.content.includes('<img'),
    )
  }
  await key('F4', 1)
  await run('wordpad')
  await openFile('picture.rtf')
  const reopened = await imagePixels()
  await shot(`${baseline ? 'before' : 'after'}-picture-reopened`)
  if (baseline)
    console.log(
      'BASELINE image counts',
      JSON.stringify({
        keyboard: keyboard.length,
        menu: both.length,
        reopened: reopened.length,
        rtfBytes: file.content.length,
      }),
    )
  else await check('Paint pixels survive Save, close, Open', reopened, both)
  await send('Page.reload')
  await pause(6000)
  await run('wordpad')
  await openFile('picture.rtf')
  const reloaded = await imagePixels()
  await shot(`${baseline ? 'before' : 'after'}-picture-renderer-reload`)
  if (!baseline) await check('Paint pixels survive renderer reload and Open', reloaded, both)
}
try {
  if (mode === 'inspect')
    console.log(
      await evaluate(
        `({settings:JSON.parse(localStorage.getItem('win95.settings.v1')),body:document.body.innerText.slice(-1800),lists:[...document.querySelectorAll('[role=listbox]')].map(e=>({html:e.outerHTML.slice(0,500),text:e.textContent})),options:[...document.querySelectorAll('[role=option]')].map(e=>e.textContent)})`,
      ),
    )
  if (mode === 'inspect') await shot('inspect-state')
  if (mode === 'pictures' || mode === 'all' || mode === 'baseline-pictures')
    await pictureScenario(mode === 'baseline-pictures')
  if (mode === 'readonly' || mode === 'all') await readonlyScenario()
  if (mode === 'clock' || mode === 'all') await clockScenario()
  if (mode === 'help' || mode === 'all') await helpScenario()
  if (mode === 'charmap' || mode === 'all') await charmapScenario()
  if (mode === 'all')
    writeFileSync(join(proof, 'final-persisted-state.json'), JSON.stringify(await persisted(), null, 2))
  if (mode === 'baseline') {
    await reset()
    await run('notepad')
    await key('F5')
    await shot('before-notepad-host-date')
    console.log('BASELINE notepad date', await evaluate(`document.querySelector('textarea').value`))
    await key('F4', 1)
    await click(button('No', dialog))
    await run('charmap')
    await key('s', 1)
    await shot('before-charmap-alt-s')
    console.log('BASELINE Alt+S value', await evaluate(`(${top}).querySelector('input').value`))
    await key('F4', 1)
    await run('winhlp32')
    console.log('BASELINE Help frame', await evaluate(`(${top}).outerHTML.slice(0,500)`))
    await shot('before-help-topics')
  }
} finally {
  ws.close()
}
