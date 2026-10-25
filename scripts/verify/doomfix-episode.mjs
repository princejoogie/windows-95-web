// Plays Doom 95's whole episode in the Electron window with trusted key input, to prove every level can be
// finished and the episode ends on its end screen. It needs a dev renderer (ELECTRON_RENDERER_URL pointing
// at `pnpm dev:web`), because it reads the dev-only session on the canvas to aim and route. It never writes it.
// Usage: node scripts/verify/doomfix-episode.mjs <port> [skill]

import assert from 'node:assert/strict'
import { appendFileSync } from 'node:fs'
import { connect, sleep } from './cdp.mjs'

const [port = '9400', skillArg = '2'] = process.argv.slice(2)
const PROOF = process.env.W95_PROOF ?? 'D:/codes/worktrees/windows-95-web/proof/doomfix'
const c = await connect(Number(port))
const skill = Number(skillArg)
const noDeaths = process.env.W95_NO_DEATHS === '1'
let deaths = 0
const log = (name, detail) => {
  appendFileSync(
    `${PROOF}/episode.jsonl`,
    `${JSON.stringify({ at: new Date().toISOString(), name, detail })}\n`,
  )
  console.log(name, detail === undefined ? '' : JSON.stringify(detail))
}

const read = () =>
  c.eval(`(()=>{const s=document.querySelector('[data-window] canvas').doom;const w=s.world;return {
    screen:s.screen.kind, page:s.screen.page??null, menu:s.menu&&s.menu.page, level:s.level,
    w:w&&{x:w.player.x,y:w.player.y,a:w.player.angle,hp:w.player.hp,armor:w.player.armor,ammo:w.player.ammo,dead:w.player.dead,keys:w.player.keys,
      outcome:w.outcome, W:w.grid.width, H:w.grid.height,
      doors:w.grid.doors.map(d=>({x:d.x,y:d.y,open:d.open,key:d.key})),
      monsters:w.actors.filter(a=>a.kind!=='barrel'&&a.state!=='dead'&&a.state!=='dying').map(a=>({id:a.id,x:a.x,y:a.y,state:a.state})),
      blockers:w.actors.filter(a=>a.state!=='dead'&&a.state!=='dying').map(a=>Math.floor(a.y)*w.grid.width+Math.floor(a.x)),
      stats:w.stats}}})()`)
const walls = () => c.eval("Array.from(document.querySelector('[data-window] canvas').doom.world.grid.walls)")

const KEYS = {
  ArrowLeft: [37, 'ArrowLeft'],
  ArrowRight: [39, 'ArrowRight'],
  w: [87, 'KeyW'],
  Control: [17, 'ControlLeft'],
  ' ': [32, 'Space'],
}
async function hold(key, ms) {
  const [vk, code] = KEYS[key]
  await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code, windowsVirtualKeyCode: vk })
  await sleep(ms)
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk })
  await sleep(30)
}
const wrap = (d) => Math.atan2(Math.sin(d), Math.cos(d))

async function face(target) {
  for (let i = 0; i < 5; i++) {
    const { w } = await read()
    const d = wrap(target - w.a)
    if (Math.abs(d) < 0.05) return
    await hold(d < 0 ? 'ArrowLeft' : 'ArrowRight', Math.max(12, (Math.abs(d) / 2.6) * 1000))
  }
}

let grid = []
const solid = (w, cx, cy) => {
  if (cx < 0 || cy < 0 || cx >= w.W || cy >= w.H) return true
  if (grid[cy * w.W + cx]) return true
  const door = w.doors.find((d) => d.x === cx && d.y === cy)
  return !!door && door.open < 1
}
function sees(w, tx, ty) {
  const dist = Math.hypot(tx - w.x, ty - w.y)
  for (let t = 0.2; t < dist - 0.2; t += 0.1) {
    const x = w.x + ((tx - w.x) * t) / dist
    const y = w.y + ((ty - w.y) * t) / dist
    if (solid(w, Math.floor(x), Math.floor(y))) return false
  }
  return true
}

/** Shoots every awake or visible monster in sight, nearest first. */
async function fight() {
  for (let round = 0; round < 40; round++) {
    const { w } = await read()
    if (!w || w.dead || w.outcome !== 'playing') return
    const targets = w.monsters
      .filter((m) => Math.hypot(m.x - w.x, m.y - w.y) < 14 && sees(w, m.x, m.y))
      .sort((a, b) => Math.hypot(a.x - w.x, a.y - w.y) - Math.hypot(b.x - w.x, b.y - w.y))
    const target = targets[0]
    if (!target) return
    await face(Math.atan2(target.y - w.y, target.x - w.x))
    await hold('Control', 420)
  }
}

