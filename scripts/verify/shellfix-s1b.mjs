import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const proof = resolve(process.env.W95_PROOF_DIR ?? '../proof/shellfix-s1b')
mkdirSync(proof, { recursive: true })
const port = process.env.W95_CDP_PORT ?? '9330'
let page
for (let attempt = 0; attempt < 40; attempt++) {
  try {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    page = targets.find((target) => target.type === 'page')
    if (page) break
  } catch {}
  await new Promise((done) => setTimeout(done, 100))
}
assert.ok(page, 'Electron renderer target exists')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((done) => ws.addEventListener('open', done, { once: true }))
let sequence = 0
const pending = new Map()
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'Runtime.exceptionThrown')
    process.stderr.write(
      `${message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text}\n`,
    )
  const result = pending.get(message.id)
  if (result) {
    pending.delete(message.id)
    message.error ? result.reject(message.error) : result.resolve(message.result)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails)
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
  return result.result.value
}
async function wait(expression) {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`Boolean(${expression})`)) return
    await sleep(50)
  }
  throw new Error(`Timed out: ${expression}`)
}
async function rect(selector) {
  return evaluate(`document.querySelector(${JSON.stringify(selector)})?.getBoundingClientRect().toJSON()`)
}
async function mouse(type, x, y, button = 'left', count = 1) {
  await send('Input.dispatchMouseEvent', {
    type,
    x,
    y,
    button,
    buttons: type === 'mouseReleased' ? 0 : type === 'mouseMoved' ? 0 : button === 'right' ? 2 : 1,
    clickCount: count,
  })
}
async function click(selector, button = 'left', count = 1) {
  await evaluate(
    `document.querySelector(${JSON.stringify(selector)})?.scrollIntoView({block:'nearest',inline:'nearest'})`,
  )
  if (selector === '[data-start-button]') {
    const point = await evaluate(
      `(()=>{const e=document.querySelector('[data-taskbar]')?.dataset.edge;return e==='left'?[1,300]:e==='right'?[innerWidth-1,300]:e==='top'?[20,1]:[20,innerHeight-1]})()`,
    )
    await mouse('mouseMoved', point[0], point[1])
    await sleep(160)
  }
  const box = await rect(selector)
  assert.ok(box, `Found ${selector}`)
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await mouse('mouseMoved', x, y)
  for (let n = 1; n <= count; n++) {
    await mouse('mousePressed', x, y, button, n)
    await mouse('mouseReleased', x, y, button, n)
  }
  await sleep(60)
}
async function named(role, text) {
  const selector = await evaluate(
    `(()=>{const es=[...document.querySelectorAll(${JSON.stringify(role === 'button' ? 'button' : role === 'label' ? 'label' : '[role="menuitem"]')})]; const e=es.find(e=>{const b=e.getBoundingClientRect();const hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);const label=${role === 'menuitem'} ? e.querySelector('span.flex-1')?.textContent.trim() : e.textContent.trim();return b.width && label===${JSON.stringify(text)} && (e===hit || e.contains(hit))});if(!e)return null;e.dataset.proofTarget='pick';return '[data-proof-target="pick"]'})()`,
  )
  assert.ok(selector, `Found ${role} ${text}`)
  await click(selector)
  await evaluate(`document.querySelector('[data-proof-target="pick"]')?.removeAttribute('data-proof-target')`)
}
const keyCodes = {
  Alt: 18,
  Tab: 9,
  Enter: 13,
  Escape: 27,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
  ' ': 32,
  F4: 115,
  F10: 121,
  F11: 122,
  Control: 17,
}
async function keyEvent(type, key, modifiers = 0) {
  await send('Input.dispatchKeyEvent', {
    type,
    key,
    windowsVirtualKeyCode: keyCodes[key] ?? key.toUpperCase().charCodeAt(0),
    code:
      key === 'Alt'
        ? 'AltLeft'
        : key === 'Control'
          ? 'ControlLeft'
          : key.length === 1 && /[a-z]/i.test(key)
            ? `Key${key.toUpperCase()}`
            : key,
    modifiers,
    ...(type === 'keyDown' && key.length === 1 && !modifiers
      ? { text: key }
      : type === 'keyDown' && key === 'Enter'
        ? { text: '\r' }
        : {}),
  })
}
async function key(key, modifiers = 0) {
  await keyEvent('keyDown', key, modifiers)
  await keyEvent('keyUp', key, modifiers)
  await sleep(50)
}
async function fill(selector, text) {
  if (!(await evaluate(`document.activeElement === document.querySelector(${JSON.stringify(selector)})`)))
    await click(selector)
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).select()`)
  await send('Input.insertText', { text })
  await sleep(50)
}
async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(proof, `${name}.png`), Buffer.from(result.data, 'base64'))
}
const results = []
async function check(expression, name) {
  assert.ok(await evaluate(expression), name)
  results.push({ name, expression })
  process.stdout.write(`PASS ${name}\n`)
}
async function reset() {
  await evaluate(`localStorage.removeItem('w95.taskbar.v1');globalThis.proofBeforeReload=true`)
  await send('Page.reload')
  await wait(`!globalThis.proofBeforeReload && document.querySelector('[data-start-button]')`)
}
async function run(command) {
  await click('[data-start-button]')
  await named('menuitem', 'Run...')
  await fill('#run-command', command)
  await named('button', 'OK')
}
async function shutdown(restart = false) {
  await click('[data-start-button]')
  await named('menuitem', 'Shut Down...')
  if (restart) await click('input[type="radio"][value="restart"]')
  await named('button', 'Yes')
}

async function startFolder(name) {
  await click('[aria-label="Start menu folder"]')
  const selector = await evaluate(
    `(()=>{const field=document.querySelector('[aria-label="Start menu folder"]');const list=document.getElementById(field.getAttribute('aria-controls'));const row=[...list.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim().endsWith(${JSON.stringify(name)}));if(!row)return null;row.dataset.proofTarget='folder';return '[data-proof-target="folder"]'})()`,
  )
  assert.ok(selector, `Start menu folder ${name}`)
  await click(selector)
}

const phase = process.argv[2] ?? 'close'
try {
  await send('Runtime.enable')
  await reset()
  if (phase === 'close') {
    await run('notepad')
    await fill('textarea', 'first dirty document')
    await run('notepad')
    await fill('[data-window="2"] textarea', 'second dirty document')
    await shutdown()
    await wait(`document.querySelector('[role="dialog"][aria-label="Notepad"]')`)
    await shot('close-top-first')
    await check(
      `document.querySelector('[data-window="2"] [role="dialog"]') !== null`,
      'Shutdown asks the top owner first',
    )
    await named('button', 'Cancel')
    await check(
      `document.querySelectorAll('[data-window]').length === 2 && !document.querySelector('[role="status"]')`,
      'Cancel aborts shutdown without closing either document',
    )
    await shutdown()
    await named('button', 'No')
    await wait(`document.querySelectorAll('[data-window]').length === 1`)
    await named('button', 'Cancel')
    await check(
      `document.querySelector('textarea').value === 'first dirty document'`,
      'Discard one then Cancel retains the next document',
    )
    await shutdown()
    await named('button', 'Yes')
    await wait(`document.querySelector('[aria-label="Save As"]')`)
    await named('button', 'Cancel')
    await shot('close-save-as-cancel')
    await check(
      `document.querySelector('textarea').value === 'first dirty document' && !document.querySelector('[role="status"]')`,
      'Save As Cancel aborts shutdown',
    )
    await key('F4', 1)
    await wait(`document.querySelector('[role="dialog"][aria-label="Notepad"]')`)
    await named('button', 'Yes')
    await fill('input[id$="-name"]', 's1b-saved.txt')
    await named('button', 'Save')
    if (await evaluate(`document.body.textContent.includes('Do you want to replace it?')`))
      await named('button', 'Yes')
    await wait(`document.querySelectorAll('[data-window]').length === 0`)
    await wait(
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).some(n=>n.name==='s1b-saved.txt' && n.content==='first dirty document')`,
    )
    await check(
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).some(n=>n.name==='s1b-saved.txt' && n.content==='first dirty document')`,
      'Alt+F4 saves then closes through the app contract',
    )
    await run('notepad')
    await fill('textarea', 'owner being queried')
    await shutdown()
    await wait(`document.querySelector('[role="dialog"][aria-label="Notepad"]')`)
    await run('notepad')
    await fill('[data-window="4"] textarea', 'opened during shutdown')
    await click('[data-task="3"]')
    await named('button', 'No')
    await wait(`document.querySelector('[data-window="4"] [role="dialog"][aria-label="Notepad"]')`)
    await shot('shutdown-new-owner')
    await named('button', 'Cancel')
    await check(
      `document.querySelector('textarea').value==='opened during shutdown' && !document.querySelector('[role="status"]')`,
      'A window opened during shutdown is queried and can cancel shutdown',
    )
    await click('[data-window] button[aria-label="Close"]')
    await named('button', 'No')
    await run('mspaint')
    await wait(`document.querySelector('canvas')`)
    const canvas = await rect('canvas')
    await mouse('mousePressed', canvas.x + 20, canvas.y + 20)
    await mouse('mouseReleased', canvas.x + 20, canvas.y + 20)
    await click('[data-window] button[aria-label="Close"]')
    await wait(`document.querySelector('[role="dialog"][aria-label="Paint"]')`)
    await shot('paint-close-prompt')
    await named('button', 'Cancel')
    await shutdown()
    await wait(`document.querySelector('[role="dialog"][aria-label="Paint"]')`)
    await named('button', 'Yes')
    await wait(`document.querySelector('[aria-label="Save As"]')`)
    await named('button', 'Cancel')
    await check(
      `document.querySelector('[data-window][aria-label$="Paint"]') !== null && !document.querySelector('[role="status"]')`,
      'Paint Close and shutdown honor Cancel through Save As',
    )
    await shutdown()
    await named('button', 'No')
    await wait(`document.querySelector('[role="status"]')`)
    await shot('shutdown-after-close')
    results.push({ name: 'Shutdown powers off only after Paint discards' })
  } else if (phase === 'menus') {
    await run('notepad')
    await fill('textarea', 'menu input stays here')
    await key('e', 1)
    await wait(`document.querySelector('[role="menu"]')`)
    await key('q')
    await key('ArrowDown')
    await shot('menu-keyboard')
    await check(
      `document.querySelector('textarea').value === 'menu input stays here'`,
      'Active menus capture printable input and arrows',
    )
    await key('a')
    await wait(`!document.querySelector('[role="menu"]')`)
    await check(
      `document.querySelector('textarea').selectionEnd === 21 && document.querySelector('textarea').selectionStart === 0`,
      'Alt+E then A runs Select All',
    )
    await key('F10')
    await key('ArrowDown')
    await wait(`document.querySelector('[role="menu"]')`)
    await key('Escape')
    await check(
      `!document.querySelector('[role="menu"]') && document.querySelector('[role="menubar"] button').classList.contains('bg-select')`,
      'Escape from a bar dropdown leaves its title armed',
    )
    await key('Escape')
    await check(
      `document.activeElement === document.querySelector('textarea')`,
      'A second Escape leaves menu mode and restores the editor',
    )
    await click('[data-start-button]')
    await key('p')
    await key('a')
    await shot('start-keyboard-chain')
    await check(
      `document.querySelectorAll('[role="menu"]').length === 3`,
      'Start accelerators open Programs then Accessories',
    )
    await key('Escape')
    await check(
      `document.querySelectorAll('[role="menu"]').length === 2`,
      'Escape closes only the innermost Start submenu',
    )
    await key('Escape')
    await key('Escape')
    await check(
      `!document.querySelector('[role="menu"]') && document.activeElement.matches('[data-start-button]')`,
      'Escape from Start returns focus to Start',
    )
    await click('[data-task="1"]')
    await sleep(300)
    const file = await rect('[role="menubar"] button')
    await mouse('mousePressed', file.x + 12, file.y + 8)
    await sleep(60)
    const exit = await evaluate(
      `(()=>{const e=[...document.querySelectorAll('[role="menuitem"]')].find(e=>e.textContent.trim()==='Exit');return e.getBoundingClientRect().toJSON()})()`,
    )
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: exit.x + 30,
      y: exit.y + 8,
      button: 'left',
      buttons: 1,
    })
    await shot('menu-tracking')
    await mouse('mouseReleased', exit.x + 30, exit.y + 8)
    await wait(`document.querySelector('[role="dialog"][aria-label="Notepad"]')`)
    await check(
      `document.querySelector('[role="dialog"][aria-label="Notepad"]') !== null`,
      'Press File, drag and release Exit requests Close',
    )
    await named('button', 'No')
    const start = await rect('[data-start-button]')
    await evaluate(
      `globalThis.pointerProof=[]; for(const type of ['pointerdown','pointerup','click']) document.addEventListener(type,e=>globalThis.pointerProof.push({type,target:e.target.outerHTML?.slice(0,150)}),true)`,
    )
    await mouse('mousePressed', start.x + 20, start.y + 10)
    await sleep(60)
    const runRect = await evaluate(
      `(()=>{const e=[...document.querySelectorAll('[role="menuitem"]')].find(e=>e.textContent.trim()==='Run...');return e.getBoundingClientRect().toJSON()})()`,
    )
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: runRect.x + 60,
      y: runRect.y + 12,
      button: 'left',
      buttons: 1,
    })
    await mouse('mouseReleased', runRect.x + 60, runRect.y + 12)
    writeFileSync(
      join(proof, 'menu-pointer-events.json'),
      JSON.stringify(await evaluate('globalThis.pointerProof'), null, 2),
    )
    await wait(`document.querySelector('#run-command')`)
    await check(
      `document.querySelector('#run-command') !== null`,
      'Press Start, drag and release Run opens Run',
    )
  } else if (phase === 'windows') {
    await run('notepad')
    await fill('textarea', 'restore keyboard focus')
    const normal = await rect('[data-window]')
    await click('[data-desktop]')
    await click('[data-window="1"] > div:first-child')
    await check(
      `document.activeElement === document.querySelector('textarea')`,
      'Caption activation restores the last editor control',
    )
    await key(' ', 1)
    await wait(`document.querySelector('[role="menu"]')`)
    await shot('system-menu')
    await key('m')
    await key('ArrowRight')
    await shot('keyboard-move-outline')
    await key('Enter')
    await check(
      `document.querySelector('[data-window]').style.left === '40px'`,
      'System Move uses arrow keys and commits on Enter',
    )
    await key(' ', 1)
    await key('s')
    await key('ArrowRight')
    await key('Escape')
    await check(
      `document.querySelector('[data-window]').getBoundingClientRect().width === ${normal.width}`,
      'System Size Escape cancels its outline',
    )
    await key(' ', 1)
    await key('s')
    await key('ArrowRight')
    await key('Enter')
    await check(
      `document.querySelector('[data-window]').getBoundingClientRect().width === ${normal.width + 8}`,
      'System Size commits its client size on Enter',
    )
    await check(
      `getComputedStyle(document.querySelector('[data-window]')).paddingLeft === '4px'`,
      'Resizable frames have four pixel borders',
    )
    await click('[data-window] button[aria-label="Maximize"]')
    await shot('caption-zoom')
    await wait(`document.querySelector('[data-window]').style.left === '-4px'`)
    await shot('maximized-frame')
    await check(
      `document.querySelector('[data-window]').getBoundingClientRect().top === -4 && document.querySelector('[data-window]').getBoundingClientRect().height === document.querySelector('[data-desktop]').getBoundingClientRect().height + 8`,
      'Maximize hides the sizing frame outside the desktop',
    )
    await click('[data-window] button[aria-label="Restore"]')
    await sleep(300)
    await click('[data-window] button[aria-label="Minimize"]')
    await wait(`getComputedStyle(document.querySelector('[data-window]')).display === 'none'`)
    await click('[data-task="1"]')
    await wait(`getComputedStyle(document.querySelector('[data-window]')).display !== 'none'`)
    await check(
      `document.activeElement === document.querySelector('textarea')`,
      'Taskbar restore returns keyboard focus to the editor',
    )
    await click('[data-task="1"]', 'right')
    await shot('task-system-menu')
    await key('Escape')
    await run('calc')
    await click('[data-window="2"] > div:first-child > img')
    await shot('fixed-system-menu')
    await check(
      `[...document.querySelectorAll('[role="menuitem"]')].filter(e=>['Size','Maximize'].includes(e.textContent.trim())).every(e=>e.getAttribute('aria-disabled')==='true')`,
      'Fixed window system menu disables Size and Maximize',
    )
    await key('Escape')
    await click('[data-window="2"] > div:first-child > img', 'left', 2)
    await wait(`!document.querySelector('[data-window="2"]')`)
    await check(
      `!document.querySelector('[data-window="2"]')`,
      'Double-clicking the caption icon closes the window',
    )
    await run('calc')
    await keyEvent('keyDown', 'Alt', 1)
    await key('Tab', 1)
    await shot('alt-tab-held')
    await check(
      `document.querySelector('[aria-label="Task switcher"]') !== null`,
      'Held Alt+Tab displays the switcher',
    )
    await key('Tab', 9)
    await keyEvent('keyUp', 'Alt')
    await wait(`!document.querySelector('[aria-label="Task switcher"]')`)
    await check(
      `document.querySelector('[data-window="3"]').style.zIndex === '2'`,
      'Shift+Tab reverses and Alt release commits the selected task',
    )
  } else if (phase === 'dialogs') {
    await run('notepad')
    await fill('textarea', 'modal caption proof')
    await key('s', 2)
    await wait(`document.querySelector('[aria-label="Save As"]')`)
    await shot('modal-caption')
    await check(
      `getComputedStyle(document.querySelector('[data-window] > div:first-child')).backgroundColor === 'rgb(128, 128, 128)' && getComputedStyle(document.querySelector('[role="dialog"] > div:first-child')).backgroundColor === 'rgb(0, 0, 128)'`,
      'Only the focused modal caption is active',
    )
    const before = await rect('[role="dialog"]'),
      title = await rect('[role="dialog"] > div:first-child')
    await mouse('mousePressed', title.x + 70, title.y + 8)
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: title.x + 130,
      y: title.y + 48,
      button: 'left',
      buttons: 1,
    })
    await shot('dialog-outline')
    await check(
      `document.querySelector('[role="dialog"]').getBoundingClientRect().x === ${before.x} && document.querySelector('[data-outline]') !== null`,
      'Dialog dragging draws an outline while the box stays put',
    )
    await mouse('mouseReleased', title.x + 130, title.y + 48)
    await check(
      `document.querySelector('[role="dialog"]').getBoundingClientRect().x === ${before.x + 60}`,
      'Dialog moves only when the pointer releases',
    )
    await named('button', 'Cancel')
    await run('bogus')
    await shot('run-error-captions')
    await check(
      `[...document.querySelectorAll('[role="dialog"] > div:first-child')].filter(e=>getComputedStyle(e).backgroundColor==='rgb(0, 0, 128)').length === 1`,
      'A nested Run error deactivates the Run caption',
    )
    await named('button', 'OK')
    await check(
      `document.querySelector('[aria-label="Run"]').getBoundingClientRect().left === 4 && document.querySelector('[aria-label="Run"]').getBoundingClientRect().bottom === innerHeight-32`,
      'Run opens just above the bottom left Start button',
    )
    await click('[data-task="1"]')
    await check(
      `document.activeElement === document.querySelector('textarea')`,
      'Run leaves the taskbar and app interactive',
    )
    await click('[data-start-button]')
    await shot('run-and-start')
    await check(
      `document.querySelector('[aria-label="Start menu"]') !== null`,
      'Run leaves Start interactive',
    )
  } else if (phase === 'surfaces') {
    await click('[data-start-button]')
    await shot('start-complete')
    await check(
      `document.querySelector('[aria-label="Start menu"]').textContent.includes('Settings') && document.querySelector('[aria-label="Start menu"]').textContent.includes('Find') && document.querySelector('[aria-label="Start menu"]').textContent.includes('Help')`,
      'Start always shows Settings, Find and Help',
    )
    await key('s')
    await key('p')
    await wait(`document.querySelector('[aria-label="Windows"]')`)
    await shot('missing-program')
    await check(
      `document.body.textContent.includes("Cannot find the file 'printers'")`,
      'An unavailable Start program reports the missing program',
    )
    await named('button', 'OK')
    await run('calc')
    await click('[data-window] button[aria-label="Close"]')
    await click('[data-start-button]')
    await named('menuitem', 'Run...')
    await click('button[aria-label="Recent commands"]')
    await shot('run-history')
    await check(
      `document.querySelector('[role="menu"]').textContent.includes('calc')`,
      'Run history lists successful commands',
    )
    await key('Escape')
    await named('button', 'Browse...')
    await wait(`document.querySelector('[aria-label="Browse"]')`)
    await shot('run-browse')
    await check(
      `document.querySelector('[aria-label="Browse"]').textContent.includes('NOTEPAD.EXE')`,
      'Browse Programs lists installed executable nodes',
    )
    const program = await evaluate(
      `(()=>{const e=[...document.querySelectorAll('[aria-label="Browse"] [role="option"]')].find(e=>e.textContent==='NOTEPAD.EXE');e.dataset.proofTarget='program';return '[data-proof-target="program"]'})()`,
    )
    await click(program, 'left', 2)
    await check(
      `document.querySelector('#run-command').value === 'C:\\\\WINDOWS\\\\NOTEPAD.EXE'`,
      'Browse puts the executable path in Run',
    )
    await named('button', 'Browse...')
    await fill('#browse-name', 'NOTEPAD.EXE')
    await named('button', 'Open')
    await check(
      `document.querySelector('#run-command').value.endsWith('NOTEPAD.EXE') && !document.querySelector('[aria-label="Browse"]')`,
      'Browse accepts a typed executable name relative to its current folder',
    )
    await named('button', 'OK')
    await wait(`document.querySelector('textarea')`)
    await click('[data-start-button]')
    await key('s')
    await key('t')
    await wait(`document.querySelector('[aria-label="Taskbar Properties"]')`)
    await shot('taskbar-properties')
    await named('label', 'Show Clock')
    await named('button', 'Apply')
    await check(`!document.querySelector('[data-clock]')`, 'Show Clock applies to the real taskbar')
    await named('label', 'Auto hide')
    await named('button', 'Apply')
    await mouse('mouseMoved', 900, 300)
    await sleep(500)
    await check(
      `document.querySelector('[data-desktop]').getBoundingClientRect().bottom === innerHeight-2 && document.querySelector('[data-taskbar]').style.transform.includes('26px')`,
      'Auto hide leaves a two pixel strip and releases the work area',
    )
    await named('label', 'Always on top')
    await named('button', 'Apply')
    await check(
      `document.querySelector('[data-taskbar]').style.zIndex === '0'`,
      'Always on top changes the taskbar stacking',
    )
    await named('label', 'Show small icons in Start menu')
    await named('button', 'Apply')
    await named('button', 'OK')
    await click('[data-start-button]')
    await shot('start-small-icons')
    await check(
      `document.querySelector('[aria-label="Start menu"] [role="menuitem"]').getBoundingClientRect().height === 20`,
      'Small Start icons use twenty pixel rows',
    )
    await key('s')
    await key('t')
    await named('label', 'Always on top')
    await named('label', 'Auto hide')
    await named('label', 'Show small icons in Start menu')
    await named('label', 'Show Clock')
    await named('button', 'Apply')
    await named('button', 'Start Menu Programs')
    await named('button', 'Clear')
    await named('button', 'OK')
    await click('[data-start-button]')
    await key('d')
    await shot('documents-empty')
    await check(
      `document.querySelectorAll('[role="menu"]')[1].textContent === '(Empty)'`,
      'Clear empties the recent Documents menu',
    )
    await key('Escape')
    await key('Escape')
    await run('C:\\My Documents\\Readme.txt')
    await click('[data-window="3"] button[aria-label="Close"]')
    await click('[data-start-button]')
    await key('d')
    await shot('documents-recent')
    await check(
      `document.querySelectorAll('[role="menu"]')[1].textContent.includes('Readme.txt')`,
      'Documents records opened files rather than directory contents',
    )
    await key('Escape')
    await key('Escape')
    await run('notepad')
    const bar = await rect('[data-taskbar]')
    await mouse('mousePressed', 850, bar.y + 14)
    await mouse('mouseReleased', 850, bar.y + 14, 'right')
    await click('[data-task-list]', 'right')
    await named('menuitem', 'Minimize All Windows')
    await check(
      `[...document.querySelectorAll('[data-window]')].every(e=>getComputedStyle(e).display==='none')`,
      'Taskbar Minimize All hides every window',
    )
    await click('[data-task-list]', 'right')
    await named('menuitem', 'Undo Minimize All')
    await check(
      `[...document.querySelectorAll('[data-window]')].every(e=>getComputedStyle(e).display!=='none')`,
      'Undo Minimize All restores the remembered set',
    )
    await click('[data-task-list]', 'right')
    await named('menuitem', 'Tile Vertically')
    await shot('taskbar-tile')
    await check(
      `[...document.querySelectorAll('[data-window]')].some(e=>e.style.left==='512px')`,
      'Taskbar Tile Vertically lays out the resizable windows',
    )
    await mouse('mousePressed', 900, bar.y + 14)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 10, y: 400, button: 'left', buttons: 1 })
    await mouse('mouseReleased', 10, 400)
    await shot('taskbar-left')
    await check(
      `document.querySelector('[data-taskbar]').dataset.edge==='left' && document.querySelector('[data-desktop]').getBoundingClientRect().left===84`,
      'Dragging empty taskbar docks it to the left edge',
    )
    let edge = await rect('[data-taskbar-resize]')
    await mouse('mousePressed', edge.x + 1, 400)
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 112, y: 400, button: 'left', buttons: 1 })
    await mouse('mouseReleased', 112, 400)
    await shot('taskbar-sized')
    await check(
      `document.querySelector('[data-taskbar]').getBoundingClientRect().width===112`,
      'Dragging the inner taskbar edge sizes in twenty-eight pixel steps',
    )
    const bottom = await evaluate('innerHeight-2')
    await mouse('mousePressed', 10, 600)
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 500,
      y: bottom,
      button: 'left',
      buttons: 1,
    })
    await mouse('mouseReleased', 500, bottom)
    edge = await rect('[data-taskbar-resize]')
    await mouse('mousePressed', 500, edge.y + 1)
    const y = await evaluate('innerHeight-28')
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 500, y, button: 'left', buttons: 1 })
    await mouse('mouseReleased', 500, y)
    await click('[data-clock]', 'left', 2)
    await shot('date-time')
    await named('button', 'Time Zone')
    await shot('time-zone')
    await named('button', 'OK')
    await check(
      `!document.querySelector('[aria-label="Date/Time Properties"]')`,
      'Clock double-click opens both Date/Time property tabs',
    )
    await click('[data-start-button]')
    await named('menuitem', 'Shut Down...')
    await key('ArrowDown')
    await shot('shutdown-options')
    await check(
      `document.querySelectorAll('input[name="shutdown"]').length === 4 && document.querySelector('input[value="restart"]').checked`,
      'Shutdown offers four choices with arrow-key selection',
    )
    await click('input[value="logoff"]')
    await named('button', 'Yes')
    await wait(`document.querySelector('[aria-label="Welcome to Windows"]')`)
    await shot('logon')
    await check(
      `document.querySelectorAll('[data-window]').length === 0`,
      'Log off closes programs and opens Welcome to Windows',
    )
    await fill('#logon-user', 'S1b')
    await named('button', 'OK')
  } else if (phase === 'startup') {
    await click('[data-start-button]')
    await key('s')
    await key('t')
    await named('button', 'Start Menu Programs')
    await named('button', 'Add...')
    await fill('[aria-label="Command line"]', 'notepad')
    await named('button', 'Finish')
    await shot('startup-added')
    await named('button', 'OK')
    await click('[data-start-button]')
    await key('p')
    await key('u')
    await shot('startup-menu')
    await check(
      `[...document.querySelectorAll('[role="menu"]')].at(-1).textContent.includes('Notepad')`,
      'Programs includes the StartUp folder and its shortcuts',
    )
    await key('Escape')
    await key('Escape')
    await key('Escape')
    await evaluate('globalThis.proofBeforeReload=true')
    await send('Page.reload')
    await wait(`!globalThis.proofBeforeReload && document.querySelector('textarea')`)
    await shot('startup-launched')
    await check(
      `document.querySelector('[data-window][aria-label="Untitled - Notepad"]') !== null`,
      'StartUp launches the real app after boot',
    )
    await click('[data-start-button]')
    await key('s')
    await key('t')
    await named('button', 'Start Menu Programs')
    await named('button', 'Remove...')
    await named('button', 'Notepad')
    await named('button', 'Remove')
    await named('button', 'Close')
    await named('button', 'OK')
    await wait(
      `!Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).some(n=>n.kind==='shortcut' && n.name==='Notepad' && Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).some(p=>p.id===n.parent && p.name==='StartUp'))`,
    )
    await check(
      `!Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).some(n=>n.kind==='shortcut' && n.name==='Notepad' && Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).some(p=>p.id===n.parent && p.name==='StartUp'))`,
      'Remove deletes the StartUp shortcut',
    )
    await click('[data-window] button[aria-label="Close"]')
  } else if (phase === 'programs') {
    await click('[data-start-button]')
    await key('s')
    await key('t')
    await named('button', 'Start Menu Programs')
    await named('button', 'Remove...')
    await startFolder('Accessories')
    await named('button', 'Calculator')
    await named('button', 'Remove')
    await named('button', 'Close')
    await named('button', 'OK')
    await reset()
    await click('[data-start-button]')
    await key('p')
    await key('a')
    await shot('programs-removed')
    await check(
      `![...document.querySelectorAll('[role="menu"]')].at(-1).textContent.includes('Calculator')`,
      'Removing an installed Programs shortcut persists after a reboot',
    )
    await key('Escape')
    await key('Escape')
    await key('Escape')
    await click('[data-start-button]')
    await key('s')
    await key('t')
    await named('button', 'Start Menu Programs')
    await named('button', 'Add...')
    await startFolder('Accessories')
    await fill('[aria-label="Command line"]', 'calc')
    await key('Enter')
    await wait(`!document.querySelector('[aria-label="Create Shortcut"]')`)
    await named('button', 'Advanced...')
    await wait(`document.querySelector('[data-window][aria-label="Programs"]')`)
    await shot('programs-advanced')
    await check(
      `document.querySelector('[data-window][aria-label="Programs"]') !== null`,
      'Advanced opens the actual Programs folder in Explorer',
    )
    await click('[data-window] button[aria-label="Close"]')
    await named('button', 'OK')
    await click('[data-start-button]')
    await key('p')
    await key('a')
    await shot('programs-added')
    await check(
      `[...document.querySelectorAll('[role="menu"]')].at(-1).textContent.includes('Calculator')`,
      'Add writes a shortcut into the chosen Start menu folder and Enter finishes the wizard',
    )
  } else if (phase === 'feedback') {
    await run('notepad')
    await fill('textarea', 'blocked owner feedback')
    await click('[data-window] button[aria-label="Close"]')
    const box = await rect('[data-window]')
    await mouse('mousePressed', box.x + 10, box.y + 10)
    await sleep(75)
    await shot('modal-flash')
    await check(
      `getComputedStyle(document.querySelector('[role="dialog"] > div:first-child')).backgroundColor==='rgb(128, 128, 128)'`,
      'Clicking the blocked owner flashes its dialog caption',
    )
    await mouse('mouseReleased', box.x + 10, box.y + 10)
    await sleep(400)
    await named('button', 'Cancel')
    await check(
      `[...document.querySelectorAll('[data-window] > div')].filter(e=>e.className.includes('w-[20px]') || e.className.includes('h-[20px]')).length===8`,
      'Every resize corner has both twenty pixel arms',
    )
    await click('[data-window] button[aria-label="Minimize"]')
    await check(
      `document.querySelector('[data-caption-zoom]') !== null`,
      'Caption zoom is visible before minimize commits',
    )
    await sleep(300)
    await click('[data-task="1"]')
    await sleep(300)
    await check(
      `document.activeElement===document.querySelector('textarea')`,
      'Caption zoom restore retains the editor focus',
    )
  } else if (phase === 'host') {
    const targets = await (await fetch('http://127.0.0.1:9230/json/list')).json()
    const main = new WebSocket(targets[0].webSocketDebuggerUrl)
    await new Promise((done) => main.addEventListener('open', done, { once: true }))
    let mainId = 0
    const callbacks = new Map()
    main.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data)
      if (callbacks.has(message.id)) {
        callbacks.get(message.id)(message.result)
        callbacks.delete(message.id)
      }
    })
    const mainEval = (code) =>
      new Promise((resolve) => {
        const id = ++mainId
        callbacks.set(id, resolve)
        main.send(
          JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: {
              expression: `(()=>{const electron=process.getBuiltinModule('module').createRequire(process.cwd()+'/package.json')('electron'); const win=electron.BrowserWindow.getAllWindows()[0]; ${code} })()`,
              returnByValue: true,
              awaitPromise: true,
            },
          }),
        )
      })
    try {
      await mainEval(
        `globalThis.inputProof=[];win.webContents.on('before-input-event',(_event,input)=>globalThis.inputProof.push({type:input.type,key:input.key,code:input.code,alt:input.alt}));return true`,
      )
      await evaluate(`globalThis.hostProof=[];window.win95.onEvent(event=>globalThis.hostProof.push(event))`)
      await run('notepad')
      await fill('textarea', 'host Alt F4 keeps my work')
      await mainEval(`win.webContents.sendInputEvent({type:'keyDown',keyCode:'F4',modifiers:['alt']})`)
      await wait(`document.querySelector('[role="dialog"][aria-label="Notepad"]')`)
      await shot('host-alt-f4')
      await check(
        `globalThis.hostProof.some(e=>e.type==='alt-f4') && document.querySelector('textarea').value==='host Alt F4 keeps my work'`,
        'Electron before-input-event forwards Alt+F4 to the virtual close prompt',
      )
      await named('button', 'Cancel')
      await mainEval('win.close()')
      await wait(`document.querySelector('[aria-label="Shut Down Windows"]')`)
      await shot('host-close')
      await check(
        `globalThis.hostProof.some(e=>e.type==='host-close')`,
        'The host close guard opens Shut Down instead of quitting',
      )
      await named('button', 'Yes')
      await wait(`document.querySelector('[role="dialog"][aria-label="Notepad"]')`)
      await named('button', 'Cancel')
      await check(
        `document.querySelector('textarea').value==='host Alt F4 keeps my work'`,
        'Cancel also aborts shutdown entered from the host close guard',
      )
      await run('calc')
      await mainEval(`win.webContents.sendInputEvent({type:'keyDown',keyCode:'Alt'})`)
      await mainEval(`win.webContents.sendInputEvent({type:'keyDown',keyCode:'Tab',modifiers:['alt']})`)
      await wait(`document.querySelector('[aria-label="Task switcher"]')`)
      await shot('host-alt-tab')
      await check(
        `globalThis.hostProof.some(e=>e.type==='alt-tab')`,
        'Electron forwards Alt+Tab into the held switcher',
      )
      await mainEval(`win.webContents.sendInputEvent({type:'keyUp',keyCode:'Alt'})`)
      const inputs = await mainEval('return globalThis.inputProof')
      writeFileSync(join(proof, 'host-inputs.json'), JSON.stringify(inputs.result.value, null, 2))
      if (!(await evaluate(`globalThis.hostProof.some(e=>e.type==='alt-release')`))) {
        results.push({
          name: 'Native host Alt release',
          status: 'unverified',
          reason:
            'Electron synthetic keyUp did not reach before-input-event on this background host. The renderer release path is verified separately.',
        })
        await reset()
        await evaluate(
          `globalThis.hostProof=[];window.win95.onEvent(event=>globalThis.hostProof.push(event))`,
        )
      } else {
        await wait(`!document.querySelector('[aria-label="Task switcher"]')`)
      }
      await mainEval(
        `win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape',modifiers:['control']})`,
      )
      await wait(`document.querySelector('[aria-label="Start menu"]')`)
      await check(`globalThis.hostProof.some(e=>e.type==='start')`, 'Electron forwards Ctrl+Esc to Start')
      await key('Escape')
      const before = await mainEval('return win.isFullScreen()')
      await mainEval(`win.webContents.sendInputEvent({type:'keyDown',keyCode:'F11'})`)
      await sleep(400)
      const after = await mainEval('return win.isFullScreen()')
      assert.notEqual(before.result.value, after.result.value)
      await shot('host-fullscreen')
      const config = await mainEval(
        `return JSON.parse(process.getBuiltinModule('fs').readFileSync(process.getBuiltinModule('path').join(electron.app.getPath('userData'),'shell-window.json'),'utf8')).fullscreen`,
      )
      assert.equal(config.result.value, after.result.value)
      results.push({ name: 'F11 changes fullscreen and persists the choice' })
      await mainEval(`win.webContents.sendInputEvent({type:'keyDown',keyCode:'F11'})`)
      await sleep(400)
      writeFileSync(
        join(proof, 'host-events.json'),
        JSON.stringify(await evaluate('globalThis.hostProof'), null, 2),
      )
    } finally {
      main.close()
    }
  } else if (phase === 'integration') {
    await mouse('mousePressed', 850, 300, 'right')
    await mouse('mouseReleased', 850, 300, 'right')
    await key('w')
    await shot('submenu-flips-left')
    await check(
      `(()=>{const menus=[...document.querySelectorAll('[role="menu"]')];return menus.length===2 && menus[1].getBoundingClientRect().right <= menus[0].getBoundingClientRect().left+6})()`,
      'A desktop New submenu flips left at x=850',
    )
    await key('Escape')
    await key('Escape')
    await click('[data-start-button]')
    await key('s')
    await key('t')
    await check(
      `document.activeElement.closest('[role="dialog"]')?.getAttribute('aria-label')==='Taskbar Properties' && !document.activeElement.closest('[data-dialog-caption]')`,
      'Dialog initial focus goes to a body tab stop instead of Close',
    )
    await check(
      `[...document.querySelectorAll('[role="dialog"]')].every(e=>{const b=e.getBoundingClientRect();return Number.isInteger(b.x)&&Number.isInteger(b.y)})`,
      'Centered dialogs land on whole screen pixels',
    )
    await key('Enter')
    await check(
      `!document.querySelector('[aria-label="Taskbar Properties"]')`,
      'Enter from a body tab activates the default OK button',
    )
    const start = await rect('[data-start-button]')
    await mouse('mouseMoved', 800, 500)
    await mouse('mouseMoved', start.x + 20, start.y + 10)
    await sleep(650)
    await shot('shell-tooltip')
    await check(
      `document.querySelector('[role="tooltip"]')?.textContent==='Click here to begin.'`,
      'The shell mounts the Tooltip layer and preserves the Start tooltip',
    )
    await click('[data-start-button]')
    await named('menuitem', 'Run...')
    await named('button', 'Browse...')
    await shot('browse-help-caption')
    await check(
      `document.querySelector('[aria-label="Browse"] [data-dialog-caption] button[aria-label="Help"]') !== null`,
      'Dialog exposes and renders the Help caption button',
    )
    await click('[aria-label="Browse"] [data-dialog-caption] button[aria-label="Help"]')
    await wait(`document.querySelector('[data-window]')`)
    await check(
      `document.querySelectorAll('[data-window]').length === 1`,
      'The Help caption callback opens the installed Help app',
    )
    await click('[data-window] button[aria-label="Close"]')
    await named('button', 'Cancel')
    await named('button', 'Cancel')
    await mouse('mousePressed', 850, 300, 'right')
    await mouse('mouseReleased', 850, 300, 'right')
    await key('w')
    await named('menuitem', 'Text Document')
    await wait(`document.querySelector('[data-desktop-item] input')`)
    await fill('[data-desktop-item] input', 's1b-delete.txt')
    await key('Enter')
    await key('Delete')
    await wait(`document.querySelector('[aria-label="Confirm File Delete"]')`)
    await shot('disabled-close-caption')
    await check(
      `document.querySelector('[aria-label="Confirm File Delete"] button[aria-label="Close"]').disabled`,
      'A Yes/No box draws a disabled Close caption button',
    )
    await key('Enter')
    await wait(`!document.querySelector('[aria-label="Confirm File Delete"]')`)
    await run('mspaint')
    await named('button', 'Image')
    await named('menuitem', 'Attributes...')
    await wait(`document.querySelector('[aria-label="Attributes"]')`)
    await shot('paint-attributes-focus')
    await check(
      `document.activeElement.closest('[role="dialog"]')?.getAttribute('aria-label')==='Attributes' && !document.activeElement.closest('[data-dialog-caption]')`,
      'Paint Attributes keeps its body focus with DialogForm intact',
    )
    await check(
      `[...document.querySelectorAll('[role="dialog"]')].every(e=>{const b=e.getBoundingClientRect();return Number.isInteger(b.x)&&Number.isInteger(b.y)})`,
      'Paint dialogs also center on whole pixels',
    )
    await key('Enter')
    await wait(`!document.querySelector('[aria-label="Attributes"]')`)
    await check(
      `document.querySelector('[data-window][aria-label$="Paint"]') !== null`,
      'Enter accepts Paint Attributes once without closing Paint',
    )
    await named('button', 'Image')
    await named('menuitem', 'Stretch/Skew...')
    await wait(`document.querySelector('[aria-label="Stretch and Skew"]')`)
    await key('Enter')
    await wait(`!document.querySelector('[aria-label="Stretch and Skew"]')`)
    await check(
      `document.querySelector('[data-window][aria-label$="Paint"]') !== null`,
      'Paint Stretch/Skew also accepts Enter with its wrapper',
    )
  } else if (phase === 'power') {
    await run('notepad')
    await fill('textarea', 'restart must ask me')
    await shutdown(true)
    await wait(`document.querySelector('[aria-label="Notepad"][role="dialog"]')`)
    await named('button', 'Cancel')
    await check(
      `document.querySelector('textarea').value==='restart must ask me'`,
      'Cancel aborts Restart with the document intact',
    )
    await shutdown(true)
    await named('button', 'No')
    await wait(`document.querySelector('[role="status"]')`)
    await shot('restart-wait')
    await wait(`document.body.textContent.includes('Starting Windows 95')`)
    await sleep(450)
    await shot('boot-splash')
    await wait(`document.querySelector('[data-start-button]')`)
    await check(
      `document.querySelectorAll('[data-window]').length===0`,
      'Restart returns to the desktop only after close requests finish',
    )
    await run('command.com')
    await check(
      `document.querySelector('[data-window][aria-label*="MS-DOS"]')!==null`,
      'Run resolves an installed COM program',
    )
    await click('[data-window] button[aria-label="Close"]')
    await click('[data-start-button]')
    await key('p')
    await shot('programs-ms-dos')
    await check(
      `[...document.querySelectorAll('[role="menuitem"]')].some(e=>e.textContent.trim()==='MS-DOS Prompt')`,
      'Programs includes MS-DOS Prompt after installation',
    )
    await key('Escape')
    await key('Escape')
    await click('[data-start-button]')
    await named('menuitem', 'Shut Down...')
    await click('input[value="dos"]')
    await named('button', 'Yes')
    await wait(`document.querySelector('[data-window][aria-label*="MS-DOS"]')`)
    await check(
      `document.querySelector('[data-window][aria-label*="MS-DOS"]').style.left==='-4px'`,
      'Restart in MS-DOS mode launches the installed prompt maximized',
    )
    await shot('restart-ms-dos')
    await click('[data-window] button[aria-label="Close"]')
    await click('[data-start-button]')
    await named('menuitem', 'Shut Down...')
    await named('button', 'Help')
    await wait(`document.querySelector('[data-window]')`)
    await check(
      `!document.querySelector('[aria-label="Shut Down Windows"]') && document.querySelector('[data-window]') !== null`,
      'Shutdown Help opens the installed Help app without leaving a blocking dim layer',
    )
    await shot('shutdown-help')
    await click('[data-window] button[aria-label="Close"]')
  } else throw new Error(`Unknown phase ${phase}`)
} finally {
  writeFileSync(join(proof, `${phase}-checks.json`), JSON.stringify(results, null, 2))
  ws.close()
}
