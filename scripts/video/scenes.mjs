import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { join } from 'node:path'
import { element as el, textElement as text, wait } from './cdp.mjs'

async function reset(c) {
  await c.reload()
  await c.until(`!!document.querySelector('[data-start-button]')`)
  await wait(150)
}
async function menu(c, name, item) {
  await c.click(text(name, '[role=menubar] button'))
  await c.click(text(item, '[role=menuitem]'))
}
async function run(c, command) {
  await c.click(el('[data-start-button]'))
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
async function loadNearWin(c, root) {
  const engineSource = readFileSync(join(root, 'src/renderer/src/apps/solitaire/game.ts'), 'utf8')
  const fixtureSource = readFileSync(join(root, 'src/renderer/src/apps/solitaire/fixtures.ts'), 'utf8')
  const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
  const engine = moduleUrl(stripTypeScriptTypes(engineSource))
  const fixture = stripTypeScriptTypes(fixtureSource).replace(
    "from './game'",
    `from ${JSON.stringify(engine)}`,
  )
  const { proofDeal } = await import(moduleUrl(fixture))
  const state = proofDeal('win')
  await c.eval(`(() => {
    const node = document.querySelector('.solitaire');
    let fiber = node[Object.keys(node).find(k => k.startsWith('__reactFiber$'))];
    while (fiber) {
      for (let hook = fiber.memoizedState; hook && typeof hook === 'object'; hook = hook.next) {
        if (hook.memoizedState?.tableau && hook.memoizedState?.foundations && hook.queue?.dispatch) {
          hook.queue.dispatch(${JSON.stringify(state)}); return true;
        }
      }
      fiber = fiber.return;
    }
    throw Error('Cannot locate the Solitaire game hook for the existing near-win fixture');
  })()`)
  await c.until(`!!document.querySelector('[data-card="spades-13"]')`)
}
const card = (id, title, subtitle, duration = 2.4) => ({ id, kind: 'card', title, subtitle, duration })

export const scenes = [
  card('opening', 'Windows 95', 'Rebuilt from scratch. Running offline.', 3.6),
  {
    id: 'boot',
    title: 'A cold boot',
    duration: 4.8,
    backdrop: 'black',
    async setup(c) {
      await c.reload()
    },
    async action(c) {
      await wait(1850)
      await c.check(
        `!!document.querySelector('[data-start-button]')`,
        'Cold boot reaches the production desktop',
      )
    },
  },
  {
    id: 'start',
    title: 'Programs > Accessories > Games',
    duration: 3.6,
    setup: reset,
    async action(c) {
      await c.click(el('[data-start-button]'))
      for (const name of ['Programs', 'Accessories', 'Games']) {
        await c.hover(text(name, '[role=menuitem]'))
        await wait(220)
      }
      await c.check(
        `document.body.textContent.includes('FreeCell') && document.querySelectorAll('[role=menu]').length >= 3`,
        'Start menu cascades into Games',
      )
    },
  },
  card('classics', 'The classics', 'Minesweeper, Solitaire, FreeCell, Hearts.'),
  {
    id: 'mines',
    title: 'Minesweeper Expert',
    duration: 4.8,
    async setup(c) {
      await launch(c, 'winmine')
      await menu(c, 'Game', 'Expert')
      await center(c)
    },
    async action(c) {
      const first = el('[data-cell="0"]')
      await c.click(first, { button: 'right' })
      await wait(400)
      await c.click(first, { button: 'right' })
      await wait(400)
      await c.key('F2')
      await wait(250)
      const p = await c.point(first)
      await c.mouse('mousePressed', ...p, { buttons: 1 })
      await wait(450)
      await c.mouse('mouseReleased', ...p)
      c.cue('tick')
      await c.check(
        `document.querySelectorAll('[role=gridcell]').length === 480 || document.querySelectorAll('[data-cell]').length === 480`,
        'Expert has 480 cells',
      )
    },
  },
  {
    id: 'solitaire-decks',
    title: 'Solitaire deck gallery',
    duration: 3.6,
    async setup(c) {
      await launch(c, 'sol')
      await menu(c, 'Game', 'Deck...')
    },
    async action(c) {
      await c.check(
        `document.querySelectorAll('input[name=solitaire-back]').length === 12`,
        'Twelve original app deck choices',
      )
      await wait(1200)
      await c.click(el('input[name=solitaire-back][value="Robot"]'))
      await c.click(text('OK', '[role=dialog] button'))
      await c.click(el('button.solitaire-slot'))
    },
  },
  {
    id: 'solitaire-win',
    title: 'Solitaire win cascade',
    duration: 4.8,
    fixture: 'src/renderer/src/apps/solitaire/fixtures.ts proofDeal("win")',
    async setup(c, root) {
      await launch(c, 'sol')
      await loadNearWin(c, root)
    },
    async action(c) {
      await wait(300)
      await c.click(el('[data-card="spades-13"]'), { count: 2 })
      await c.until(`document.querySelector('[data-phase]')?.dataset.phase === 'won'`)
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
    async setup(c) {
      await launch(c, 'freecell')
      await menu(c, 'Game', 'Select Game...')
      await c.click(el('[role=dialog] input'))
      await c.key('a', 2)
      await c.type('1')
      await c.click(text('OK', '[role=dialog] button'))
    },
    async action(c) {
      await c.move(230, 300)
      await wait(700)
      await c.check(
        `document.querySelector('.freecell-king').dataset.look === 'left'`,
        'The FreeCell king looks left',
      )
      await c.move(780, 300)
      await wait(700)
      await c.check(
        `document.querySelector('.freecell-king').dataset.look === 'right'`,
        'The FreeCell king follows the pointer right',
      )
      await c.checkpoint('king-right')
      const jack = el('[data-card="11-diamonds"]')
      const p = await c.point(jack, [20, 6])
      await c.mouse('mousePressed', ...p, { button: 'right', buttons: 2 })
      await wait(900)
      await c.check(
        `document.querySelector('[data-card="11-diamonds"]').classList.contains('freecell-preview')`,
        'The covered Jack rises while the right button is held',
      )
      await c.checkpoint('preview')
      await c.mouse('mouseReleased', ...p, { button: 'right' })
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
    async setup(c) {
      await launch(c, 'mshearts')
      await c.click(el('[role=dialog] input:not([type=radio])'))
      await c.key('a', 2)
      await c.type('Player')
      await c.click(text('I want to be dealer', '[role=dialog] label'))
      await c.click(text('OK', '[role=dialog] button'))
    },
    async action(c) {
      const cards = await c.eval(
        `[...document.querySelectorAll('.hearts-hand [data-card]')].slice(0,3).map(e=>e.dataset.card)`,
      )
      for (const id of cards) {
        await c.click(el(`[data-card="${id}"]`), { offset: [9, 20] })
        await wait(220)
      }
      await wait(400)
      await c.click(text('Pass'))
      await c.check(
        `document.querySelector('[aria-label="Hearts table"]').dataset.phase === 'receiving'`,
        'Hearts raises the received passing cards',
      )
      await c.checkpoint('received')
      await wait(900)
      await c.click(el('[aria-label="Click to continue"]'))
    },
  },
  {
    id: 'doom',
    title: 'Doom 95 corridor, combat, and automap',
    duration: 8.4,
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
      await wait(1500)
      await c.key('Tab')
      await c.check(
        `!!document.querySelector('canvas')`,
        'Doom gameplay and automap use the production canvas',
      )
    },
  },
  card('desktop', 'The desktop you remember', 'Paint, MS-DOS Prompt, Windows Explorer.'),
  {
    id: 'paint',
    title: 'Drawing in Paint',
    duration: 7.2,
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
        await c.drag(path(line), 450)
        await wait(150)
      }
      await c.click(el('[aria-label="Ellipse"]'))
      await c.drag(
        path([
          [80, 45],
          [126, 91],
        ]),
        450,
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
        650,
      )
      await c.check(
        `(() => { const ctx = document.querySelector('canvas[aria-label="Paint canvas"]').getContext('2d'); const sun = ctx.getImageData(103,68,1,1).data; const mountain = ctx.getImageData(170,150,1,1).data; return sun[0] === 255 && sun[1] === 255 && sun[2] === 0 && mountain[0] === 0 && mountain[1] === 128 && mountain[2] === 0 })()`,
        'Trusted Paint strokes draw the landscape',
      )
    },
  },
  {
    id: 'dos',
    title: 'MS-DOS Prompt runs DIR',
    duration: 4.8,
    async setup(c) {
      await launch(c, 'command')
      await c.type('CD \\')
      await c.key('Enter')
    },
    async action(c) {
      await wait(350)
      await c.type('DIR', 180)
      await c.key('Enter')
      await c.check(
        `document.querySelector('.dos-screen').textContent.includes('Directory of')`,
        'DIR lists the virtual C drive',
      )
    },
  },
  {
    id: 'explorer',
    title: 'Exploring C drive',
    duration: 4.8,
    async setup(c) {
      await launch(c, 'explorer')
    },
    async action(c) {
      await wait(400)
      await c.check(
        `!!document.querySelector('[role=tree]') && document.body.textContent.includes('Exploring')`,
        'Explorer shows its tree and C drive',
      )
      const windows = el('[role=treeitem][aria-label="Windows"]')
      if (await c.eval(`!!${windows}`)) await c.click(windows)
      await wait(900)
    },
  },
  {
    id: 'display',
    title: 'Appearance schemes and screen saver',
    duration: 7.2,
    async setup(c) {
      await launch(c, 'control')
      await c.click(el('[data-shell-item="display"]'), { count: 2 })
      await c.click(text('Appearance', '[role=tab]'))
    },
    async action(c) {
      await choose(c, 'Scheme', 'Eggplant')
      await c.click(text('Apply', '[role=dialog] button'))
      await wait(650)
      await choose(c, 'Scheme', 'Windows Standard')
      await c.click(text('Apply', '[role=dialog] button'))
      await wait(400)
      await c.click(text('Screen Saver', '[role=tab]'))
      await choose(c, 'Screen saver', 'Starfield Simulation')
      await c.click(text('Preview', '[role=dialog] button'))
      await wait(1400)
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
    duration: 4.8,
    captureDuration: 3.3,
    backdrop: 'black',
    setup: reset,
    async action(c) {
      await c.click(el('[data-start-button]'))
      await c.click(text('Shut Down...'))
      await wait(350)
      await c.click(text('Yes', '[role=dialog] button'))
      await c.until(
        `document.querySelector('canvas')?.getAttribute('aria-label') === "It's now safe to turn off your computer."`,
        2500,
      )
    },
  },
]
