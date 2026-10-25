// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [port = '9340', proofDir = 'D:/codes/worktrees/windows-95-web/proof/minesfix', mode = 'full'] =
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
    type: key === 'Enter' ? 'keyDown' : 'rawKeyDown',
    key,
    windowsVirtualKeyCode: codes[key] || key.toUpperCase().charCodeAt(0),
    modifiers,
    ...(key === 'Enter' ? { code: 'Enter', text: '\r', unmodifiedText: '\r' } : {}),
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
      `(() => { const board=document.querySelector('.mine-board'); const win=board.closest('[data-window]'); const size=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}};return {board:size(board),window:win?size(win):null}; })()`,
    ),
  )
  if (mode !== 'rules') {
    await check(
      'Finding 13: cell numbers are pixel sprites',
      `[...document.querySelectorAll('.mine-open')].every(e=>!e.textContent.trim() && e.querySelector('img'))`,
    )
    await check(
      'Finding 13: all LED digits are 13 by 23',
      `[...document.querySelectorAll('.mine-counter img')].every(e=>e.naturalWidth===13 && e.naturalHeight===23 && e.width===13 && e.height===23)`,
    )
    await check(
      'Finding 13: 41 by 25 wells and 26 by 26 face',
      `[...document.querySelectorAll('.mine-counter')].every(e=>e.offsetWidth===41 && e.offsetHeight===25) && document.querySelector('.mine-face').offsetWidth===26 && document.querySelector('.mine-face').offsetHeight===26`,
    )
    await check(
      'Finding 13: sprites sit on whole pixels',
      `[...document.querySelectorAll('.mine-frame img')].every(e=>{const r=e.getBoundingClientRect();return Number.isInteger(r.x)&&Number.isInteger(r.y)})`,
    )
    await key('F2')
    for (let index = 0; index < 11; index++) await click(cell(index), 'right')
    await check(
      'Negative counter',
      `document.querySelector('output').getAttribute('aria-label')==='Mines left: -1'`,
    )
    await shot('after-negative-counter')
    await click(cell(0), 'right')
    await check(
      'Question mark is a sprite',
      `document.querySelector('[data-cell="0"]').getAttribute('aria-label').endsWith('question') && !!document.querySelector('[data-cell="0"] img')`,
    )
    await shot('after-question')
    const colorFlag = await evaluate(`document.querySelector('[data-cell="1"] img').src`)
    await menu('Game', 'Color')
    assert.notEqual(await evaluate(`document.querySelector('[data-cell="1"] img').src`), colorFlag)
    await check(
      'Finding 13: monochrome uses separate art without a filter',
      `document.querySelector('.minesweeper').classList.contains('mine-monochrome') && getComputedStyle(document.querySelector('.mine-frame')).filter==='none'`,
    )
    await shot('after-monochrome')
    await menu('Game', 'Color')
    await key('F2')
    const at = await point(cell(27))
    await mouse('mousePressed', at, 'left', 1)
    await check(
      'Surprised face while held',
      `document.querySelector('.mine-face').getAttribute('aria-label').includes('surprised')`,
    )
    await shot('after-surprised')
    await mouse('mouseReleased', at)
    let game = await state()
    const wrong = game.cells.findIndex((c) => !c.mine && c.cover === 'hidden')
    assert(wrong >= 0)
    await click(cell(wrong), 'right')
    await click(cell(game.cells.findIndex((c) => c.mine)))
    assert.equal((await state()).phase.kind, 'lost')
    await check(
      'Loss shows red mine, crossed mine, and dead face',
      `document.querySelectorAll('.mine-exploded img').length===1 && !!document.querySelector('[aria-label$="wrong flag"] img') && document.querySelector('.mine-face').getAttribute('aria-label').includes('dead')`,
    )
    await shot('after-loss')
    await menu('Game', 'Color')
    await shot('after-monochrome-loss')
    await menu('Game', 'Color')
    await key('F2')
    await click(cell(27))
    game = await state()
    const adjacent = (index) =>
      game.cells.flatMap((_, n) =>
        Math.abs((n % 8) - (index % 8)) <= 1 &&
        Math.abs(Math.floor(n / 8) - Math.floor(index / 8)) <= 1 &&
        n !== index
          ? [n]
          : [],
      )
    const chordIndex = game.cells.findIndex(
      (c, i) =>
        c.cover === 'open' &&
        c.adjacent > 0 &&
        adjacent(i).some((n) => !game.cells[n].mine && game.cells[n].cover === 'hidden'),
    )
    if (chordIndex >= 0) {
      for (const n of adjacent(chordIndex).filter((n) => game.cells[n].mine)) await click(cell(n), 'right')
      const before = game.cells.filter((c) => c.cover === 'open').length
      await click(cell(chordIndex), 'middle')
      game = await state()
      assert(game.cells.filter((c) => c.cover === 'open').length > before)
      assert.notEqual(game.phase.kind, 'lost')
      log('Chording opens safe neighbors', true)
      await shot('after-chord')
    }
    for (let index = 0; index < game.cells.length; index++) {
      if (!game.cells[index].mine && game.cells[index].cover !== 'open') await click(cell(index))
    }
    assert.equal((await state()).phase.kind, 'won')
    if (await evaluate(`!!document.querySelector('input[aria-label="Name"]')`)) {
      await fill('Name', 'Minesfix')
      await textClick('OK')
    }
    await check(
      'Win shows sunglasses and ten flags',
      `document.querySelector('.mine-face').getAttribute('aria-label').includes('sunglasses') && document.querySelectorAll('.mine-cell[aria-label$="flag"]').length===10`,
    )
    await shot('after-win')
    const wonTime = (await state()).elapsedMs
    await pause(1100)
    assert.equal((await state()).elapsedMs, wonTime)
    log('Win freezes time', true)
    await menu('Help')
    await check(
      'Finding 7: Help Topics and About menu',
      `JSON.stringify([...document.querySelectorAll('[role="menuitem"]')].map(e=>e.textContent.trim()))===JSON.stringify(['Help Topics','About Minesweeper'])`,
    )
    await shot('after-help-menu')
    await textClick('Help Topics', '[role="menuitem"]')
    await check(
      'Help Topics is harmless before viewer integration',
      `!!document.querySelector('.minesweeper') && !document.querySelector('[role="dialog"]')`,
    )
    await key('F1')
    await check(
      'F1 is harmless before viewer integration',
      `!!document.querySelector('.minesweeper') && !document.querySelector('[role="dialog"]')`,
    )
    await menu('Help', 'About Minesweeper')
    await check(
      'Finding 15: product, version, copyright and Windows artwork',
      `(() => {const d=document.querySelector('[role="dialog"]');return d.textContent.includes('Microsoft Windows 95') && d.textContent.includes('Version 4.0') && d.textContent.includes('1981-1995 Microsoft Corp.') && !d.textContent.includes('Find all the mines') && d.querySelector('img').complete})()`,
    )
    await shot('after-about')
    await key('Enter')
    await check('About default OK accepts Enter', `!document.querySelector('[role="dialog"]')`)
    await menu('Game', 'Intermediate')
    assert.deepEqual((await state()).size, { width: 16, height: 16, mines: 40 })
    await shot('after-intermediate')
    await menu('Game', 'Expert')
    assert.deepEqual((await state()).size, { width: 30, height: 16, mines: 99 })
    await shot('after-expert')
    await menu('Game', 'Custom...')
    for (const [label, value] of [
      ['Height', 9],
      ['Width', 9],
      ['Mines', 10],
    ])
      await fill(label, value)
    await textClick('OK')
    await menu('Game', 'Beginner')
    await menu('Game', 'Exit')
    await textClick('Minesweeper', '[role="option"]', true)
    await check(
      'Finding 5: saved 9 by 9 Custom cannot override Beginner',
      `JSON.parse(localStorage.getItem('win95.minesweeper')).custom.width===9 && document.querySelectorAll('.mine-cell').length===64`,
    )
    await shot('after-relaunch')
  }
  await menu('Game', 'Exit')
} finally {
  socket.close()
}
