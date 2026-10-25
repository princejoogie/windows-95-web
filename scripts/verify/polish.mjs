// Run against Electron on W95_CDP_PORT (default 9420). Usage: node scripts/verify/polish.mjs <phase>
import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const proof = resolve(process.env.W95_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/polish')
mkdirSync(proof, { recursive: true })
const c = await connect(Number(process.env.W95_CDP_PORT ?? 9420))
const q = JSON.stringify
const phase = process.argv[2] ?? 'menu'
const top = `[...document.querySelectorAll('[data-window]')].filter(w => !w.classList.contains('hidden')).sort((a,b) => Number(b.style.zIndex)-Number(a.style.zIndex))[0]`
const button = (label, scope = 'document') =>
  `[...(${scope}).querySelectorAll('button')].find(e => e.getAttribute('aria-label') === ${q(label)} || e.textContent.trim() === ${q(label)})`
const menuItem = (label) =>
  `[...document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')].find(e => e.textContent.replace('Checked','').replace(/\\s+/g,' ').trim().startsWith(${q(label)}))`
async function click(expression, options) {
  await c.waitFor(`!!(${expression})`)
  const xy = await c.eval(
    `(()=>{const b=(${expression}).getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await c.click(...xy, options)
}
async function fresh() {
  await c.eval(
    "addEventListener('beforeunload', () => localStorage.clear(), {once:true}); localStorage.clear()",
  )
  await c.send('Page.reload')
  await c.waitFor(`!!document.querySelector('[data-desktop-item]')`, 10000)
  await sleep(500)
}
async function run(command) {
  await click(`document.querySelector('[data-start-button]')`)
  await click(menuItem('Run...'))
  await c.waitFor(`!!document.querySelector('#run-command')`)
  await c.type(command)
  await c.key('Enter')
  await sleep(350)
}
async function check(expression, name) {
  const detail = await c.eval(expression)
  assert.ok(detail, name)
  appendFileSync(`${proof}/checks.jsonl`, `${JSON.stringify({ phase, name, detail })}\n`)
  console.log(`PASS ${name}`)
}
const shot = (name) => c.shot(`${proof}/${name}.png`)
const systemMenu = async () => {
  await c.key(' ', ['Alt'])
  await c.waitFor(`!!document.querySelector('[role="menu"]')`)
}
async function menu() {
  await fresh()
  await run('command')
  await systemMenu()
  await check(
    `JSON.stringify([...document.querySelectorAll('[role="menuitem"]')].map(e => e.textContent.replace('Checked','').replace('Alt+F4','').trim())) === JSON.stringify(['Restore','Move','Size','Minimize','Maximize','Close','Toolbar','Edit','Properties'])`,
    'DOS system-menu order',
  )
  await shot('01-dos-system-menu')
  await click(menuItem('Toolbar'))
  await check(
    `!document.querySelector('[aria-label="MS-DOS toolbar"]')`,
    'Toolbar hides from the system menu',
  )
  await systemMenu()
  await click(menuItem('Toolbar'))
  await check(
    `!!document.querySelector('[aria-label="MS-DOS toolbar"]')`,
    'Toolbar returns from the system menu',
  )
  await systemMenu()
  await click(menuItem('Edit'))
  await c.key('ArrowRight')
  await c.waitFor(`!!(${menuItem('Scroll')})`)
  await shot('01-dos-edit-menu')
  await click(menuItem('Mark'))
  await check(
    `(${top}).getAttribute('aria-label') === 'Mark - MS-DOS Prompt'`,
    'System Edit Mark enters marking mode',
  )
  await c.key('ArrowRight', ['Shift'])
  await shot('01-dos-mark-selection')
  await systemMenu()
  await click(menuItem('Edit'))
  await c.key('ArrowRight')
  await click(menuItem('Copy'))
  await check(
    `(async () => (await navigator.clipboard.readText()) === 'Mi')()`,
    'System Edit Copy writes the selected DOS text',
  )
  await systemMenu()
  await click(menuItem('Edit'))
  await c.key('ArrowRight')
  await click(menuItem('Paste'))
  await check(
    `document.querySelector('[aria-label="MS-DOS command line"]').value === 'Mi'`,
    'System Edit Paste inserts the copied text',
  )
  await c.key('Escape')
  await systemMenu()
  await click(menuItem('Edit'))
  await c.key('ArrowRight')
  await click(menuItem('Scroll'))
  await check(
    `(${top}).getAttribute('aria-label') === 'Scroll - MS-DOS Prompt'`,
    'System Edit Scroll enters scroll mode',
  )
  await shot('01-dos-scroll')
  await c.key('Escape')
  await systemMenu()
  await click(menuItem('Properties'))
  await check(
    `!!document.querySelector('[role="dialog"][aria-label="MS-DOS Prompt Properties"]')`,
    'System Properties opens DOS properties',
  )
  await shot('01-dos-properties')
}

async function help() {
  await fresh()
  await run('winhlp32')
  await check(
    `JSON.stringify([...(${top}).children[0].querySelectorAll('button')].map(e=>e.getAttribute('aria-label'))) === JSON.stringify(['Help','Close'])`,
    'Help Topics caption has only Help and Close',
  )
  await check(
    `getComputedStyle(${top}).padding === '3px' && !(${top}).querySelector('[style*="cursor:"]')`,
    'Help Topics has a fixed dialog frame without resize handles',
  )
  await shot('02-help-topics-caption')
  await click(button('Help', top))
  await check(
    `!!document.querySelector('[role="dialog"][aria-label="Windows Help"]')`,
    'Caption Help explains the Help Topics tabs',
  )
  await shot('02-help-caption-help')
  await click(button('OK'))
  await click(button('Close', top))
  await check(`!document.querySelector('[data-window]')`, 'Help Topics closes from the caption')
}

try {
  if (phase === 'menu') await menu()
  else if (phase === 'help') await help()
  else throw new Error(`Unknown phase ${phase}`)
} finally {
  c.close()
}
