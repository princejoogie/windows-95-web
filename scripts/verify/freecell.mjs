// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { rules, solve } from './freecell-solve.mjs'

const [port = '9370', proofDir = 'D:/codes/worktrees/windows-95-web/proof/freecell'] = process.argv.slice(2)
mkdirSync(proofDir, { recursive: true })
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((target) => target.type === 'page')
assert(page, 'Electron page exists')
assert(page.url.startsWith('file:'), 'Verify the built Electron app')
const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
const failures = []
const checks = []
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'Runtime.exceptionThrown') failures.push(message.params.exceptionDetails)
  const request = pending.get(message.id)
  if (!request) return
  clearTimeout(request.timeout)
  pending.delete(message.id)
  if (message.error) request.reject(new Error(JSON.stringify(message.error)))
  else request.resolve(message.result)
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const requestId = ++id
    const timeout = setTimeout(() => {
      pending.delete(requestId)
      reject(new Error(`Timed out: ${method}`))
    }, 10000)
    pending.set(requestId, { resolve, reject, timeout })
    socket.send(JSON.stringify({ id: requestId, method, params }))
  })
const wait = (duration = 45) => new Promise((resolve) => setTimeout(resolve, duration))
async function read(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  assert(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
  return result.result?.value
}
async function check(expression, name) {
  assert(await read(expression), name)
  checks.push(name)
  console.log(`PASS ${name}`)
}
const element = (selector) => `document.querySelector(${JSON.stringify(selector)})`
const button = (name) =>
  `Array.from(document.querySelectorAll('button')).find(el => el.textContent.trim() === ${JSON.stringify(name)} || el.getAttribute('aria-label') === ${JSON.stringify(name)})`
const dialogButton = (name) =>
  `Array.from(document.querySelectorAll('[role=dialog] button')).find(el => el.textContent.trim() === ${JSON.stringify(name)})`
async function click(expression, top = false) {
  const position = await read(
    `(() => { const el = ${expression}; if (!el) throw Error('Missing click target'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + ${top ? '10' : 'r.height / 2'} }; })()`,
  )
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...position })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...position, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...position,
    button: 'left',
    clickCount: 1,
  })
  await wait()
}
async function key(key, modifiers = 0) {
  const code =
    {
      Enter: 13,
      Escape: 27,
      Tab: 9,
      Alt: 18,
      ' ': 32,
      ArrowLeft: 37,
      ArrowUp: 38,
      ArrowRight: 39,
      ArrowDown: 40,
      F1: 112,
      F2: 113,
      F3: 114,
      F4: 115,
      F5: 116,
      F10: 121,
    }[key] ?? key.toUpperCase().charCodeAt(0)
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    modifiers,
    windowsVirtualKeyCode: code,
    ...(key === 'Enter' ? { text: '\r' } : {}),
  })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers, windowsVirtualKeyCode: code })
  await wait()
}
async function fill(selector, text) {
  await click(element(selector))
  await key('a', 2)
  await send('Input.insertText', { text })
  await wait()
}
async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(proofDir, `${name}.png`), Buffer.from(data, 'base64'))
}
async function menu(name, item) {
  await click(button(name))
  await click(
    `Array.from(document.querySelectorAll('.freecell [role=menu] button')).find(el => el.textContent.trim().startsWith(${JSON.stringify(item)}))`,
  )
}
async function selectGame(number) {
  await key('F3')
  await fill('[aria-label="Game number"]', String(number))
  await key('Enter')
  if (await read("document.body.textContent.includes('If you quit now')")) await click(dialogButton('Yes'))
  await check(
    `document.querySelector('.freecell').dataset.gameNumber === ${JSON.stringify(String(number))}`,
    `Selected game #${number}`,
  )
}
async function snapshotBoard() {
  return read(`({
    columns: Array.from(document.querySelectorAll('.freecell-column')).map(el => Array.from(el.querySelectorAll('[data-card]')).map(el => el.dataset.card)),
    cells: Array.from(document.querySelectorAll('[data-cell]')).map(el => el.getAttribute('aria-label')),
    homes: Array.from(document.querySelectorAll('[data-home]')).map(el => Number(el.dataset.count)),
    moves: Number(document.querySelector('.freecell').dataset.moves)
  })`)
}
function sameBoard(actual, expected) {
  assert.deepEqual(
    actual.columns,
    expected.columns.map((column) => column.map((card) => `${card.rank}-${card.suit}`)),
  )
  assert.deepEqual(
    actual.homes,
    expected.homes.map((home) => home.length),
  )
  assert.equal(actual.moves, expected.moves)
  for (const [index, card] of expected.cells.entries()) {
    assert(
      card
        ? actual.cells[index].includes(
            `${({ 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' })[card.rank] ?? card.rank} of ${card.suit}`,
          )
        : actual.cells[index].endsWith('empty'),
    )
  }
}
const sourceElement = (source) =>
  element(
    source.kind === 'cell'
      ? `[data-cell="${source.cell}"]`
      : `[data-column="${source.column}"] [data-index="${source.index}"]`,
  )
