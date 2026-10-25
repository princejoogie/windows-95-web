import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const proof = resolve(process.env.W95_PROOF_DIR ?? '../proof/shellfix-s1b')
mkdirSync(proof, { recursive: true })
const port = process.env.W95_CDP_PORT ?? '9330'
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((target) => target.type === 'page')
assert.ok(page, 'Electron renderer target exists')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((done) => ws.addEventListener('open', done, { once: true }))
let sequence = 0
const pending = new Map()
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
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
    `(()=>{const es=[...document.querySelectorAll(${JSON.stringify(role === 'button' ? 'button' : '[role="menuitem"]')})]; const e=es.find(e=>e.getClientRects().length && e.textContent.trim()===${JSON.stringify(text)});if(!e)return null;e.dataset.proofTarget='pick';return '[data-proof-target="pick"]'})()`,
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
    modifiers,
    ...(type === 'keyDown' && key.length === 1 && !modifiers ? { text: key } : {}),
  })
}
async function key(key, modifiers = 0) {
  await keyEvent('keyDown', key, modifiers)
  await keyEvent('keyUp', key, modifiers)
  await sleep(50)
}
async function fill(selector, text) {
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
  await send('Page.reload')
  await wait(`document.querySelector('[data-start-button]')`)
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

const phase = process.argv[2] ?? 'close'
try {
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
    await check(
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).some(n=>n.name==='s1b-saved.txt' && n.content==='first dirty document')`,
      'Alt+F4 saves then closes through the app contract',
    )
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
  } else throw new Error(`Unknown phase ${phase}`)
} finally {
  writeFileSync(join(proof, `${phase}-checks.json`), JSON.stringify(results, null, 2))
  ws.close()
}
