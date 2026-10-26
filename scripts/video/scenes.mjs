import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { join } from 'node:path'
import { element as el, textElement as text, wait } from './cdp.mjs'

const startButton = el('[data-start-button]')
const appWindow = '[data-window]'
const bottomLeft = { x: 0, y: 228, width: 960, height: 540 }

async function reset(c) {
  await c.reload()
  await c.until(`!!${startButton}`)
  await wait(150)
}
async function menu(c, name, item) {
  await c.click(text(name, '[role=menubar] button'))
  await c.click(text(item, '[role=menuitem]'))
}
async function run(c, command) {
  await c.click(startButton)
  await c.click(text('Run...'))
  await c.click(el('#run-command'))
  await c.key('a', 2)
  await c.type(command)
  await c.key('Enter')
  await wait(160)
}
async function launch(c, command) {
  await reset(c)
  await run(c, command)
  await center(c)
}
async function center(c) {
  const r = await c.eval(`document.querySelector('[data-window]').getBoundingClientRect().toJSON()`)
  const start = [r.x + r.width / 2, r.y + 12]
  const end = [512, Math.max(12, Math.round((740 - r.height) / 2) + 12)]
  await c.drag([start, end], 200)
  await wait(70)
}
async function choose(c, label, option) {
  await c.click(el(`[role=combobox][aria-label="${label}"]`))
  await c.click(text(option, '[role=option]'))
}
async function sourceModule(root, file, replacements = {}) {
  let source = stripTypeScriptTypes(readFileSync(join(root, file), 'utf8'))
  for (const [from, to] of Object.entries(replacements)) source = source.replace(from, to)
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
}
// Finds the production component's state hook from a rendered element. The video only reads or
// replaces state that the app's own engine produced or that an existing fixture defines.
const hookState = (selector, test, body) => `(() => {
  const node = document.querySelector(${JSON.stringify(selector)});
  let fiber = node[Object.keys(node).find(k => k.startsWith('__reactFiber$'))];
  while (fiber) {
    for (let hook = fiber.memoizedState; hook && typeof hook === 'object'; hook = hook.next) {
      const state = hook.memoizedState;
      if (${test} && hook.queue?.dispatch) { ${body} }
    }
    fiber = fiber.return;
  }
  throw Error('Cannot locate the production state hook from ${selector}');
})()`
async function loadNearWin(c, root) {
  const engine = await sourceModule(root, 'src/renderer/src/apps/solitaire/game.ts')
  const fixture = await sourceModule(root, 'src/renderer/src/apps/solitaire/fixtures.ts', {
    "from './game'": `from ${JSON.stringify(engine)}`,
  })
  const { proofDeal } = await import(fixture)
  await c.eval(
    hookState(
      '.solitaire',
      'state?.tableau && state?.foundations',
      `hook.queue.dispatch(${JSON.stringify(proofDeal('win'))}); return true;`,
    ),
  )
  await c.until(`!!document.querySelector('[data-card="spades-13"]')`)
}
// Reads the new game's seed and replays the production mine placement for every first click, so
// the driver can make the one real first click that opens the widest area near the board center.
async function planMinesweeper(c, root) {
  const { reveal, neighbors } = await import(
    await sourceModule(root, 'src/renderer/src/apps/minesweeper/game.ts')
  )
  const game = await c.eval(
    hookState('[data-cell="0"]', 'state?.cells && typeof state?.seed === "number"', 'return state;'),
  )
  if (game.phase.kind !== 'ready') throw new Error('Minesweeper must start from a fresh board')
  const { width, height } = game.size
  let best
  for (let index = 0; index < game.cells.length; index++) {
    const result = reveal(game, index)
    const opened = result.cells.filter((cell) => cell.cover === 'open').length
    const x = index % width
    const y = Math.floor(index / width)
    const score = opened - Math.hypot(x - (width - 1) / 2, (y - (height - 1) / 2) * 1.8)
    if (result.phase.kind === 'running' && (!best || score > best.score))
      best = { index, result, score, opened }
  }
  const border = best.result.cells
    .map((cell, index) => ({ cell, index }))
    .filter(
      ({ cell, index }) =>
        cell.mine && neighbors(game.size, index).some((next) => best.result.cells[next].cover === 'open'),
    )
    .map(({ index }) => ({
      index,
      distance: Math.hypot(
        (index % width) - (best.index % width),
        Math.floor(index / width) - Math.floor(best.index / width),
      ),
    }))
    .sort((a, b) => a.distance - b.distance)
  if (border.length < 2) throw new Error('The planned Minesweeper opening has no mines on its border')
  return { first: best.index, opened: best.opened, flags: border.slice(0, 2).map(({ index }) => index) }
}
const card = (id, title, subtitle, duration = 2.4) => ({ id, kind: 'card', title, subtitle, duration })

