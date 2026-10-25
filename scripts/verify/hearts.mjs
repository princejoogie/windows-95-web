// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const port = process.argv[2] ?? '9371'
const proof = resolve(process.argv[3] ?? 'D:/codes/worktrees/windows-95-web/proof/hearts')
mkdirSync(proof, { recursive: true })
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((target) => target.type === 'page' && !target.url.startsWith('devtools:'))
assert.ok(page, 'Electron exposes a renderer target')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((done) => ws.addEventListener('open', done, { once: true }))
let sequence = 0
let pageLoads = 0
const pending = new Map()
const results = []
const exceptions = []
const audioNodes = []
const delay = (ms) => new Promise((done) => setTimeout(done, ms))
ws.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'Page.loadEventFired') pageLoads++
  if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails)
  if (message.method === 'WebAudio.audioNodeCreated') audioNodes.push(message.params.node.nodeType)
  if (!message.id) return
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  clearTimeout(request.timer)
  if (message.error) request.reject(new Error(JSON.stringify(message.error)))
  else request.done(message.result)
})
function send(method, params = {}) {
  return new Promise((done, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`${method} timed out`))
    }, 15000)
    pending.set(id, { done, reject, timer })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(fn, value) {
  const result = await send('Runtime.evaluate', {
    expression: `(${fn})(${JSON.stringify(value) ?? 'undefined'})`,
    awaitPromise: true,
    returnByValue: true,
  })
  assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails))
  return result.result.value
}
function check(value, name) {
  assert.ok(value, name)
  results.push(name)
  process.stdout.write(`PASS ${name}\n`)
}
async function wait(fn, label = 'condition') {
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const value = await evaluate(`() => Boolean((${fn})())`)
      if (value) return value
    } catch (error) {
      if (!/navigated|context|document is not defined/.test(String(error))) throw error
    }
    await delay(30)
  }
  throw new Error(`Timed out waiting for ${label}`)
}
async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(proof, `${name}.png`), Buffer.from(result.data, 'base64'))
}
async function click(selector, card = false) {
  const point = await evaluate(
    ({ selector, card }) => {
      const node = document.querySelector(selector)
      if (!node) throw new Error(`Missing ${selector}`)
      const box = node.getBoundingClientRect()
      return { x: box.x + (card ? 6 : box.width / 2), y: box.y + (card ? 10 : box.height / 2) }
    },
    { selector, card },
  )
  await mouse(point)
}
async function mouse(point) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point })
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 })
  await delay(15)
}
async function button(text, scope = '') {
  const point = await evaluate(
    ({ text, scope }) => {
      const root = scope ? document.querySelector(scope) : document
      const node = Array.from(root.querySelectorAll('button')).find(
        (node) => (node.querySelector(':scope > .flex-1')?.textContent ?? node.textContent).trim() === text,
      )
      if (!node) throw new Error(`Missing button ${text}`)
      const box = node.getBoundingClientRect()
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    },
    { text, scope },
  )
  await mouse(point)
}
async function key(key, code = key, virtual = 0) {
  const input = { key, code, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual }
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    ...input,
    text: key === 'Enter' ? '\r' : key === ' ' ? ' ' : undefined,
  })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...input })
  await delay(20)
}
async function fill(selector, text) {
  await evaluate((selector) => {
    const input = document.querySelector(selector)
    input.focus()
    input.select()
  }, selector)
  await send('Input.insertText', { text })
}
const network = '[role="dialog"][aria-label="The Microsoft Hearts Network"]'
const score = '[role="dialog"][aria-label="Score"]'
async function launch() {
  await click('[data-start-button]')
  await button('Run...')
  await wait(() => document.querySelector('#run-command'))
  await fill('#run-command', 'MSHEARTS.EXE')
  await key('Enter', 'Enter', 13)
  await wait(() => document.querySelector('[role="dialog"][aria-label="The Microsoft Hearts Network"]'))
}
async function state() {
  return evaluate(() => {
    const table = document.querySelector('.hearts-table')
    return {
      ...table.dataset,
      cards: Array.from(table.querySelectorAll('[data-card]')).map((node) => ({
        id: node.dataset.card,
        legal: node.dataset.legal === 'true',
        selected: node.getAttribute('aria-pressed') === 'true',
      })),
      plays: Array.from(table.querySelectorAll('[data-played-by]')).map((node) => ({
        seat: Number(node.dataset.playedBy),
        label: node.alt,
        points: Number(node.dataset.points),
      })),
      counts: Array.from(table.querySelectorAll('[data-player]')).map((node) => Number(node.dataset.count)),
      dialog: document.querySelector('[role="dialog"]')?.getAttribute('aria-label') ?? null,
    }
  })
}

