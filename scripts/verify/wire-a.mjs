import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const port = Number(process.argv[2] ?? 9390)
const proof = resolve(process.argv[3] ?? '../proof/wire-a')
const item = process.argv[4] ?? 'wordpad'
mkdirSync(proof, { recursive: true })
const c = await connect(port)
const checks = []

async function check(name, expression, screenshot) {
  const actual = await c.eval(expression)
  assert.ok(Array.isArray(actual) ? actual.length > 0 : actual, `${name}: ${JSON.stringify(actual)}`)
  checks.push({ name, expression, actual, screenshot: screenshot ?? null })
  console.log(`PASS ${name}`)
  if (screenshot) await c.shot(join(proof, `${screenshot}.png`))
}

async function clickText(text, selector = 'button, [role="menuitem"]', count = 1) {
  const point = await c.eval(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].reverse().find(el =>
      el.getClientRects().length && el.textContent.trim() === ${JSON.stringify(text)})
    if (!el) throw new Error('Missing text ' + ${JSON.stringify(text)})
    const b = el.getBoundingClientRect()
    return [b.x + b.width / 2, b.y + b.height / 2]
  })()`)
  await c.click(...point, { count })
}

async function run(command) {
  await c.clickOn('[data-start-button]')
  await clickText('Run...')
  await c.clickOn('#run-command')
  await c.key('a', ['Control'])
  await c.type(command)
  await c.key('Enter')
  await sleep(200)
}

async function shutdown() {
  await c.clickOn('[data-start-button]')
  await clickText('Shut Down...')
  await c.clickOn('input[value="logoff"]')
  await clickText('Yes')
}

const audioProbe = `(() => {
  window.__audio = []
  const bytes = new WeakMap(), buffers = new WeakMap()
  const arrayBuffer = Response.prototype.arrayBuffer
  Response.prototype.arrayBuffer = async function(...args) {
    const result = await arrayBuffer.apply(this, args)
    bytes.set(result, this.url.split('/').pop().split('-')[0])
    return result
  }
  const decode = AudioContext.prototype.decodeAudioData
  AudioContext.prototype.decodeAudioData = async function(data, ...args) {
    const name = bytes.get(data)
    const buffer = await decode.call(this, data, ...args)
    buffers.set(buffer, name)
    return buffer
  }
  const start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function(...args) {
    window.__audio.push({name: buffers.get(this.buffer), duration: this.buffer?.duration, sampleRate: this.buffer?.sampleRate})
    return start.apply(this, args)
  }
})()`

const cursorProbe = `(() => {
  window.__cursors = []
  new MutationObserver(() => {
    const root = document.documentElement
    if (root) window.__cursors.push({kind: root.dataset.systemCursor ?? 'arrow', cursor: getComputedStyle(document.body ?? root).cursor, windows: document.querySelectorAll('[data-window]').length})
  }).observe(document, {subtree: true, attributes: true, attributeFilter: ['data-system-cursor']})
})()`

async function hear(name, label) {
  await c.waitFor(`window.__audio?.some(entry => entry.name === ${JSON.stringify(name)})`)
  await check(
    label,
    `window.__audio.filter(entry => entry.name === ${JSON.stringify(name)} && entry.duration > 0 && entry.sampleRate > 0)`,
  )
  await c.eval('window.__audio = []')
}

try {
  await c.send('Page.enable')
  if (item === 'sounds') await c.send('Page.addScriptToEvaluateOnNewDocument', { source: audioProbe })
  if (item === 'cursors') await c.send('Page.addScriptToEvaluateOnNewDocument', { source: cursorProbe })
  await c.send('Page.reload')
  await sleep(100)
  await c.waitFor('!!document.querySelector("[data-start-button]")')
  if (item === 'wordpad') {
    await run('wordpad')
    await c.clickOn('.wordpad-page[contenteditable]')
    await c.type('Unsaved close verification')
    await shutdown()
    await check(
      'Shutdown asks WordPad to save',
      'document.body.innerText.includes("Save changes to Document?")',
      'wordpad-save-prompt',
    )
    await clickText('Cancel')
    await check(
      'Cancel preserves WordPad and its document',
      'document.querySelector(".wordpad-page[contenteditable]")?.textContent.includes("Unsaved close verification") && !document.querySelector("[role=dialog]")',
    )
    await shutdown()
    await clickText('Yes')
    await c.waitFor('!!document.querySelector("[role=dialog] input")')
    await clickText('Cancel')
    await check(
      'Cancel in Save As also rejects shutdown',
      '!!document.querySelector(".wordpad-page[contenteditable]") && !document.querySelector("[role=dialog]")',
      'wordpad-save-cancel',
    )
    await c.key('F4', ['Alt'])
    await clickText('No')
    await check(
      'Discard completes close after canceled shutdowns',
      '!document.querySelector(".wordpad-page[contenteditable]")',
    )
    await run('wordpad')
    await c.key('F4', ['Alt'])
    await check(
      'Clean document closes without prompting',
      '!document.querySelector(".wordpad-page[contenteditable]") && !document.querySelector("[role=dialog]")',
    )
    await run('wordpad')
    await c.clickOn('.wordpad-page[contenteditable]')
    await c.type('Saved close verification')
    await c.key('F4', ['Alt'])
    await clickText('Yes')
    await c.clickOn('[role="dialog"] input[id$="-name"]')
    await c.key('a', ['Control'])
    await c.type(`WireA-${Date.now()}.doc`)
    await clickText('Save')
    await c.waitFor('!document.querySelector(".wordpad-page[contenteditable]")')
    await c.waitFor(
      'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).some(node => node.kind === "file" && node.content.includes("Saved close verification"))',
    )
    await check(
      'Save persists content before close',
      'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).some(node => node.kind === "file" && node.content.includes("Saved close verification"))',
      'wordpad-saved',
    )
  }
  if (item === 'sounds') {
    await hear('tada', 'Startup plays the tada buffer')
    await run('missing-wire-a-program')
    await hear('chord', 'Missing program plays the chord buffer')
    await clickText('OK')
    await clickText('Cancel')
    await run('wordpad')
    await c.clickOn('.wordpad-page[contenteditable]')
    await c.type('Modal sound verification')
    await c.key('F4', ['Alt'])
    await c.click(
      ...(await c.eval(
        '(() => {const b=document.querySelector("[data-window]").getBoundingClientRect();return [b.x+12,b.y+12]})()',
      )),
    )
    await hear('ding', 'Clicking a blocked owner plays the ding buffer')
    await clickText('No')
    await run('C:\\My Documents')
    const recycled = await c.eval(
      'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).find(node => node.kind === "file" && node.name.startsWith("WireA-"))?.id',
    )
    assert.ok(recycled, 'Run the WordPad item first to create a disposable saved document')
    await c.clickOn(`[data-node-id="${recycled}"]`)
    await c.key('Delete')
    await clickText('Yes')
    await c.key('F4', ['Alt'])
    await c.clickOn('[aria-label="Desktop"] [aria-label="Recycle Bin"]', { button: 'right' })
    await clickText('Empty Recycle Bin')
    await clickText('Yes')
    await hear('recycle', 'Emptying Recycle Bin plays the recycle buffer')
    await run('control')
    await c.clickOn('[data-applet="sounds"]', { count: 2 })
    await c.clickOn('[aria-label="Sound scheme"]')
    await c.key('Home')
    await c.key('ArrowDown')
    await c.key('Enter')
    await clickText('OK')
    await check(
      'No Sounds persists from Control Panel',
      'Object.values(JSON.parse(localStorage.getItem("win95.settings.v1")).soundScheme).every(name => name === "(None)")',
      'no-sounds',
    )
    await c.key('F4', ['Alt'])
    await c.eval('window.__audio = []')
    await run('missing-wire-a-program')
    await c.clickOn('#run-command')
    await sleep(250)
    await check('No Sounds silences errors and blocked-owner clicks', 'window.__audio.length === 0')
    await clickText('OK')
    await clickText('Cancel')
    await run('control')
    await c.clickOn('[data-applet="sounds"]', { count: 2 })
    await c.clickOn('[aria-label="Sound scheme"]')
    await c.key('Home')
    await c.key('Enter')
    await clickText('OK')
    await c.key('F4', ['Alt'])
    await shutdown()
    await hear('chimes', 'Logoff plays the chimes exit buffer')
  }
  if (item === 'cursors') {
    await check(
      'Boot uses the real wait cursor',
      'window.__cursors.filter(entry => entry.kind === "wait" && entry.cursor.includes("wait_r"))',
    )
    await run('notepad')
    await check(
      'Launch uses the real arrow-with-hourglass cursor',
      'window.__cursors.filter(entry => entry.kind === "busy" && entry.cursor.includes("busy_r"))',
    )
    await c.waitFor('!document.documentElement.dataset.systemCursor')
    await check(
      'Cursor returns to the real arrow after painting',
      'getComputedStyle(document.body).cursor.includes("arrow_r")',
      'cursor-ready',
    )
    await check(
      'Taskbar resize cursor uses the exported value',
      '[...document.querySelectorAll("[style]")].some(el => el.style.cursor.includes("var(--cursor-ns-resize"))',
    )
  }
  writeFileSync(join(proof, `${item}.json`), `${JSON.stringify({ port, item, checks }, null, 2)}\n`)
} catch (error) {
  console.log(await c.eval('document.body.innerText'))
  await c.shot(join(proof, `${item}-failure.png`))
  throw error
} finally {
  c.close()
}
