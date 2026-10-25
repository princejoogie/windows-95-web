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
const click = async (selector, text, count = 1) => {
  const element = locate(selector, text)
  const rect = await evaluate(
    `(() => {const e=${element}; if(!e) return null; e.scrollIntoView({block:'nearest'}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
  )
  assert(rect, `Visible element: ${selector} ${text ?? ''}`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: count, ...rect })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    clickCount: count,
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

try {
  await send('Page.reload')
  await wait("document.querySelector('[aria-label=Desktop]')")
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
      'document.querySelector(\'[aria-label="Topics visited"]\').options.length === 3',
    )
    await shot('help-history')
  } else {
    await run('FIND')
  }
  await writeFile(join(output, `${mode}-assertions.json`), `${JSON.stringify({ port, checks }, null, 2)}\n`)
  console.log(`${checks.length} ${mode} assertions passed. Screenshots saved to ${output}.`)
} finally {
  socket.close()
}