try {
  await send('Runtime.enable')
  await send('Page.enable')
  await send('WebAudio.enable')
  await evaluate(() => localStorage.removeItem('w95.hearts.options.v1'))
  await send('Page.reload')
  for (let attempt = 0; pageLoads === 0 && attempt < 150; attempt++) await delay(30)
  assert.ok(pageLoads > 0, 'The renderer reloaded')
  await wait(() => document.querySelector('[data-start-button]'))
  await launch()
  check(
    await evaluate(() => document.querySelector('[role="dialog"] input').value === 'Player'),
    'The opening dialog asks for a name',
  )
  await shot('opening')
  await button('OK', network)
  await wait(() => document.body.textContent.includes('No dealer could be found'))
  check(true, 'Connect reports that no dealer could be found')
  await shot('no-dealer')
  await button('OK', '[role="dialog"][aria-label="Hearts"]')
  await fill(`${network} input:not([type="radio"])`, 'Prince')
  await click(`${network} input[type="radio"][accesskey="d"]`)
  await button('OK', network)
  await wait(() => document.querySelector('.hearts-table')?.dataset.phase === 'passing')
  let current = await state()
  check(
    current.cards.length === 13 && current.counts.every((count) => count === 13),
    'The dealer starts with four thirteen-card hands',
  )
  check(
    await evaluate(() =>
      ['Prince', 'Pauline', 'Michele', 'Ben'].every((name) =>
        Array.from(document.querySelectorAll('[data-name]')).some((node) => node.textContent === name),
      ),
    ),
    'The table seats Prince, Pauline, Michele, and Ben',
  )
  check(
    await evaluate(() =>
      Array.from(document.querySelectorAll('.hearts-card img')).every((node) => {
        const r = node.getBoundingClientRect()
        return r.width === 71 && r.height === 96
      }),
    ),
    'Cards use native 71 by 96 images',
  )
  await shot('table')
  await click('[data-window][aria-label="Hearts"] button[aria-label="Maximize"]')
  check(
    await evaluate(() =>
      Array.from(document.querySelectorAll('.hearts-card img')).every((node) => {
        const box = node.getBoundingClientRect()
        return box.width === 71 && box.height === 96
      }),
    ),
    'Maximizing changes the table spacing and keeps cards at native size',
  )
  await shot('maximized')
  await click('[data-window][aria-label="Hearts"] button[aria-label="Restore"]')
  const bounds = await evaluate(() =>
    document.querySelector('[data-window][aria-label="Hearts"]').getBoundingClientRect().toJSON(),
  )
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: bounds.right - 2, y: bounds.bottom - 2 })
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: bounds.right - 2,
    y: bounds.bottom - 2,
    button: 'left',
    clickCount: 1,
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: bounds.right - 122,
    y: bounds.bottom - 42,
    button: 'left',
    buttons: 1,
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: bounds.right - 122,
    y: bounds.bottom - 42,
    button: 'left',
    clickCount: 1,
  })
  await delay(40)
  check(
    await evaluate(() => {
      const table = document.querySelector('.hearts-table').getBoundingClientRect()
      return Array.from(document.querySelectorAll('.hearts-card')).every((node) => {
        const box = node.getBoundingClientRect()
        return box.width === 71 && box.height === 96 && box.left >= table.left && box.right <= table.right
      })
    }),
    'The minimum-size window keeps every card inside the table without scaling',
  )
  await shot('minimum-size')
  const smallBounds = await evaluate(() =>
    document.querySelector('[data-window][aria-label="Hearts"]').getBoundingClientRect().toJSON(),
  )
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: smallBounds.right - 2,
    y: smallBounds.bottom - 2,
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: smallBounds.right - 2,
    y: smallBounds.bottom - 2,
    button: 'left',
    clickCount: 1,
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: smallBounds.right + 118,
    y: smallBounds.bottom + 38,
    button: 'left',
    buttons: 1,
  })
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: smallBounds.right + 118,
    y: smallBounds.bottom + 38,
    button: 'left',
    clickCount: 1,
  })
  await key('F2', 'F2', 113)
  await wait(() => document.body.textContent.includes('Do you want to quit this game'))
  await shot('new-game-confirmation')
  await button('No', '[role="dialog"][aria-label="Hearts"]')
  check((await state()).phase === 'passing', 'Canceling F2 preserves the current hand')

  await button('Game')
  await shot('game-menu')
  await button('Score...')
  check(
    await evaluate(() => document.body.textContent.includes('No hands have been completed.')),
    'Game > Score opens an empty score sheet before the first hand',
  )
  await shot('score-empty')
  await button('OK', score)
  await button('Options')
  await shot('options-menu')
  await button('Sound')
  await button('Options')
  await button('Animation')
  check(
    await evaluate(() => {
      const p = JSON.parse(localStorage.getItem('w95.hearts.options.v1'))
      return p.sound === false && p.animation === false
    }),
    'Sound and Animation toggle and persist',
  )
  await button('Options')
  await button('Computer players...')
  await fill('[aria-label="Player 2"]', 'Ada')
  await shot('computer-players')
  await button('OK', '[role="dialog"][aria-label="Computer Players"]')
  check(
    await evaluate(() => document.querySelector('[data-name="1"]').textContent === 'Ada'),
    'Computer player names update after OK',
  )
  await button('Options')
  await button('Computer players...')
  await fill('[aria-label="Player 2"]', 'Pauline')
  await button('OK', '[role="dialog"][aria-label="Computer Players"]')
  await button('Help')
  await shot('help-menu')
  await button('About Hearts')
  check(
    await evaluate(() => document.body.textContent.includes('Version 4.00.950')),
    'About Hearts has the Windows 95 version layout',
  )
  await shot('about')
  await key('Escape', 'Escape', 27)
  await button('Help')
  await button('Help Topics')
  check(
    await evaluate(() => document.querySelector('.hearts-table')?.dataset.phase === 'passing'),
    'Help Topics stays harmless while the Help viewer is absent',
  )

  const hand = current.cards
  await click(`[data-card="${hand[0].id}"]`, true)
  await key('ArrowRight', 'ArrowRight', 39)
  check(
    await evaluate((id) => document.activeElement.dataset.card === id, hand[1].id),
    'Right Arrow moves keyboard focus to the next card',
  )
  await key(' ', 'Space', 32)
  await click(`[data-card="${hand[2].id}"]`, true)
  check(
    await evaluate(() => document.querySelectorAll('[aria-pressed="true"]').length === 3),
    'Mouse and keyboard select exactly three raised passing cards',
  )
  await click(`[data-card="${hand[3].id}"]`, true)
  check(
    await evaluate(() => document.querySelectorAll('[aria-pressed="true"]').length === 3),
    'A fourth card cannot be selected',
  )
  await shot('pass-left')
  await button('Options')
  await button('Sound')
  await click(`[data-card="${hand[0].id}"]`, true)
  await click(`[data-card="${hand[0].id}"]`, true)
  check(
    audioNodes.some((type) => type.includes('Oscillator')),
    'Sound creates a WebAudio oscillator for a card click',
  )
  await button('Options')
  await button('Sound')
  await button('Pass')
  check(
    await evaluate(() => document.querySelectorAll('[data-raised="true"]').length === 3),
    'The three received cards are raised for inspection',
  )
  await shot('received')
  await key('Enter', 'Enter', 13)
  await wait(() => {
    const t = document.querySelector('.hearts-table')
    return t.dataset.turn === '0' || t.dataset.phase === 'trick'
  })
  current = await state()
  if (current.turn === '0') {
    const illegal = current.cards.find((card) => !card.legal)
    if (illegal) {
      const count = current.cards.length
      await click(`[data-card="${illegal.id}"]`, true)
      await wait(() => document.querySelector('[role="dialog"][aria-label="Hearts"]'))
      check(
        (await state()).cards.length === count,
        'An illegal card stays in the hand and opens a rules message',
      )
      await shot('illegal-play')
      await button('OK', '[role="dialog"][aria-label="Hearts"]')
    }
  }

  const directions = new Set(['left'])
  let sawQueen = false
  let sawHearts = false
  let checkedPause = false
  let checkedAnimation = false
  let checkedFirst = false
  let sawMoon = false
  let legalChecks = 0
  let previousScores = [0, 0, 0, 0]
  let captured = 0
  let previousHand = 1
  let finished = false
  for (let step = 0; step < 3000; step++) {
    current = await state()
    const number = Number(current.hand)
    if (number !== previousHand) {
      captured = 0
      previousHand = number
    }
    assert.equal(
      current.cards.length + current.counts.reduce((sum, n) => sum + n, 0) + current.plays.length + captured,
      52,
      'Every card is in a hand, trick, or captured pile',
    )
    if (!directions.has(current.direction)) {
      directions.add(current.direction)
      await shot(`pass-${current.direction}`)
    }
    if (current.plays.some((play) => play.points === 13) && !sawQueen) {
      sawQueen = true
      await shot('queen-of-spades')
    }
    if (current.heartsBroken === 'true' && !sawHearts) {
      sawHearts = true
      await shot('hearts-broken')
    }
    if (current.phase === 'passing') {
      for (const card of current.cards.slice(-3)) await click(`[data-card="${card.id}"]`, true)
      await button('Pass')
    } else if (current.phase === 'receiving') await click('.hearts-continue')
    else if (current.phase === 'trick') {
      if (!checkedFirst) {
        check(current.plays[0].label.includes('played 2 of clubs'), 'The two of clubs leads the first trick')
        check(
          current.plays.every((play) => play.points === 0),
          'The first trick contains no point cards',
        )
        checkedFirst = true
        await shot('first-trick')
      }
      captured += 4
      await click('.hearts-continue')
    } else if (current.phase === 'scores') {
      captured = 52
      await wait(() => document.querySelector('[role="dialog"][aria-label="Score"]'))
      const scores = await evaluate(() =>
        Array.from(document.querySelectorAll('[data-total]')).map((n) => Number(n.textContent)),
      )
      const handPoints = await evaluate(() =>
        Array.from(document.querySelectorAll('[data-score-hand]:last-child td')).map((node) =>
          Number(node.textContent),
        ),
      )
      assert.deepEqual(
        scores,
        previousScores.map((value, seat) => value + handPoints[seat]),
        'The score sheet adds each hand to the running totals',
      )
      previousScores = scores
      if (handPoints.reduce((sum, value) => sum + value, 0) === 78 && !sawMoon) {
        check(
          handPoints.filter((value) => value === 0).length === 1 &&
            handPoints.filter((value) => value === 26).length === 3,
          'Shooting the moon gives the shooter zero and every opponent 26',
        )
        check(
          await evaluate(() => document.body.textContent.includes('shot the moon!')),
          'The score sheet announces who shot the moon',
        )
        await shot('shooting-the-moon')
        sawMoon = true
      }
      if (scores.some((value) => value >= 100)) {
        const names = await evaluate(() =>
          Array.from(document.querySelectorAll('[data-name]')).map((node) => node.textContent),
        )
        const winners = names.filter((_, seat) => scores[seat] === Math.min(...scores))
        const winnerText = await evaluate(() => document.querySelector('[data-game-over]')?.textContent)
        assert.equal(
          winnerText,
          `${winners.join(' and ')} ${winners.length === 1 ? 'wins' : 'win'} the game!`,
        )
        check(
          await evaluate(() => Boolean(document.querySelector('[data-game-over]'))),
          'At 100 points the final score sheet names the lowest-score winner',
        )
        await shot('game-end')
        finished = true
        break
      }
      if (number === 1) {
        check(
          scores.reduce((sum, n) => sum + n, 0) === 26 || scores.reduce((sum, n) => sum + n, 0) === 78,
          'The completed hand score sheet totals the hand points',
        )
        await shot('score-hand-1')
      }
      await button('OK', score)
    } else if (current.phase === 'playing' && current.turn === '0') {
      const options = current.cards.filter((card) => card.legal)
      const suit = (card) => card.id.split('-')[0]
      const points = (card) => (suit(card) === 'hearts' ? 1 : card.id === 'spades-12' ? 13 : 0)
      const leadSuit = current.plays[0]?.label.split(' ').at(-1)
      const following = current.cards.filter((card) => suit(card) === leadSuit)
      const noPoints = current.cards.filter((card) => points(card) === 0)
      const nonHearts = current.cards.filter((card) => suit(card) !== 'hearts')
      const expected = leadSuit
        ? following.length
          ? following
          : captured === 0 && noPoints.length
            ? noPoints
            : current.cards
        : captured === 0
          ? current.cards.filter((card) => card.id === 'clubs-2')
          : current.heartsBroken === 'false' && nonHearts.length
            ? nonHearts
            : current.cards
      assert.deepEqual(
        options.map((card) => card.id).sort(),
        expected.map((card) => card.id).sort(),
        'Visible legal cards obey follow-suit, first-trick, and broken-hearts rules',
      )
      legalChecks++
      assert.ok(options.length, 'The human has a legal play')
      if (!checkedPause && current.animation !== 'true') {
        await button('Options')
        await button('Animation')
      }
      const value = (card) => {
        const rank = Number(card.id.split('-')[1])
        return rank === 1 ? 14 : rank
      }
      const choice = [...options].sort((a, b) => value(b) - value(a))[0]
      await click(`[data-card="${choice.id}"]`, true)
      if (!checkedAnimation) {
        check(
          await evaluate(() => document.querySelector('[data-played-by="0"]').getAnimations().length > 0),
          'Animation moves a played card from the hand to the trick',
        )
        await shot('animation')
        checkedAnimation = true
      }
      if (!checkedPause && (await state()).phase === 'playing' && (await state()).turn !== '0') {
        await click('[data-window][aria-label="Hearts"] button[aria-label="Minimize"]')
        const paused = await state()
        await delay(850)
        assert.deepEqual(await state(), paused, 'Computer turns pause while minimized')
        await shot('minimized')
        await click('[data-task]')
        await button('Game')
        await button('Score...')
        const modalPaused = await state()
        await delay(850)
        assert.deepEqual(await state(), modalPaused, 'Computer turns pause under a score dialog')
        await button('OK', score)
        await click('[data-start-button]')
        await button('Run...')
        await fill('#run-command', 'NOTEPAD.EXE')
        await key('Enter', 'Enter', 13)
        await wait(() => document.querySelector('[data-window][aria-label="Untitled - Notepad"]'))
        const unfocused = await state()
        await delay(850)
        assert.deepEqual(await state(), unfocused, 'Computer turns pause while another app has focus')
        await shot('unfocused')
        await click('[data-window][aria-label="Untitled - Notepad"] button[aria-label="Close"]')
        await button('Options')
        await button('Animation')
        check(
          await evaluate(() =>
            Array.from(document.querySelectorAll('.hearts-play')).every(
              (node) => getComputedStyle(node).animationName === 'none',
            ),
          ),
          'Clearing Animation removes card movement',
        )
        checkedPause = true
        check(true, 'Computer turns pause while minimized, unfocused, and while a modal dialog is open')
      }
    } else await delay(30)
  }
  check(finished, 'A complete game finishes through the live UI')
  check(legalChecks >= 52, `Independent DOM checks verified ${legalChecks} legal human turns`)
  check(directions.size === 4, 'The live game cycles through left, right, across, and hold')
  check(sawQueen && sawHearts, 'Live tricks include the thirteen-point queen and broken hearts')
  await button('OK', score)
  check(
    await evaluate(() => document.querySelector('[role="dialog"]') === null),
    'OK dismisses the final score sheet',
  )
  await key('F2', 'F2', 113)
  await wait(() => document.querySelector('[role="dialog"][aria-label="The Microsoft Hearts Network"]'))
  check(
    await evaluate(() => document.querySelector('[role="dialog"] input').value === 'Prince'),
    'F2 starts another game and remembers the player name',
  )
  await button('Cancel', network)
  await button('Game')
  await button('Quit')
  check(await evaluate(() => !document.querySelector('.hearts')), 'Game > Quit closes Hearts')
  await click('[data-start-button]')
  await button('Programs')
  await button('Accessories')
  await button('Games')
  await shot('start-games')
  await button('Hearts')
  await wait(() => document.querySelector('[role="dialog"][aria-label="The Microsoft Hearts Network"]'))
  check(
    await evaluate(() => document.querySelector('[role="dialog"] input').value === 'Prince'),
    'Start > Programs > Accessories > Games launches Hearts with the saved name',
  )
  await button('Cancel', network)
  check(
    await evaluate(() => document.querySelector('.hearts-table').dataset.animation === 'false'),
    'Animation remains off after closing and reopening Hearts',
  )
  await button('Game')
  await button('Quit')
  check(exceptions.length === 0, 'No uncaught renderer exceptions occurred')
  writeFileSync(
    join(proof, 'cdp-results.json'),
    `${JSON.stringify({ port, target: page.url, assertions: results, legalChecks, sawMoon, audioNodes, exceptions }, null, 2)}\n`,
  )
} catch (error) {
  await shot('verification-failure').catch(() => {})
  writeFileSync(
    join(proof, 'cdp-failure.json'),
    `${JSON.stringify({ assertions: results, error: String(error), exceptions }, null, 2)}\n`,
  )
  throw error
} finally {
  ws.close()
}