export const scenes = [
  card('opening', 'Windows 95', 'Rebuilt from scratch. Running offline.', 3.6),
  {
    id: 'boot',
    title: 'A cold boot',
    duration: 2.4,
    camera: 'full',
    async setup(c) {
      await c.reload()
    },
    async action(c) {
      await c.until(`!!${startButton}`, 2300)
      c.cue('boot')
      await c.check(`!!${startButton}`, 'Cold boot reaches the production desktop')
    },
  },
  {
    id: 'start',
    title: 'Programs > Accessories > Games',
    duration: 3.6,
    camera: 'full',
    async setup(c) {
      if (!(await c.eval(`!!${startButton}`))) await reset(c)
    },
    async action(c) {
      await wait(300)
      const opened = c.cutWhen(`!!document.querySelector('[role=menu]')`, bottomLeft)
      await c.click(startButton)
      await opened
      await wait(200)
      for (const name of ['Programs', 'Accessories', 'Games'])
        await c.hover(text(name, '[role=menuitem]'), 260)
      await c.hover(text('FreeCell', '[role=menuitem]'), 120)
      await c.hover(text('Minesweeper', '[role=menuitem]'), 0)
      await c.framed(['[data-start-button]', '[role=menu]'], 'Start menu cascade')
      await c.check(
        `document.body.textContent.includes('FreeCell') && document.querySelectorAll('[role=menu]').length >= 3`,
        'Start menu cascades into Games',
      )
    },
  },
  card('classics', 'The classics', 'Minesweeper, Solitaire, FreeCell, Hearts, Doom 95.'),
  {
    id: 'mines',
    title: 'Minesweeper Expert',
    duration: 4.8,
    camera: appWindow,
    pointer: [512, 600],
    async setup(c, root) {
      await launch(c, 'winmine')
      await menu(c, 'Game', 'Expert')
      await center(c)
      this.plan = await planMinesweeper(c, root)
      console.log(`  Plan first click ${this.plan.first} opens ${this.plan.opened} cells`)
    },
    async action(c) {
      const { first, flags } = this.plan
      const p = await c.point(el(`[data-cell="${first}"]`))
      await c.glide(...p)
      await c.mouse('mousePressed', ...p, { buttons: 1 })
      await wait(450)
      await c.check(
        `!!document.querySelector('[aria-label="New game, surprised face"]')`,
        'The face reacts to the held button',
      )
      await c.mouse('mouseReleased', ...p)
      c.cue('tick')
      await wait(700)
      await c.click(el(`[data-cell="${flags[0]}"]`), { button: 'right' })
      await wait(350)
      await c.click(el(`[data-cell="${flags[1]}"]`), { button: 'right' })
      await wait(450)
      await c.click(el(`[data-cell="${flags[1]}"]`), { button: 'right' })
      const counters = await c.eval(
        `[...document.querySelectorAll('output.mine-counter')].map((e) => e.getAttribute('aria-label'))`,
      )
      console.log(`  Counters read ${counters.join(' and ')}`)
      await c.check(
        `(() => { const [mines, time] = [...document.querySelectorAll('output.mine-counter')].map((e) => e.getAttribute('aria-label')); return mines === 'Mines left: 98' && /^Time: [1-9]$/.test(time) })()`,
        'Counters read 98 mines left and a running timer',
      )
      await c.framed(appWindow, 'Minesweeper Expert window')
      await c.check(
        `document.querySelectorAll('[data-cell]').length === 480 && document.querySelectorAll('.mine-cell.mine-open').length >= ${Math.min(this.plan.opened, 20)} && /flag$/.test(document.querySelector('[data-cell="${flags[0]}"]').getAttribute('aria-label')) && /question$/.test(document.querySelector('[data-cell="${flags[1]}"]').getAttribute('aria-label'))`,
        'Expert opens an area, then marks a flag and a question mark',
      )
    },
  },
  {
    id: 'solitaire-decks',
    title: 'Solitaire deck gallery',
    duration: 3.6,
    camera: appWindow,
    pointer: [600, 560],
    async setup(c) {
      await launch(c, 'sol')
      await menu(c, 'Game', 'Deck...')
    },
    async action(c) {
      await c.check(
        `document.querySelectorAll('input[name=solitaire-back]').length === 12`,
        'Twelve original app deck choices',
      )
      await c.framed([appWindow, '[role=dialog]'], 'Solitaire deck gallery')
      await wait(700)
      await c.click(el('input[name=solitaire-back][value="Robot"]'))
      await wait(250)
      await c.click(text('OK', '[role=dialog] button'))
      await wait(200)
      await c.click(el('button.solitaire-slot'))
    },
  },
  {
    id: 'solitaire-win',
    title: 'Solitaire win cascade',
    duration: 4.8,
    camera: appWindow,
    fixture: 'src/renderer/src/apps/solitaire/fixtures.ts proofDeal("win")',
    pointer: [700, 560],
    async setup(c, root) {
      await launch(c, 'sol')
      await loadNearWin(c, root)
    },
    async action(c) {
      await wait(300)
      await c.click(el('[data-card="spades-13"]'), { count: 2 })
      await c.until(`document.querySelector('[data-phase]')?.dataset.phase === 'won'`)
      await c.framed(appWindow, 'Solitaire window')
      await c.check(
        `!!document.querySelector('canvas')`,
        'The production win cascade paints from the existing near-win fixture',
      )
    },
  },
  {
    id: 'freecell',
    title: 'FreeCell game #1',
    duration: 4.8,
    camera: appWindow,
    pointer: [520, 560],
    async setup(c) {
      await launch(c, 'freecell')
      await menu(c, 'Game', 'Select Game...')
      await c.click(el('[role=dialog] input'))
      await c.key('a', 2)
      await c.type('1')
      await c.click(text('OK', '[role=dialog] button'))
    },
    async action(c) {
      await c.glide(240, 300)
      await wait(650)
      await c.check(
        `document.querySelector('.freecell-king').dataset.look === 'left'`,
        'The FreeCell king looks left',
      )
      await c.glide(790, 300)
      await wait(650)
      await c.check(
        `document.querySelector('.freecell-king').dataset.look === 'right'`,
        'The FreeCell king follows the pointer right',
      )
      await c.checkpoint('king-right')
      const jack = el('[data-card="11-diamonds"]')
      const p = await c.point(jack, [20, 6])
      await c.glide(...p)
      await c.mouse('mousePressed', ...p, { button: 'right', buttons: 2 })
      await wait(900)
      await c.check(
        `document.querySelector('[data-card="11-diamonds"]').classList.contains('freecell-preview')`,
        'The covered Jack rises while the right button is held',
      )
      await c.checkpoint('preview')
      await c.mouse('mouseReleased', ...p, { button: 'right' })
      await c.framed(appWindow, 'FreeCell window')
      await c.check(
        `document.body.textContent.includes('FreeCell Game #1')`,
        'FreeCell shows reproducible game #1',
      )
    },
  },
  {
    id: 'hearts',
    title: 'Hearts passing',
    duration: 4.8,
    camera: appWindow,
    pointer: [520, 330],
    async setup(c) {
      await launch(c, 'mshearts')
      await c.click(el('[role=dialog] input:not([type=radio])'))
      await c.key('a', 2)
      await c.type('Player')
      await c.click(text('I want to be dealer', '[role=dialog] label'))
      await c.click(text('OK', '[role=dialog] button'))
      await center(c)
    },
    async action(c) {
      const cards = await c.eval(
        `[...document.querySelectorAll('.hearts-hand [data-card]')].slice(-3).map(e=>e.dataset.card)`,
      )
      for (const id of cards) {
        await c.click(el(`[data-card="${id}"]`), { offset: [9, 20] })
        await wait(160)
      }
      await wait(250)
      await c.click(text('Pass'))
      await c.check(
        `document.querySelector('[aria-label="Hearts table"]').dataset.phase === 'receiving'`,
        'Hearts raises the received passing cards',
      )
      await c.checkpoint('received')
      await wait(1300)
      await c.click(el('[aria-label="Click to continue"]'))
      await c.framed(appWindow, 'Hearts window')
    },
  },
  {
    id: 'doom',
    title: 'Doom 95 corridor, combat, and automap',
    duration: 7.2,
    camera: appWindow,
    async setup(c) {
      await launch(c, 'doom95')
      await c.click(el('canvas'))
      await c.key('Enter')
      await c.key('Enter')
      await wait(250)
    },
    async action(c) {
      await c.keyDown('ArrowUp')
      await wait(1200)
      await c.keyUp('ArrowUp')
      await c.keyDown('Control')
      await wait(1500)
      await c.keyUp('Control')
      await c.keyDown('ArrowRight')
      await wait(220)
      await c.keyUp('ArrowRight')
      await c.keyDown('Control')
      await wait(900)
      await c.keyUp('Control')
      await c.key('Tab')
      await c.checkpoint('automap')
      await wait(1300)
      await c.key('Tab')
      await c.keyDown('ArrowLeft')
      await c.keyDown('ArrowUp')
      await wait(900)
      await c.keyUp('ArrowLeft')
      await c.keyUp('ArrowUp')
      await c.framed(appWindow, 'Doom 95 window')
      await c.check(
        `!!document.querySelector('canvas')`,
        'Doom gameplay and automap use the production canvas',
      )
    },
  },
  card('desktop', 'The desktop you remember', 'Paint, MS-DOS Prompt, Explorer, Display Properties.'),
  {
    id: 'paint',
    title: 'Drawing in Paint',
    duration: 8.4,
    camera: appWindow,
    pointer: [700, 560],
    async setup(c) {
      await launch(c, 'mspaint')
    },
    async action(c) {
      const origin = await c.point(el('canvas[aria-label="Paint canvas"]'), [0, 0])
      const path = (points) => points.map(([x, y]) => [origin[0] + x, origin[1] + y])
      await c.click(el('[aria-label="Line"]'))
      const lines = [
        [
          [80, 200],
          [360, 200],
        ],
        [
          [90, 200],
          [170, 95],
        ],
        [
          [170, 95],
          [240, 200],
        ],
        [
          [200, 200],
          [280, 90],
        ],
        [
          [280, 90],
          [350, 200],
        ],
      ]
      for (const line of lines) {
        await c.drag(path(line), 320)
        await wait(80)
      }
      await c.click(el('[aria-label="Ellipse"]'))
      await c.drag(
        path([
          [80, 45],
          [126, 91],
        ]),
        320,
      )
      await c.click(el('[aria-label="Fill With Color"]'))
      for (const [color, point] of [
        ['#ffff00', [103, 68]],
        ['#008000', [170, 150]],
        ['#008080', [280, 160]],
      ]) {
        await c.click(el(`[aria-label="Color ${color}"]`))
        await c.click(path([point])[0])
      }
      await c.click(el('[aria-label="Color #000080"]'))
      await c.click(el('[aria-label="Pencil"]'))
      await c.drag(
        path([
          [58, 220],
          [95, 216],
          [140, 222],
          [190, 217],
          [240, 223],
          [285, 217],
          [365, 222],
        ]),
        560,
      )
      await c.framed(appWindow, 'Paint window')
      await c.check(
        `(() => { const ctx = document.querySelector('canvas[aria-label="Paint canvas"]').getContext('2d'); const sun = ctx.getImageData(103,68,1,1).data; const mountain = ctx.getImageData(170,150,1,1).data; return sun[0] === 255 && sun[1] === 255 && sun[2] === 0 && mountain[0] === 0 && mountain[1] === 128 && mountain[2] === 0 })()`,
        'Trusted Paint strokes draw the landscape',
      )
    },
  },
  {
    id: 'dos',
    title: 'MS-DOS Prompt runs DIR',
    duration: 3.6,
    camera: appWindow,
    pointer: [760, 640],
    async setup(c) {
      await launch(c, 'command')
      await c.type('CD \\')
      await c.key('Enter')
    },
    async action(c) {
      await wait(450)
      await c.type('DIR', 200)
      await wait(150)
      await c.key('Enter')
      c.cue('key')
      await c.framed(appWindow, 'MS-DOS Prompt window')
      await c.check(
        `document.querySelector('.dos-screen').textContent.includes('Directory of')`,
        'DIR lists the virtual C drive',
      )
    },
  },
  {
    id: 'explorer',
    title: 'Exploring C drive',
    duration: 3.6,
    camera: 'full',
    pointer: [760, 640],
    async setup(c) {
      await launch(c, 'explorer')
    },
    async action(c) {
      await wait(500)
      await c.check(
        `!!document.querySelector('[role=tree]') && document.body.textContent.includes('Exploring')`,
        'Explorer shows its tree and C drive',
      )
      await c.hover(el('[aria-label="Expand WINDOWS"]'), 0)
      await c.camera(appWindow)
      await wait(200)
      await c.click(el('[aria-label="Expand WINDOWS"]'))
      await wait(450)
      await c.click(text('WINDOWS', '[role=treeitem] > span:last-child'))
      await c.until(`document.body.textContent.includes('Exploring - WINDOWS')`, 2000)
      await c.framed(appWindow, 'Explorer window')
    },
  },
  {
    id: 'display',
    title: 'Appearance schemes and screen saver',
    duration: 6.0,
    camera: '[role=dialog]',
    pointer: [560, 640],
    async setup(c) {
      await reset(c)
      await c.click([600, 400], { button: 'right' })
      await c.click(text('Properties', '[role=menuitem]'))
      await c.click(text('Appearance', '[role=tab]'))
    },
    async action(c) {
      await wait(200)
      await choose(c, 'Scheme', 'Eggplant')
      await c.click(text('Apply', '[role=dialog] button'))
      await wait(800)
      await choose(c, 'Scheme', 'Windows Standard')
      await c.click(text('Apply', '[role=dialog] button'))
      await wait(300)
      await c.click(text('Screen Saver', '[role=tab]'))
      await choose(c, 'Screen saver', 'Starfield Simulation')
      await c.framed('[role=dialog]', 'Display Properties dialog')
      await c.click(text('Preview', '[role=dialog] button'))
      await wait(1300)
      await c.check(
        `!!document.querySelector('canvas')`,
        'Display Properties starts its real screen saver preview',
      )
    },
  },
  card('closing', 'windows-95-web', 'Windows 95 in Electron.'),
  {
    id: 'shutdown',
    title: 'Safe to turn off',
    duration: 6.0,
    captureDuration: 4.4,
    camera: bottomLeft,
    pointer: [400, 600],
    setup: reset,
    async action(c) {
      await c.click(startButton)
      await c.click(text('Shut Down...'))
      await c.framed(['[role=dialog]', '[data-start-button]'], 'Shut Down dialog')
      await wait(450)
      const splash = c.cutWhen(`!!document.querySelector('[data-power-screen="shutting-down"]')`, 'full')
      await c.click(text('Yes', '[role=dialog] button'))
      await splash
      await c.cutWhen(`!!document.querySelector('[data-power-screen="off"]')`, 'center')
      await c.check(
        `document.querySelector('[data-power-screen="off"]').textContent.includes("It's now safe to turn off your computer.")`,
        'Shutdown ends on the safe-to-turn-off screen',
      )
    },
  },
]

// Beat-length highlights from the encoded scenes. Offsets are seconds into each scene.
export const teaser = [
  { scene: 'opening', from: 0, duration: 1.8 },
  { scene: 'start', from: 1.8, duration: 1.8 },
  { scene: 'mines', from: 0.6, duration: 1.2 },
  { scene: 'solitaire-win', from: 2.4, duration: 1.8 },
  { scene: 'doom', from: 1.2, duration: 1.8 },
  { scene: 'shutdown', from: 4.4, duration: 1.6 },
]

export const poster = { scene: 'start', at: 3.3 }
