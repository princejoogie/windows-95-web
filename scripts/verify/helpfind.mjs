// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const port = process.env.W95_CDP_PORT ?? '9360'
const output = process.env.W95_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/helpfind'
const mode = process.argv[2] ?? 'help'
await mkdir(output, { recursive: true })
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const target = targets.find((entry) => entry.type === 'page')
assert(target, 'Electron renderer is running')
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true })
  socket.addEventListener('error', reject, { once: true })
})
let sequence = 0
const pending = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  const entry = pending.get(message.id)
  if (!entry) return
  clearTimeout(entry.timeout)
  pending.delete(message.id)
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)))
  else entry.resolve(message.result)
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++sequence
    const timeout = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${method} timed out`))
    }, 10000)
    pending.set(id, { resolve, reject, timeout })
    socket.send(JSON.stringify({ id, method, params }))
  })
const evaluate = async (expression) => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
  return result.result.value
}
const wait = async (expression) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate(`Boolean(${expression})`)) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`Condition did not hold: ${expression}`)
}
const locate = (selector, text) =>
  `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e => e.getClientRects().length && ${text === undefined ? 'true' : `e.textContent.trim() === ${JSON.stringify(text)}`})`
const click = async (selector, text, count = 1, modifiers = 0) => {
  const element = locate(selector, text)
  const rect = await evaluate(
    `(() => {const e=${element}; if(!e) return null; e.scrollIntoView({block:'nearest'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  )
  assert(rect, `Visible element: ${selector} ${text ?? ''}`)
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    clickCount: count,
    modifiers,
    ...rect,
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    clickCount: count,
    modifiers,
    ...rect,
  })
}
const key = async (key, modifiers = 0) => {
  const codes = {
    Enter: 13,
    Escape: 27,
    ArrowDown: 40,
    ArrowRight: 39,
    ArrowLeft: 37,
    Tab: 9,
    F1: 112,
    a: 65,
  }
  const params = { key, modifiers, windowsVirtualKeyCode: codes[key] ?? key.toUpperCase().charCodeAt(0) }
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    ...params,
    ...(key === 'Enter' ? { text: '\r' } : {}),
  })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...params })
}
const fill = async (selector, text) => {
  await click(selector)
  await key('a', 2)
  await send('Input.insertText', { text })
}
const choose = async (selector, value) => {
  await evaluate(
    `(() => {const element = ${locate(selector)}; if (!element) throw Error('Control missing'); const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, ${JSON.stringify(value)}); element.dispatchEvent(new Event('input', {bubbles:true})); element.dispatchEvent(new Event('change', {bubbles:true}));})()`,
  )
}
const shot = async (name) => {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(output, `${name}.png`), Buffer.from(result.data, 'base64'))
}
const checks = []
const check = async (name, expression) => {
  assert(await evaluate(expression), name)
  checks.push(name)
}
const run = async (exe) => {
  await click('button', 'Start')
  await click('[role=menuitem]', 'Run...')
  await fill('[role=dialog] input', exe)
  await key('Enter')
}
const reload = async () => {
  await send('Page.enable')
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener('message', listener)
      reject(new Error('Page load timed out'))
    }, 10000)
    const listener = ({ data }) => {
      if (JSON.parse(data).method !== 'Page.loadEventFired') return
      clearTimeout(timeout)
      socket.removeEventListener('message', listener)
      resolve()
    }
    socket.addEventListener('message', listener)
  })
  await send('Page.reload')
  await loaded
  await wait("document.querySelector('[aria-label=Desktop]')")
}
const cleanupFixtures = () =>
  evaluate(
    `(() => {const raw=localStorage.getItem('w95.fs.v1'); if(!raw) return; const state=JSON.parse(raw); for(const id of Object.keys(state.nodes)) if(id.startsWith('verify-helpfind-')) delete state.nodes[id]; localStorage.setItem('w95.fs.v1',JSON.stringify(state));})()`,
  )

