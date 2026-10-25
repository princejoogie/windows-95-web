// Drives Doom 95 in the production Electron build over CDP with trusted input, and checks what the
// canvas publishes in its data attributes. Usage: node scripts/verify/doomfix.mjs <port> <phase...>
// Phases: menus, pause, strafe, shell, automap, options, help, saves, all.
import { appendFileSync, mkdirSync } from 'node:fs'
import { connect, sleep } from './cdp.mjs'

const [port = '9400', ...phases] = process.argv.slice(2)
const PROOF = process.env.W95_PROOF ?? 'D:/codes/worktrees/windows-95-web/proof/doomfix'
mkdirSync(PROOF, { recursive: true })
const c = await connect(Number(port))
const results = []

function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail })
  appendFileSync(
    `${PROOF}/checks.jsonl`,
    `${JSON.stringify({ at: new Date().toISOString(), name, ok: !!ok, detail })}\n`,
  )
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}`)
}

export const data = () =>
  c.eval("JSON.parse(JSON.stringify(document.querySelector('[data-window] canvas')?.dataset ?? null))")
const player = async () => (await data()).player.split(',').map(Number)

async function shot(name) {
  const box = await c.eval(
    "(()=>{const w=document.querySelector('[data-window] canvas')?.closest('[data-window]');if(!w)return null;const b=w.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})()",
  )
  await c.shot(`${PROOF}/${name}.png`, box ?? undefined)
}

const CODES = {
  Pause: [19, 'Pause', 'Pause'],
  Alt: [18, 'AltLeft', 'Alt'],
  ArrowLeft: [37, 'ArrowLeft', 'ArrowLeft'],
  ArrowRight: [39, 'ArrowRight', 'ArrowRight'],
  ArrowUp: [38, 'ArrowUp', 'ArrowUp'],
  ArrowDown: [40, 'ArrowDown', 'ArrowDown'],
  Control: [17, 'ControlLeft', 'Control'],
  Shift: [16, 'ShiftLeft', 'Shift'],
  Tab: [9, 'Tab', 'Tab'],
  ' ': [32, 'Space', ' '],
  w: [87, 'KeyW', 'w'],
  a: [65, 'KeyA', 'a'],
  s: [83, 'KeyS', 's'],
  d: [68, 'KeyD', 'd'],
  f: [70, 'KeyF', 'f'],
}

/** Presses `keys` in order, holds them for `ms`, and releases them in reverse, all as trusted events. */
export async function hold(keys, ms) {
  const list = Array.isArray(keys) ? keys : [keys]
  const alt = list.includes('Alt') ? 1 : 0
  for (const k of list) {
    const [vk, code, key] = CODES[k]
    await c.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      code,
      windowsVirtualKeyCode: vk,
      modifiers: alt,
    })
  }
  await sleep(ms)
  for (const k of [...list].reverse()) {
    const [vk, code, key] = CODES[k]
    await c.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode: vk,
      modifiers: k === 'Alt' ? 0 : alt,
    })
  }
  await sleep(60)
}

export const tap = (key, mods) => (CODES[key] && !mods ? hold(key, 40) : c.key(key, mods))

/** Client coordinates of a framebuffer point, through the canvas's letterboxed scaling. */
async function client(x, y) {
  return c.eval(
    `(()=>{const r=document.querySelector('[data-window] canvas').getBoundingClientRect();const s=Math.min(r.width/320,r.height/200);return [r.left+(r.width-320*s)/2+${x}*s, r.top+(r.height-200*s)/2+${y}*s]})()`,
  )
}

export async function fbMove(x, y) {
  const [cx, cy] = await client(x, y)
  await c.move(cx, cy)
  await sleep(50)
}

export async function fbClick(x, y, options) {
  const [cx, cy] = await client(x, y)
  await c.click(cx, cy, options)
  await sleep(80)
}

/** Framebuffer rows from the same layout the game uses, copied here so the script needs no source access. */
const MAIN = ['New Game', 'Options', 'Load Game', 'Save Game', 'Read This!', 'Quit Game']
const mainRow = (i) => {
  const width = Math.max(...MAIN.map((l) => l.length * 12 - 2))
  return [Math.round(160 - width / 2) + 6, 44 + i * 19 + 7]
}

export async function launch(exe) {
  for (let i = 0; i < 3 && (await c.eval("!!document.querySelector('[role=dialog]')")); i++)
    await c.key('Escape')
  await c.clickOn('[data-start-button]')
  await sleep(200)
  await c.eval(
    "Array.from(document.querySelectorAll('[role=menu] button, [role=menuitem]')).find(e=>/^Run/.test(e.innerText.trim()))?.click()",
  )
  await c.waitFor("!!document.querySelector('#run-command')")
  await c.clickOn('#run-command')
  await c.key('a', ['Control'])
  await c.type(exe)
  await c.key('Enter')
  await sleep(400)
}

export async function launchDoom() {
  if (await c.eval("!!document.querySelector('[data-window] canvas')")) return
  await launch('DOOM95')
  await c.waitFor("!!document.querySelector('[data-window] canvas')?.dataset.frame", 6000)
  await sleep(400)
}

/** The title of the window on top, which is the focused one. */
const topWindow = () =>
  c.eval(
    "[...document.querySelectorAll('[data-window]')].filter(w=>!w.classList.contains('hidden')).sort((a,b)=>Number(b.style.zIndex)-Number(a.style.zIndex))[0]?.getAttribute('aria-label')",
  )

const screen = async () => (await data()).screen

/** From wherever the game is, starts level 1 on the middle skill with the keyboard. */
export async function newGame(skill = 2) {
  for (let i = 0; i < 4 && (await screen()) !== 'title' && !(await screen()).startsWith('menu'); i++)
    await tap('Escape')
  if ((await screen()) === 'title') await tap('Enter')
  for (let i = 0; i < 6 && (await screen()) !== 'menu-main'; i++) {
    await tap('Escape')
    if ((await screen()) === 'playing') await tap('Escape')
  }
  for (let i = 0; i < 6 && (await data()).cursor !== '0'; i++) await tap('ArrowUp')
  await tap('Enter')
  for (let i = 0; i < 5 && Number((await data()).cursor) !== skill; i++)
    await tap(Number((await data()).cursor) > skill ? 'ArrowUp' : 'ArrowDown')
  await tap('Enter')
  await sleep(300)
}

const PHASES = {
  async menus() {
    await launchDoom()
    await shot('title')
    check('title screen shows the help hint', (await screen()) === 'title')
    await fbClick(160, 120)
    check('a click on the title opens the main menu', (await screen()) === 'menu-main', await data())
    await shot('menu-main')
    const [qx, qy] = mainRow(5)
    await fbMove(qx, qy)
    check('hovering Quit Game selects it', (await data()).cursor === '5', (await data()).cursor)
    await shot('menu-hover-quit')
    await fbClick(qx, qy)
    check('clicking Quit Game opens the quit prompt', (await screen()) === 'menu-quit', await screen())
    await shot('menu-quit-prompt')
    await fbClick(190 + 4, 128)
    check(
      'clicking No returns to the main menu on Quit Game',
      (await screen()) === 'menu-main' && (await data()).cursor === '5',
    )
    await fbClick(4, 196)
    check('a click away from every row does nothing', (await screen()) === 'menu-main')
    const [nx, ny] = mainRow(0)
    await fbClick(nx, ny)
    check('clicking New Game opens the skill list', (await screen()) === 'menu-skill')
    const skillWidth = Math.max(
      ...['Training Wheels', 'Shore Leave', 'Standard Issue', 'Hard Contact', 'No Mercy'].map(
        (l) => l.length * 12 - 2,
      ),
    )
    await fbMove(Math.round(160 - skillWidth / 2) + 6, 66 + 3 * 19 + 7)
    check('hovering Hard Contact selects it', (await data()).cursor === '3')
    await shot('menu-skill-hover')
    await fbClick(4, 4, { button: 'right' })
    check('the right button backs out to the main menu', (await screen()) === 'menu-main')
    await fbClick(qx, qy)
    await fbClick(100 + 4, 128)
    await sleep(500)
    check(
      'clicking Yes on the quit prompt closes Doom',
      !(await c.eval("!!document.querySelector('[data-window] canvas')")),
    )
  },

  async pause() {
    await launchDoom()
    await newGame()
    await hold('w', 250)
    const before = await data()
    await tap('Pause')
    await sleep(100)
    const paused = await data()
    check('Pause sets the paused state', paused.paused === 'true', paused.paused)
    await hold('w', 500)
    await hold('Control', 300)
    await sleep(200)
    const during = await data()
    check(
      'time, position, and the trigger stay frozen while paused',
      during.time === paused.time && during.player === paused.player,
      { paused: paused.time, during: during.time },
    )
    await shot('pause-indicator')
    await tap('Pause')
    await hold('w', 300)
    const after = await data()
    check(
      'Pause again resumes, and the game moves on',
      after.paused === 'false' && Number(after.time) > Number(during.time) && after.player !== during.player,
      { before: before.player, after: after.player },
    )
    await shot('pause-resumed')
  },

  async strafe() {
    await launchDoom()
    await newGame()
    const [x0, y0, a0] = await player()
    await hold(['Alt', 'ArrowLeft'], 600)
    const [x1, y1, a1] = await player()
    check('Alt+Left strafes left without turning', a1 === a0 && Math.hypot(x1 - x0, y1 - y0) > 0.8, {
      from: [x0, y0, a0],
      to: [x1, y1, a1],
    })
    await shot('strafe-alt-left')
    await hold(['Alt', 'ArrowRight'], 600)
    const [x2, y2, a2] = await player()
    check('Alt+Right strafes back without turning', a2 === a0 && Math.hypot(x2 - x1, y2 - y1) > 0.8, {
      to: [x2, y2, a2],
    })
    await hold('a', 300)
    const [x3, y3] = await player()
    check('A still strafes', Math.hypot(x3 - x2, y3 - y2) > 0.3)
    await hold('ArrowLeft', 200)
    const [, , a4] = await player()
    check('Left alone still turns', a4 !== a2, { a2, a4 })
  },

  async help() {
    await launchDoom()
    while ((await screen()) !== 'title') await tap('Escape')
    await tap('F1')
    check('F1 on the title shows Read This!', (await screen()) === 'menu-help')
    await shot('help-screen')
    await tap('x')
    check('any key leaves the help screen', (await screen()) === 'title')
    await newGame()
    await tap('F1')
    check('F1 in play shows the help screen over the game', (await screen()) === 'menu-help')
    await tap('Escape')
    check('Esc returns to play', (await screen()) === 'playing')
    await tap('Escape')
    await fbClick(...mainRow(4))
    check('the Read This! menu item opens it too', (await screen()) === 'menu-help')
    await tap('Escape')
    check('and Esc goes back to the main menu', (await screen()) === 'menu-main')
    await tap('Escape')
  },

  async options() {
    await launchDoom()
    await newGame()
    await tap('F4')
    check('F4 opens Options', (await screen()) === 'menu-options')
    await shot('options-page')
    await tap('Enter')
    let o = JSON.parse((await data()).options)
    check('Enter on Screen Size turns the status bar off', o.statusBar === false, o)
    await tap('ArrowDown')
    for (let i = 0; i < 3; i++) await tap('ArrowLeft')
    await tap('ArrowDown')
    await fbClick(52 + 8 + 12 * 8 + 4, 40 + 2 * 38 + 18 + 4)
    o = JSON.parse((await data()).options)
    check(
      'Left lowers mouse sensitivity, and a click on the slider sets the volume',
      o.mouse === 2 && o.volume === 12,
      o,
    )
    await shot('options-changed')
    const stored = await c.eval("localStorage.getItem('w95.doom95.options.v1')")
    check('options are stored in the doom95 namespace', JSON.parse(stored).volume === 12, stored)
    await tap('Escape')
    await sleep(200)
    await shot('options-full-screen')
    await c.key('F4', ['Alt'])
    await sleep(500)
    await launchDoom()
    o = JSON.parse((await data()).options)
    check(
      'options survive closing and reopening Doom',
      o.statusBar === false && o.mouse === 2 && o.volume === 12,
      o,
    )
    await tap('F4')
    await tap('Enter')
    await tap('ArrowDown')
    for (let i = 0; i < 3; i++) await tap('ArrowRight')
    await tap('ArrowDown')
    for (let i = 0; i < 4; i++) await tap('ArrowLeft')
    o = JSON.parse((await data()).options)
    check('the defaults can be put back', o.statusBar === true && o.mouse === 5 && o.volume === 8, o)
    await tap('Escape')
  },

  async saves() {
    await launchDoom()
    await newGame()
    await hold('w', 400)
    await sleep(500)
    await tap('F2')
    check('F2 opens Save Game', (await screen()) === 'menu-save')
    await tap('ArrowDown')
    await tap('Enter')
    for (let i = 0; i < 16; i++) await c.key('Backspace')
    for (const ch of 'outpost start') await c.key(ch)
    await shot('save-naming')
    await tap('Enter')
    const after = await data()
    const saved = after.player
    check(
      'Enter saves into the second slot and says so',
      after.screen === 'playing' &&
        after.slots.split('|')[1] === 'OUTPOST START' &&
        after.message === 'Game saved.',
      after.slots,
    )
    await shot('save-saved')
    await hold('w', 500)
    await hold('ArrowRight', 300)
    check('the player has moved on since saving', (await data()).player !== saved)
    await tap('F3')
    check(
      'F3 opens Load Game on the last slot',
      (await screen()) === 'menu-load' && (await data()).cursor === '1',
    )
    await shot('load-page')
    await tap('Enter')
    check('loading puts the player back where the save was made', (await data()).player === saved, {
      saved,
      now: (await data()).player,
    })
    await c.key('F4', ['Alt'])
    await sleep(500)
    await launchDoom()
    await tap('F3')
    await tap('Enter')
    const reopened = await data()
    check(
      'the slot survives a relaunch and loads from the title',
      reopened.screen === 'playing' && reopened.player === saved,
      reopened.player,
    )
  },

  async automap() {
    await launchDoom()
    await newGame()
    await tap('Tab')
    check('Tab opens the automap in follow mode', (await data()).automap === 'follow')
    await shot('automap-start')
    await hold('w', 700)
    await shot('automap-follow-moved')
    await tap('f')
    check('F turns follow mode off', (await data()).automap === 'free')
    await sleep(500)
    const pos = (await data()).player
    await hold('ArrowRight', 400)
    check('the arrows scroll the map, not the player, with follow off', (await data()).player === pos)
    await shot('automap-panned')
    await tap('f')
    await tap('Tab')
    check('Tab closes the automap', (await data()).automap === 'off')
  },

  async shell() {
    await c.eval(
      "document.querySelectorAll('[data-window]').forEach(w=>w.querySelector('button[aria-label=Close]')?.click())",
    )
    await sleep(300)
    await launch('notepad')
    await launchDoom()
    await newGame()
    await c.key(' ', ['Alt'])
    await sleep(200)
    const menu = await c.eval(
      "Array.from(document.querySelectorAll('[role=menu]')).map(m=>m.innerText).join('|')",
    )
    check('Alt+Space opens the system menu', /Restore/.test(menu) && /Close/.test(menu), menu.slice(0, 80))
    await c.shot(`${PROOF}/shell-alt-space.png`)
    await c.click(900, 60)
    await sleep(150)
    await c.clickOn('[data-window] canvas')
    await sleep(200)
    if ((await screen()) !== 'playing') await tap('Escape')
    check('Doom has focus before Alt+Tab', (await topWindow()) === 'Doom 95', await topWindow())
    await c.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'Alt',
      code: 'AltLeft',
      windowsVirtualKeyCode: 18,
      modifiers: 1,
    })
    await c.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
      modifiers: 1,
    })
    await c.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      windowsVirtualKeyCode: 9,
      modifiers: 1,
    })
    await sleep(200)
    const switcher = await c.eval(
      'document.querySelector(\'[role=dialog][aria-label="Task switcher"]\')?.innerText ?? null',
    )
    check('Alt+Tab from Doom shows the task switcher', switcher !== null, switcher)
    await c.shot(`${PROOF}/shell-alt-tab.png`)
    await c.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Alt',
      code: 'AltLeft',
      windowsVirtualKeyCode: 18,
      modifiers: 0,
    })
    await sleep(300)
    check('releasing Alt switches to the other window', (await topWindow()) !== 'Doom 95', await topWindow())
    const task = await c.eval(
      "(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.innerText.trim()==='Doom 95'&&e.getBoundingClientRect().y>innerHeight-32).getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()",
    )
    await c.click(...task)
    await sleep(300)
    check('the taskbar button gives Doom focus again', (await topWindow()) === 'Doom 95', await topWindow())
    await c.key('F4', ['Alt'])
    await sleep(600)
    check('Alt+F4 closes Doom', !(await c.eval("!!document.querySelector('[data-window] canvas')")))
    await c.key('F4', ['Alt'])
    await sleep(400)
  },
}

for (const phase of phases.length ? phases : Object.keys(PHASES)) {
  console.log(`== ${phase}`)
  await PHASES[phase]()
}
const failed = results.filter((r) => !r.ok)
console.log(`${results.length - failed.length}/${results.length} passed`)
c.close()
process.exit(failed.length ? 1 : 0)