async function play(source, target, current) {
  await click(sourceElement(source), source.kind === 'column')
  if (target.kind === 'column') {
    const length = current.position.columns[target.column].length
    await click(
      element(
        length
          ? `[data-column="${target.column}"] [data-index="${length - 1}"]`
          : `[data-column="${target.column}"] .freecell-empty`,
      ),
      true,
    )
  } else await click(element(`[data-${target.kind}="${target.cell}"]`))
  if (await read('Boolean(document.querySelector(\'[aria-label="Move to Empty Column"]\'))')) {
    if (rules.sourceCards(current.position, source).length === 1) {
      await click(element('input[name="freecell-move"]:not(:checked)'))
    }
    await key('Enter')
  }
  const next = rules.move(current, source, target)
  assert.notEqual(next, current, 'Planned move is legal')
  sameBoard(await snapshotBoard(), next.position)
  return next
}
async function launchFreeCell() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await read(`Boolean(${button('Start')})`)) break
    await wait(100)
  }
  await click(button('Start'))
  await click(button('Run...'))
  await fill('[role="dialog"] input', 'FREECELL.EXE')
  await key('Enter')
  await check("Boolean(document.querySelector('.freecell'))", 'Run launches FREECELL.EXE')
}

try {
  await send('Runtime.enable')
  await send('Page.reload')
  await wait(500)
  await launchFreeCell()
  await read(
    `window.freecellAudioProof = []; (() => { const originalStart = AudioBufferSourceNode.prototype.start; AudioBufferSourceNode.prototype.start = function (...args) { const result = originalStart.apply(this, args); window.freecellAudioProof.push({ duration: this.buffer?.duration, state: this.context.state }); return result; }; })()`,
  )
  await key('F4')
  await click(dialogButton('Clear'))
  await click(dialogButton('Yes'))
  await click(dialogButton('OK'))
  await key('F5')
  const options = await read(
    "Array.from(document.querySelectorAll('[role=dialog] input')).map(el => el.checked)",
  )
  if (!options[0]) await click(element('[role=dialog] input:first-of-type'))
  if (options[1]) await click(element('[role=dialog] label:last-of-type input'))
  await key('Enter')

  await selectGame(1)
  let game = rules.newGame(rules.gameNumber('1'))
  sameBoard(await snapshotBoard(), game.position)
  await check(
    "Array.from(document.querySelectorAll('.freecell-card img')).every(el => el.width === 71 && el.height === 96)",
    'Cards retain native 71 by 96 size',
  )
  await shot('deal-1')
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 60, y: 100 })
  await check("document.querySelector('.freecell-king').dataset.look === 'left'", 'King looks left')
  await shot('king-left')
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 700, y: 100 })
  await check("document.querySelector('.freecell-king').dataset.look === 'right'", 'King looks right')
  await shot('king-right')

  await key('F3')
  await fill('[aria-label="Game number"]', '32001')
  await key('Enter')
  await check(
    "document.querySelector('[role=alert]').textContent.includes('between 1 and 32000')",
    'Rejects invalid game number',
  )
  await shot('invalid-number')
  await key('Escape')
  await selectGame(617)
  sameBoard(await snapshotBoard(), rules.newGame(rules.gameNumber('617')).position)
  await shot('deal-617')
  await selectGame(1)

  await click(sourceElement({ kind: 'column', column: 0, index: 6 }), true)
  await check(
    "document.querySelector('[data-column=\"0\"] [data-index=\"6\"]').getAttribute('aria-pressed') === 'true'",
    'Click selects a card',
  )
  await shot('selected-card')
  await click(element('[data-home="0"]'))
  await check("document.body.textContent.includes('That move is not allowed.')", 'Illegal move message')
  sameBoard(await snapshotBoard(), game.position)
  await shot('illegal-move')
  await key('Enter')

  await key('F5')
  await key('d', 1)
  await key('q', 1)
  await key('Escape')
  await key('F5')
  await check(
    "Array.from(document.querySelectorAll('[role=dialog] input')).map(el => el.checked).join(',') === 'true,false'",
    'Options Cancel discards edits',
  )
  await key('d', 1)
  await key('q', 1)
  await shot('options')
  await key('Enter')
  await click(sourceElement({ kind: 'column', column: 0, index: 6 }), true)
  await click(element('[data-home="0"]'))
  await check("!document.querySelector('[role=dialog]')", 'Illegal move messages can be disabled')
  sameBoard(await snapshotBoard(), game.position)
  await key('F5')
  await key('d', 1)
  await key('q', 1)
  await key('Enter')

  game = await play({ kind: 'column', column: 5, index: 5 }, { kind: 'cell', cell: 0 }, game)
  game = await play({ kind: 'column', column: 5, index: 4 }, { kind: 'cell', cell: 1 }, game)
  await check(
    'Number(document.querySelector(\'[data-home="0"]\').dataset.count) === 2',
    'Safe exposed Aces and Twos move home',
  )
  await shot('automatic-home')
  await key('F10')
  game = rules.undo(game)
  sameBoard(await snapshotBoard(), game.position)
  await shot('undo')
  checks.push('F10 restores the move and automatic home moves')
  await selectGame(1)
  game = rules.newGame(rules.gameNumber('1'))
  await key('F4')
  await click(dialogButton('Clear'))
  await click(dialogButton('Yes'))
  await click(dialogButton('OK'))

  await key('Alt', 1)
  await key('ArrowRight')
  await key('a')
  await check(
    'Boolean(document.querySelector(\'[aria-label="About FreeCell"]\'))',
    'Alt and arrow menu navigation opens About',
  )
  await shot('about')
  await key('Enter')
  await key('F1')
  await check(
    "Boolean(document.querySelector('.freecell')) && !document.querySelector('[role=dialog]')",
    'Help Topics is harmless without the Help viewer',
  )
  await click(button('Game'))
  await shot('game-menu')
  await key('Escape')

  game = await play({ kind: 'column', column: 0, index: 6 }, { kind: 'cell', cell: 0 }, game)
  await menu('Game', 'Restart Game')
  await shot('restart-confirmation')
  await click(dialogButton('No'))
  sameBoard(await snapshotBoard(), game.position)
  await menu('Game', 'Restart Game')
  await click(dialogButton('Yes'))
  game = rules.newGame(rules.gameNumber('1'))
  sameBoard(await snapshotBoard(), game.position)
  await key('F4')
  await check(
    "document.querySelector('[data-stat=lost]').textContent === '1'",
    'Restart of a started game records one loss',
  )
  await shot('statistics-loss')
  await key('Escape')

  const solutionPath = join(proofDir, 'solution-1.json')
  let solution
  try {
    solution = JSON.parse(readFileSync(solutionPath, 'utf8'))
  } catch {
    solution = solve(1)
    writeFileSync(solutionPath, `${JSON.stringify(solution, null, 2)}\n`)
  }
  let promptProved = false
  let singleProved = false
  let quickProved = false
  let runProved = false
  for (const [index, step] of solution.steps.entries()) {
    const { source, target } = step
    const count = rules.sourceCards(game.position, source).length
    if (count > 1) runProved = true
    if (
      !promptProved &&
      count > 1 &&
      target.kind === 'column' &&
      !game.position.columns[target.column].length
    ) {
      await click(sourceElement(source), true)
      await click(element(`[data-column="${target.column}"] .freecell-empty`), true)
      await check(
        'Boolean(document.querySelector(\'[aria-label="Move to Empty Column"]\'))',
        'Empty column asks column or single card',
      )
      await shot('move-column-prompt')
      await key('Escape')
      sameBoard(await snapshotBoard(), game.position)

      await click(sourceElement(source), true)
      await click(element(`[data-column="${target.column}"] .freecell-empty`), true)
      await click(element('input[name="freecell-move"]:not(:checked)'))
      await shot('move-single-prompt')
      await key('Enter')
      const single = { ...source, index: game.position.columns[source.column].length - 1 }
      const singleGame = rules.move(game, single, target)
      sameBoard(await snapshotBoard(), singleGame.position)
      await shot('move-single-result')
      await key('F10')
      sameBoard(await snapshotBoard(), game.position)
      singleProved = true

      await key('F5')
      await key('q', 1)
      await key('Enter')
      const moved = await play(source, target, game)
      await check("!document.querySelector('[role=dialog]')", 'Quick play moves a column without a prompt')
      await shot('quick-play-column')
      await key('F10')
      sameBoard(await snapshotBoard(), game.position)
      assert.notDeepEqual(moved.position, game.position)
      await key('F5')
      await key('q', 1)
      await key('Enter')
      quickProved = true
      promptProved = true
    }
    game = await play(source, target, game)
    if ([15, 35, 55].includes(index)) await shot(`game-1-move-${index + 1}`)
  }
  assert(
    promptProved && singleProved && quickProved && runProved,
    'Solution exercises both empty-column options and multi-card moves',
  )
  checks.push(
    'Every move of game #1 matches the pure rules',
    'Move single card changes only the exposed card',
    'Multi-card moves obey capacity',
  )
  await check(
    "document.body.textContent.includes('Congratulations, you win!') && document.querySelector('.freecell').dataset.phase === 'won'",
    'Complete game #1 reaches the win dialog',
  )
  await shot('win')
  await check(
    "document.querySelector('[role=dialog] p').textContent === 'Congratulations, you win!\\nDo you want to play again?'",
    'Win message has a real paragraph break',
  )
  await check(
    "window.freecellAudioProof.length >= 2 && window.freecellAudioProof.every(sound => sound.duration > 0 && sound.state === 'running')",
    'Warning and win sounds start real audio buffers',
  )
  await click(dialogButton('No'))
  await key('F4')
  await check(
    "document.querySelector('[data-stat=won]').textContent === '1' && document.querySelector('[data-stat=lost]').textContent === '1'",
    'One win and one loss counted exactly once',
  )
  await shot('statistics-win')
  await key('Escape')
  await key('F10')
  await check(
    "document.querySelector('.freecell').dataset.phase === 'won'",
    'Undo is unavailable after winning',
  )
  await key('F5')
  await key('q', 1)
  await key('Enter')
  await menu('Game', 'Exit')
  await check("!document.querySelector('.freecell')", 'Exit closes the game')
  await send('Page.reload')
  await wait(500)
  await launchFreeCell()
  await key('F4')
  await check(
    "document.querySelector('[data-stat=won]').textContent === '1' && document.querySelector('[data-stat=lost]').textContent === '1'",
    'Statistics survive renderer reload and relaunch',
  )
  await shot('statistics-persisted')
  await key('Escape')
  await key('F5')
  await check(
    "Array.from(document.querySelectorAll('[role=dialog] input')).map(el => el.checked).join(',') === 'true,true'",
    'Options survive renderer reload and relaunch',
  )
  await shot('options-persisted')
  await key('Escape')
  await key('F2')
  await check(
    "Number(document.querySelector('.freecell').dataset.gameNumber) >= 1 && Number(document.querySelector('.freecell').dataset.gameNumber) <= 32000 && document.querySelectorAll('[data-card]').length === 52",
    'F2 deals a new numbered game',
  )
  await selectGame(1)
  await shot('final-board')
  assert.deepEqual(failures, [], 'No renderer exceptions')
  checks.push('No renderer exceptions')
  writeFileSync(
    join(proofDir, 'cdp-results.json'),
    `${JSON.stringify({ url: page.url, checks, solutionMoves: solution.steps.length, failures }, null, 2)}\n`,
  )
  console.log(`PASS ${checks.length} checks, ${solution.steps.length} solution moves`)
} catch (error) {
  await shot('failure')
  writeFileSync(
    join(proofDir, 'cdp-failure.json'),
    `${JSON.stringify({ checks, error: String(error), stack: error.stack, failures }, null, 2)}\n`,
  )
  throw error
} finally {
  socket.close()
}
