import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [port = '9340', proofDir = 'D:/codes/worktrees/windows-95-web/proof/minesfix', mode = 'rules'] =
  process.argv.slice(2)
mkdirSync(proofDir, { recursive: true })
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((target) => target.type === 'page')
assert(page, `Electron page on port ${port}`)
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((done) => socket.addEventListener('open', done, { once: true }))
let sequence = 0
const pending = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  clearTimeout(request.timer)
  if (message.error) request.reject(new Error(JSON.stringify(message.error)))
  else request.resolve(message.result)
})
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Timed out: ${method}`))
    }, 10000)
    pending.set(id, { resolve, reject, timer })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
const pause = (ms = 80) => new Promise((done) => setTimeout(done, ms))
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  assert(!response.exceptionDetails, JSON.stringify(response.exceptionDetails))
  return response.result.value
}
function log(name, value) {
  appendFileSync(
    resolve(proofDir, 'observations.jsonl'),
    `${JSON.stringify({ at: new Date().toISOString(), mode, name, value })}\n`,
  )
  console.log(name, JSON.stringify(value))
}
async function check(name, expression) {
  const value = await evaluate(expression)
  assert(value, name)
  log(name, value)
}
async function shot(name) {
  const response = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(resolve(proofDir, `${name}.png`), Buffer.from(response.data, 'base64'))
}
async function point(selector) {
  return evaluate(
    `(() => { const e=document.querySelector(${JSON.stringify(selector)}); if(!e) throw Error('Missing '+${JSON.stringify(selector)}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
  )
}
async function mouse(type, at, button = 'left', buttons = 0, clickCount = 1) {
  await send('Input.dispatchMouseEvent', { type, ...at, button, buttons, clickCount })
  await pause(20)
}
async function click(selector, button = 'left', double = false) {
  const at = await point(selector)
  const buttons = button === 'right' ? 2 : button === 'middle' ? 4 : 1
  await mouse('mouseMoved', at, 'none')
  await mouse('mousePressed', at, button, buttons)
  await mouse('mouseReleased', at, button)
  if (double) {
    await mouse('mousePressed', at, button, buttons, 2)
    await mouse('mouseReleased', at, button, 0, 2)
  }
  await pause()
}
async function textClick(text, selector = 'button', double = false) {
  const at = await evaluate(
    String.raw`(() => { const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.replace(/\s+/g,' ').trim()===${JSON.stringify(text)}); if(!e) throw Error('Missing text '+${JSON.stringify(text)}); const r=e.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
  )
  await mouse('mouseMoved', at, 'none')
  await mouse('mousePressed', at, 'left', 1)
  await mouse('mouseReleased', at)
  if (double) {
    await mouse('mousePressed', at, 'left', 1, 2)
    await mouse('mouseReleased', at, 'left', 0, 2)
  }
  await pause()
}
async function key(key, modifiers = 0) {
  const codes = { Escape: 27, Enter: 13, F1: 112, F2: 113 }
  await send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key,
    windowsVirtualKeyCode: codes[key] || key.toUpperCase().charCodeAt(0),
    modifiers,
  })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers })
  await pause()
}
async function fill(label, value) {
  await click(`input[aria-label="${label}"]`)
  await key('a', 2)
  await send('Input.insertText', { text: String(value) })
}
async function menu(label, item) {
  await textClick(label)
  if (item) await textClick(item, '[role="menuitem"]')
}
const cell = (index) => `[data-cell="${index}"]`
const state = () =>
  evaluate(`(() => {
  const e=document.querySelector('.minesweeper');
  let root=e[Object.keys(e).find(k=>k.startsWith('__reactFiber'))];
  while(root.return) root=root.return;
  const queue=[root.stateNode.current]; let fiber;
  while(queue.length) { const n=queue.pop(); if(n.stateNode===e){fiber=n;break} if(n.sibling)queue.push(n.sibling); if(n.child)queue.push(n.child) }
  for(;fiber;fiber=fiber.return) for(let hook=fiber.memoizedState;hook;hook=hook.next) {
    const s=hook.memoizedState; if(s&&s.cells&&s.size&&s.phase)return s;
  }
  throw Error('Missing current game state');
})()`)

try {
  await send('Page.reload')
  for (let tries = 0; tries < 100; tries++) {
    if (await evaluate(`!!document.querySelector('[role="listbox"]')`)) break
    await pause()
  }
  await check('Production Electron page', `location.protocol==='file:' && devicePixelRatio===1`)
  await textClick('Minesweeper', '[role="option"]', true)
  await menu('Game', 'Beginner')
  await check('Finding 5: Beginner has 64 cells', `document.querySelectorAll('.mine-cell').length===64`)
  assert.deepEqual((await state()).size, { width: 8, height: 8, mines: 10 })
  log('Beginner size', (await state()).size)
  await shot('after-beginner')
  await menu('Game', 'Custom...')
  for (const [label, value] of [
    ['Height', 8],
    ['Width', 8],
    ['Mines', 10],
  ])
    await fill(label, value)
  await textClick('OK')
  await check(
    'Finding 5: Custom accepts 8 by 8',
    `document.querySelector('.mine-board').getAttribute('aria-label')==='Custom minefield, 8 by 8' && document.querySelectorAll('.mine-cell').length===64`,
  )
  await shot('after-custom-8x8')
  await menu('Game', 'Beginner')
  const starts = []
  for (let trial = 0; trial < 30; trial++) {
    await key('F2')
    await click(cell(27))
    const game = await state()
    assert(!game.cells[27].mine && game.phase.kind !== 'lost')
    assert.equal(game.cells.filter((c) => c.mine).length, 10)
    starts.push(game.cells[27].adjacent)
    if (game.cells[27].adjacent > 0) {
      assert.equal(game.cells.filter((c) => c.cover === 'open').length, 1)
      await shot('after-numbered-first-click')
      break
    }
  }
  assert(
    starts.some((n) => n > 0),
    'A first click can be numbered',
  )
  log('Finding 6: safe first clicks, including a number', starts)
  log(
    'Board and window dimensions',
    await evaluate(
      `(() => { const board=document.querySelector('.mine-board'); const win=board.closest('[data-window-id]'); const size=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}};return {board:size(board),window:win?size(win):null}; })()`,
    ),
  )
  if (mode === 'rules') await menu('Game', 'Exit')
} finally {
  socket.close()
}