/** Walks a BFS path to the cell center, opening doors on the way and fighting what it meets. */
async function go(tx, ty) {
  for (let attempt = 0; attempt < 40; attempt++) {
    await fight()
    const { w } = await read()
    if (!w || w.dead || w.outcome !== 'playing') return false
    if (Math.hypot(tx - w.x, ty - w.y) < 0.3) return true
    const start = Math.floor(w.y) * w.W + Math.floor(w.x)
    const goal = Math.floor(ty) * w.W + Math.floor(tx)
    const parents = new Map([[start, null]])
    const queue = [start]
    for (let i = 0; i < queue.length && !parents.has(goal); i++) {
      const n = queue[i]
      for (const k of [n - 1, n + 1, n - w.W, n + w.W]) {
        if (parents.has(k) || grid[k] || (k !== goal && w.blockers.includes(k))) continue
        const door = w.doors.find((d) => d.y * w.W + d.x === k)
        if (door?.key && !w.keys[door.key]) continue
        parents.set(k, n)
        queue.push(k)
      }
    }
    if (!parents.has(goal)) return false
    const path = []
    for (let k = goal; k !== start; k = parents.get(k)) path.unshift(k)
    const next = path[0]
    const nx = (next % w.W) + 0.5
    const ny = Math.floor(next / w.W) + 0.5
    const door = w.doors.find((d) => d.y * w.W + d.x === next)
    await face(Math.atan2(ny - w.y, nx - w.x))
    if (door && door.open < 1) {
      await hold(' ', 40)
      await sleep(650)
      continue
    }
    const dist = Math.hypot(nx - w.x, ny - w.y)
    await hold('w', Math.min(600, Math.max(40, ((dist - 0.05) / 3.6) * 1000)))
  }
  return false
}

async function pressExit(angle) {
  await face(angle)
  await hold(' ', 40)
  await sleep(900)
}

const ROUTES = [
  {
    waypoints: [
      [13.5, 4.5],
      [17.5, 7.5],
      [17.5, 9.5],
      [15.5, 12.5],
      [23.5, 10.5],
      [21.5, 13.5],
      [17.5, 9.5],
      [12.5, 4.5],
      [6.5, 7.5],
      [6.5, 10.5],
    ],
    exit: Math.PI / 2,
  },
  {
    waypoints: [
      [6.5, 1.5],
      [9.5, 3.5],
      [15.5, 5.5],
      [15.5, 7.5],
      [25.5, 12.5],
      [9.5, 10.5],
      [1.5, 10.5],
    ],
    exit: Math.PI,
  },
  {
    waypoints: [
      [3.5, 8.5],
      [5.5, 9.5],
      [5.5, 11.5],
      [2.5, 14.5],
      [5.5, 11.5],
      [12.5, 12.5],
      [15.5, 13.5],
      [24.5, 9.5],
      [24.5, 11.5],
      [26.5, 14.5],
      [24.5, 9.5],
      [15.5, 5.5],
      [15.5, 3.5],
      [15.5, 1.5],
    ],
    exit: -Math.PI / 2,
  },
]

async function shot(name) {
  const box = await c.eval(
    "(()=>{const b=document.querySelector('[data-window]').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})()",
  )
  await c.shot(`${PROOF}/${name}.png`, box)
}

async function playLevel(index) {
  const route = ROUTES[index]
  for (let life = 0; life < (noDeaths ? 1 : 4); life++) {
    grid = await walls()
    if (index === 2) {
      await shot('episode-level3-start')
      await hold('w', 300)
      const { w } = await read()
      log('level 3 start armor', { hp: w.hp, armor: w.armor, items: w.stats.items })
      assert.equal(w.armor, 100, 'Reactor start armor was collected')
      await shot('episode-level3-supplied')
    }
    let ok = true
    for (const [x, y] of route.waypoints) {
      if (!(await go(x, y))) {
        ok = false
        break
      }
    }
    if (ok) {
      await fight()
      await pressExit(route.exit)
      const s = await read()
      if (s.screen === 'intermission') return true
    }
    const s = await read()
    log(`level ${index + 1} attempt ${life + 1} failed`, {
      hp: s.w?.hp,
      dead: s.w?.dead,
      at: s.w && [s.w.x, s.w.y],
    })
    if (s.w?.dead) {
      deaths++
      assert.ok(!noDeaths, `Died on level ${index + 1}`)
      await sleep(1200)
      await hold(' ', 40)
      await sleep(300)
    }
  }
  return false
}

await c.eval(
  "document.querySelectorAll('[data-window]').forEach(w=>w.querySelector('button[aria-label=Close]')?.click())",
)
await sleep(300)
await c.clickOn('[data-start-button]')
await sleep(200)
await c.eval(
  "Array.from(document.querySelectorAll('[role=menu] button, [role=menuitem]')).find(e=>/^Run/.test(e.innerText.trim()))?.click()",
)
await c.waitFor("!!document.querySelector('#run-command')")
await c.clickOn('#run-command')
await c.key('a', ['Control'])
await c.type('DOOM95')
await c.key('Enter')
await c.waitFor("!!document.querySelector('[data-window] canvas')?.doom", 8000)
await sleep(500)
await c.key('Enter')
await c.key('Enter')
for (let i = 2; i > skill; i--) await c.key('ArrowUp')
for (let i = 2; i < skill; i++) await c.key('ArrowDown')
await c.key('Enter')
await sleep(300)
log('started', { skill, screen: (await read()).screen })

for (let level = 0; level < 3; level++) {
  const done = await playLevel(level)
  const s = await read()
  log(`level ${level + 1} ${done ? 'finished' : 'not finished'}`, {
    screen: s.screen,
    hp: s.w?.hp,
    deaths,
    stats: s.w?.stats,
  })
  if (!done) process.exit(1)
  await sleep(2600)
  await shot(`episode-level${level + 1}-intermission`)
  await c.key(' ')
  await sleep(500)
}
const finale = await read()
log('after level 3', { screen: finale.screen, page: finale.page })
await sleep(3500)
await shot('episode-finale-text')
await c.key(' ')
await sleep(1300)
const end = await read()
log('end screen', { screen: end.screen, page: end.page })
await shot('episode-the-end')
await c.key(' ')
await sleep(300)
log('back to title', { screen: (await read()).screen })
c.close()