try {
  await cleanupFixtures()
  await reload()
  if (mode === 'help') {
    await click('button', 'Start')
    await click('[role=menuitem]', 'Help')
    await wait("document.querySelector('[role=tree]')")
    await check(
      'Start Help opens Windows book with four closed books',
      "document.querySelectorAll('[role=treeitem]').length === 4 && document.body.textContent.includes('Help Topics: Windows Help')",
    )
    await shot('help-contents')
    await click('[role=treeitem]', 'Introducing Windows')
    await key('ArrowRight')
    await check(
      'Right arrow expands Contents book',
      "document.querySelectorAll('[role=treeitem]').length === 8",
    )
    await key('ArrowDown')
    await key('Enter')
    await wait("document.querySelector('article h1')?.textContent === 'Welcome to Windows'")
    await shot('help-topic')
    await click('article a', 'taskbar')
    await check(
      'Dotted green link opens topic popup',
      "document.querySelector('.help-popup')?.textContent.includes('strip at the bottom')",
    )
    await shot('help-popup')
    await key('Escape')
    await check('Escape dismisses popup', "!document.querySelector('.help-popup')")
    await click('article a', 'Starting a program')
    await check(
      'Green jump changes topic',
      "document.querySelector('article h1')?.textContent === 'Starting a program'",
    )
    await click('button', 'Back')
    await check(
      'Back returns to previous topic',
      "document.querySelector('article h1')?.textContent === 'Welcome to Windows'",
    )
    await click('button', 'Options')
    await wait("document.activeElement?.textContent.includes('History')")
    await key('ArrowDown')
    await key('Enter')
    await check(
      'Options menu works with arrow keys and Enter',
      "getComputedStyle(document.querySelector('article')).fontSize === '11px'",
    )
    await click('button', 'Help Topics')
    await click('[role=tab]', 'Index')
    await fill('input', 'wildcards')
    await check(
      'Typing selects matching index keyword',
      "document.querySelector('select').value === 'wildcards'",
    )
    await shot('help-index')
    await click('button', 'Display')
    await check(
      'Index Display opens matching topic',
      "document.querySelector('article h1')?.textContent === 'Finding a file or folder'",
    )
    await click('button', 'Help Topics')
    await click('[role=tab]', 'Find')
    await fill('input', 'virtual profile')
    await check(
      'Full-text Find requires every word',
      "document.querySelector('select').options.length === 1 && document.querySelector('select').textContent.includes('I cannot find my document')",
    )
    await shot('help-find')
    await click('button', 'Display')
    await check(
      'Full-text result opens',
      "document.querySelector('article h1')?.textContent === 'I cannot find my document'",
    )
    await key('F1')
    await check('F1 returns to Help Topics', "!!document.querySelector('[role=tree]')")
    await key('Escape')
    await check('Escape returns to current topic', "!!document.querySelector('article')")
    await click('button', 'Options')
    await click('[role=menuitem]', 'History...')
    await check(
      'History records topic navigation',
      'document.querySelector(\'[aria-label="Topics visited"]\').options.length === 4',
    )
    await shot('help-history')
    await key('Escape')
    await click('button', 'Help Topics')
    await click('[role=tab]', 'Index')
    await fill('input', 'search')
    await click('button', 'Display')
    await check(
      'Shared index keywords offer a topic chooser',
      'document.querySelector(\'[role=dialog][aria-label="Topics Found"] select\').options.length === 2',
    )
    await shot('help-index-topics')
    await choose('[aria-label="Topics for keyword"]', 'missing-file')
    await click('[role=dialog] button', 'Display')
    await check(
      'Topic chooser opens the chosen topic',
      "document.querySelector('article h1').textContent === 'I cannot find my document'",
    )
  } else {
    await click('button', 'Start')
    await click('[role=menuitem]', 'Find')
    await click('[role=menuitem]', 'Files or Folders...')
    await wait("document.querySelector('.find-app')")
    await check(
      'Start Find opens the registered app',
      '!!document.querySelector(\'[role=application][aria-label="Find: All Files"]\')',
    )
    const initialHeight = await evaluate("document.querySelector('.find-app').clientHeight")
    const initialTop = await evaluate("document.querySelector('.find-app').getBoundingClientRect().top")
    await shot('find-initial')
    await click('button', 'File')
    await wait("document.activeElement?.getAttribute('role') === 'menuitem'")
    await key('ArrowRight')
    await wait("!!document.querySelector('[role=menu][aria-label=Edit]')")
    await key('ArrowRight')
    await wait("!!document.querySelector('[role=menu][aria-label=View]')")
    await key('End')
    await check(
      'Menus support horizontal arrows and End',
      "document.activeElement.textContent.includes('Refresh')",
    )
    await key('Home')
    await check('Home selects the first menu item', "document.activeElement.textContent.trim() === 'List'")
    await key('Escape')
    await fill('[name=named]', '*.txt')
    await key('f', 1)
    await wait("document.querySelector('[role=status]')?.textContent === '2 file(s) found.'")
    await check(
      'Name wildcard finds both persisted Readme files',
      "document.querySelectorAll('.find-results tbody tr').length === 2",
    )
    await check(
      'Results grow the window down without moving its top',
      `document.querySelector('.find-app').clientHeight > ${initialHeight} && document.querySelector('.find-app').getBoundingClientRect().top === ${initialTop}`,
    )
    await check(
      'Results expose all five columns',
      "Array.from(document.querySelectorAll('.find-results th')).map(e=>e.textContent).join('|') === 'Name|In Folder|Size|Type|Modified'",
    )
    await shot('find-results')
    await click('.find-results tbody tr:first-child')
    await click('.find-results tbody tr:nth-child(2)', undefined, 1, 2)
    await check(
      'Ctrl-click adds to the result selection',
      "document.querySelectorAll('.find-results tr[aria-selected=true]').length === 2",
    )
    await click('.find-results tbody tr:first-child')
    await key('ArrowDown')
    await check(
      'Arrow keys move the result selection',
      "document.querySelector('.find-results tbody tr:nth-child(2)').getAttribute('aria-selected') === 'true' && document.querySelectorAll('.find-results tr[aria-selected=true]').length === 1",
    )
    await click('button', 'File')
    await click('[role=menuitem]', 'Properties')
    await check(
      'Properties shows the selected real file',
      "document.querySelector('[role=dialog]')?.textContent.includes('Location: C:\\\\WINDOWS\\\\Desktop')",
    )
    await shot('find-properties')
    await key('Escape')
    await click('button', 'View')
    await click('[role=menuitem]', 'List')
    await check('List view switches to names', "document.querySelectorAll('.find-results th').length === 1")
    await click('button', 'View')
    await click('[role=menuitem]', 'Details')
    await check(
      'Details view restores the columns',
      "document.querySelectorAll('.find-results th').length === 5",
    )
    await click('.find-results tbody tr', undefined, 2)
    await wait('document.querySelector(\'[role=application][aria-label="Readme.txt - Notepad"]\')')
    await check(
      'Double-click opens real document through openNode',
      "document.querySelector('textarea')?.value.includes('Welcome to Windows 95')",
    )
    await shot('find-open-file')
    await click('[role=application][aria-label="Readme.txt - Notepad"] button[aria-label=Close]')
    await click('button', 'New Search')
    await check(
      'New Search clears results, criteria, and restores height',
      `!document.querySelector('.find-results') && document.querySelector('[name=named]').value === '' && document.querySelector('.find-app').clientHeight === ${initialHeight}`,
    )
    await click('button', 'Browse...')
    await choose('[aria-label=Folders]', 'documents')
    await shot('find-browse')
    await click('[role=dialog] button', 'OK')
    await check(
      'Browse chooses a real virtual folder',
      "document.querySelector('[name=location]').value === 'documents'",
    )
    await click('button', 'Find Now')
    await wait("document.querySelector('[role=status]')?.textContent === '1 file(s) found.'")
    await check(
      'Folder search stays inside My Documents',
      "document.querySelector('.find-results tbody')?.textContent.includes('Readme.txt')",
    )
    await choose('[name=location]', 'windows')
    await click('input[type=checkbox]')
    await click('button', 'Find Now')
    await wait("!document.querySelector('.find-animation[data-searching=true]')")
    await check(
      'Include subfolders off excludes Desktop documents',
      "!document.querySelector('.find-results tbody')?.textContent.includes('Readme.txt')",
    )
    await click('input[type=checkbox]')
    await click('button', 'Find Now')
    await wait("!document.querySelector('.find-animation[data-searching=true]')")
    await check(
      'Include subfolders on includes Desktop documents',
      "document.querySelector('.find-results tbody')?.textContent.includes('Readme.txt')",
    )
    await click('button', 'New Search')
    await click('[role=tab]', 'Advanced')
    await choose('select[id$="-type"]', '.bat')
    await fill('input[id$="-text"]', 'prompt')
    await choose('select[id$="-size"]', 'at-most')
    await fill('[aria-label="Size in KB"]', '1')
    await click('button', 'Find Now')
    await wait("document.querySelector('[role=status]')?.textContent === '1 file(s) found.'")
    await check(
      'Type, containing text, and maximum size combine',
      "document.querySelector('.find-results tbody')?.textContent.includes('AUTOEXEC.BAT')",
    )
    await shot('find-advanced')
    await choose('select[id$="-size"]', 'at-least')
    await click('button', 'Find Now')
    await wait("document.querySelector('[role=status]')?.textContent === '0 file(s) found.'")
    await check(
      'Minimum size excludes the smaller file',
      "document.querySelectorAll('.find-results tbody tr').length === 0",
    )
    await click('button', 'New Search')
    await fill('[name=named]', '*.txt')
    await click('[role=tab]', 'Date Modified')
    await click('label', 'Between')
    const today = await evaluate(
      "(() => {const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-')})()",
    )
    await choose('[aria-label="Starting date"]', today)
    await choose('[aria-label="Ending date"]', today)
    await click('button', 'Find Now')
    await wait("document.querySelector('[role=status]')?.textContent === '2 file(s) found.'")
    await check(
      'Between dates includes files modified today',
      "document.querySelectorAll('.find-results tbody tr').length === 2",
    )
    await shot('find-dates')
    await choose('[aria-label="Starting date"]', '2000-01-01')
    await choose('[aria-label="Ending date"]', '2000-01-02')
    await click('button', 'Find Now')
    await wait("document.querySelector('[role=status]')?.textContent === '0 file(s) found.'")
    await check(
      'Between dates excludes files outside the range',
      "document.querySelectorAll('.find-results tbody tr').length === 0",
    )
    await choose('[aria-label="Starting date"]', '2000-01-03')
    await click('button', 'Find Now')
    await check(
      'Reversed dates show a validation dialog',
      "document.querySelector('[role=dialog]')?.textContent.includes('starting date must be on or before')",
    )
    await key('Escape')
    await click('label', 'During the previous')
    await fill('[aria-label="Previous count"]', '1')
    await choose('[aria-label="Previous unit"]', 'days')
    await click('button', 'Find Now')
    await wait("document.querySelector('[role=status]')?.textContent === '2 file(s) found.'")
    await check(
      'Previous days finds recent files',
      "document.querySelectorAll('.find-results tbody tr').length === 2",
    )
    await choose('[aria-label="Previous unit"]', 'months')
    await click('button', 'Find Now')
    await wait("document.querySelector('[role=status]')?.textContent === '2 file(s) found.'")
    await check(
      'Previous months finds recent files',
      "document.querySelectorAll('.find-results tbody tr').length === 2",
    )
    await shot('find-previous')
    await key('F1')
    await wait('document.querySelector(\'[aria-label="Help Topics: Find Help"]\')')
    await check(
      'F1 loads another app book through the eager glob',
      "document.querySelector('[role=tree]')?.textContent.includes('Advanced filters')",
    )
    await click('[role=treeitem]', 'Advanced filters', 2)
    await check(
      'App book topic renders',
      "document.querySelector('article h1')?.textContent === 'Advanced filters'",
    )
    await shot('find-help-book')
    await click('[role=application][aria-label="Find Help"] button[aria-label=Close]')
    await click('button', 'New Search')
    await evaluate(
      `(() => { const state=JSON.parse(localStorage.getItem('w95.fs.v1')); for(let i=0;i<1200;i++) { const id='verify-helpfind-'+i; state.nodes[id]={id,kind:'file',name:'Find proof '+String(i).padStart(4,'0')+'.txt',parent:'documents',content:'Search cancellation proof.',modified:Date.now()}; } localStorage.setItem('w95.fs.v1',JSON.stringify(state)); })()`,
    )
    await reload()
    await run('FIND')
    await fill('[name=named]', 'Find proof')
    await click('button', 'Find Now')
    await wait(
      "document.querySelectorAll('.find-results tbody tr').length > 0 && !!document.querySelector('.find-animation[data-searching=true]')",
    )
    await check(
      'Magnifier animates during incremental search',
      "getComputedStyle(document.querySelector('.find-animation img')).animationName === 'find-magnifier'",
    )
    await shot('find-searching')
    await click('button', 'Stop')
    await check(
      'Stop retains a partial result list',
      "document.querySelector('[role=status]').textContent.includes('Search stopped') && document.querySelectorAll('.find-results tbody tr').length > 0 && document.querySelectorAll('.find-results tbody tr').length < 1200",
    )
    const stoppedCount = await evaluate("document.querySelectorAll('.find-results tbody tr').length")
    await new Promise((resolve) => setTimeout(resolve, 100))
    await check(
      'Cancelled traversal does not append more results',
      `document.querySelectorAll('.find-results tbody tr').length === ${stoppedCount}`,
    )
    await shot('find-stopped')
    await click('button', 'New Search')
    await check(
      'New Search restores ready state after cancellation',
      "document.querySelector('[role=status]').textContent === 'Ready' && !document.querySelector('.find-results')",
    )
    await cleanupFixtures()
    await reload()
  }
  await writeFile(join(output, `${mode}-assertions.json`), `${JSON.stringify({ port, checks }, null, 2)}\n`)
  console.log(`${checks.length} ${mode} assertions passed. Screenshots saved to ${output}.`)
} finally {
  socket.close()
}
