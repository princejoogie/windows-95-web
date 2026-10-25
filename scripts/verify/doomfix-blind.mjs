// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
// A screen-only play helper for the balance check. It sends keys and saves a screenshot, and reads nothing
// from the game. Each call unpauses, plays the moves, captures the window, and pauses again, so the level
// clock runs only while keys are held.
// Usage: node scripts/verify/doomfix-blind.mjs <port> start
//        node scripts/verify/doomfix-blind.mjs <port> act "w:400 ArrowRight:200 Alt+ArrowLeft:300 Space Control:300"
//        node scripts/verify/doomfix-blind.mjs <port> look       (a screenshot without unpausing)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { connect, sleep } from './cdp.mjs'

const [port = '9400', mode = 'act', moves = ''] = process.argv.slice(2)
const PROOF = process.env.W95_PROOF ?? 'D:/codes/worktrees/windows-95-web/proof/doomfix/blind'
const c = await connect(Number(port))
const counter = `${PROOF}/step.txt`
const step = existsSync(counter) ? Number(readFileSync(counter, 'utf8')) + 1 : 1
writeFileSync(counter, String(step))

const KEYS = {
  Pause: [19, 'Pause', 'Pause'],
  Alt: [18, 'AltLeft', 'Alt'],
  Shift: [16, 'ShiftLeft', 'Shift'],
  Control: [17, 'ControlLeft', 'Control'],
  ArrowLeft: [37, 'ArrowLeft', 'ArrowLeft'],
  ArrowRight: [39, 'ArrowRight', 'ArrowRight'],
  ArrowUp: [38, 'ArrowUp', 'ArrowUp'],
  ArrowDown: [40, 'ArrowDown', 'ArrowDown'],
  Space: [32, 'Space', ' '],
  Enter: [13, 'Enter', 'Enter'],
  Escape: [27, 'Escape', 'Escape'],
  Tab: [9, 'Tab', 'Tab'],
  F1: [112, 'F1', 'F1'],
  F2: [113, 'F2', 'F2'],
  F3: [114, 'F3', 'F3'],
  w: [87, 'KeyW', 'w'],
  a: [65, 'KeyA', 'a'],
  s: [83, 'KeyS', 's'],
  d: [68, 'KeyD', 'd'],
  f: [70, 'KeyF', 'f'],
  1: [49, 'Digit1', '1'],
  2: [50, 'Digit2', '2'],
  3: [51, 'Digit3', '3'],
}
const event = (type, name, alt) => {
  const [vk, code, key] = KEYS[name]
  return c.send('Input.dispatchKeyEvent', {
    type,
    key,
    code,
    windowsVirtualKeyCode: vk,
    modifiers: alt ? 1 : 0,
  })
}

async function play(chord, ms) {
  const names = chord.split('+')
  const alt = names.includes('Alt')
  for (const name of names) await event('rawKeyDown', name, alt)
  await sleep(ms)
  for (const name of [...names].reverse()) await event('keyUp', name, alt && name !== 'Alt')
  await sleep(20)
}

async function shot() {
  const box = await c.eval(
    "(()=>{const b=document.querySelector('[data-window] canvas').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height}})()",
  )
  const path = `${PROOF}/step-${String(step).padStart(3, '0')}.png`
  await c.shot(path, box)
  console.log(path)
}

if (mode === 'start') {
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
  await sleep(1500)
  await shot()
} else if (mode === 'look') {
  await shot()
} else {
  const paused = mode === 'act'
  if (paused) await play('Pause', 30)
  for (const move of moves.split(/\s+/).filter(Boolean)) {
    const [chord, ms = '40'] = move.split(':')
    await play(chord, Number(ms))
  }
  await sleep(60)
  await shot()
  if (paused) await play('Pause', 30)
}
c.close()
