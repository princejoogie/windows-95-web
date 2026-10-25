// Live proof for shell fix S2. Run against `scripts/verify/relaunch.sh --fresh`:
//   node scripts/verify/shellfix-s2.mjs [controls|desktop|dialog|all]
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { connect, sleep } from './cdp.mjs'
import { desktopPhase } from './desktop-phase.mjs'

const port = Number(process.env.W95_CDP_PORT ?? 9331)
const proof = resolve(process.env.W95_PROOF_DIR ?? '../proof/shellfix-s2')
mkdirSync(proof, { recursive: true })
const phase = process.argv[2] ?? 'all'
const app = await connect(port)
const results = []

function check(condition, finding, name, detail) {
  assert.ok(condition, `${finding}: ${name}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`)
  results.push({ finding, name, detail })
  process.stdout.write(
    `PASS [${finding}] ${name}${detail === undefined ? '' : ` ${JSON.stringify(detail)}`}\n`,
  )
}
const shot = (name, clip) => app.shot(join(proof, `${name}.png`), clip)
const q = (selector) => JSON.stringify(selector)
const exists = (selector) => app.eval(`!!document.querySelector(${q(selector)})`)
const text = (selector) => app.eval(`document.querySelector(${q(selector)})?.textContent ?? null`)
const menuItem = (label) =>
  `[...document.querySelectorAll('[role="menuitem"]')].find(e => e.textContent.replace(/\\s+/g,' ').trim().startsWith(${q(label)}))`

async function pickMenu(label) {
  await app.waitFor(`!!${menuItem(label)}`)
  const at = await app.eval(
    `(()=>{const b=${menuItem(label)}.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await app.click(at[0], at[1])
}
async function hover(label) {
  await app.waitFor(`!!${menuItem(label)}`)
  const at = await app.eval(
    `(()=>{const b=${menuItem(label)}.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await app.move(at[0], at[1])
  await sleep(400)
}
const menuLabels = () =>
  app.eval(
    `[...document.querySelectorAll('[role="menu"]')].at(-1) && [...[...document.querySelectorAll('[role="menu"]')].at(-1).children].map(e => e.querySelector('[role="menuitem"]') ? (e.querySelector('[role="menuitem"]').getAttribute('aria-disabled')==='true' ? '~' : '') + e.textContent.replace(/\\s+/g,' ').trim() : '---')`,
  )
const item = (key) => `[data-desktop-item=${q(key)}]`
const selectedKeys = () =>
  app.eval(
    `[...document.querySelectorAll('[data-desktop-item][aria-selected="true"]')].map(e => e.dataset.desktopItem)`,
  )
const fsNodes = () => app.eval(`Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes)`)
const flushFs = () => sleep(400)
async function clickDesktop(x = 600, y = 500) {
  await app.click(x, y)
}
async function rightClick(selectorOrPoint) {
  const [x, y] = Array.isArray(selectorOrPoint) ? selectorOrPoint : await app.center(selectorOrPoint)
  await app.click(x, y, { button: 'right' })
  await app.waitFor(`!!document.querySelector('[role="menu"]')`)
}
async function closeMenus() {
  await app.key('Escape')
  await app.key('Escape')
  await clickDesktop(900, 600)
}
async function closeWindows() {
  for (let i = 0; i < 6; i++) {
    const has = await exists('[data-window] button[aria-label="Close"]')
    if (!has) return
    await app.clickOn('[data-window] button[aria-label="Close"]')
    await sleep(150)
  }
}
async function openStartItem(label) {
  await app.clickOn('[data-start-button]')
  await pickMenu(label)
}

async function controls() {
  // 7 and 24: the default ring follows focus, and selected text is navy.
  await openStartItem('Run...')
  await app.waitFor(`!!document.querySelector('#run-command')`)
  await app.type('notepad')
  await app.key('a', ['Control'])
  const button = (label) =>
    `[...document.querySelectorAll('[role="dialog"][aria-label="Run"] button')].find(b => b.textContent === ${q(label)})`
  const shadow = (expression) => app.eval(`getComputedStyle(${expression}).boxShadow`)
  const ok = button('OK')
  const cancel = button('Cancel')
  const okShadow = await shadow(ok)
  check(
    okShadow.startsWith('rgb(0, 0, 0) 0px 0px 0px 1px inset'),
    '7',
    'default OK wears the black ring',
    okShadow,
  )
  const selection = await app.eval(
    `(()=>{const s=getComputedStyle(document.querySelector('#run-command'),'::selection');return [s.backgroundColor,s.color]})()`,
  )
  check(
    selection[0] === 'rgb(0, 0, 128)' && selection[1] === 'rgb(255, 255, 255)',
    '24',
    'selected text is white on navy',
    selection,
  )
  const runBox = await app.eval(
    `(()=>{const b=document.querySelector('[role="dialog"][aria-label="Run"]').getBoundingClientRect();return {x:b.x-4,y:b.y-4,width:b.width+8,height:b.height+8}})()`,
  )
  await shot('07-24-run-default-ring', runBox)
  await app.key('Tab')
  await app.key('Tab')
  const afterTab = [
    await shadow(ok),
    await shadow(cancel),
    await app.eval(`document.activeElement.textContent`),
  ]
  check(
    !afterTab[0].includes('0px 0px 0px 1px') &&
      afterTab[1].startsWith('rgb(0, 0, 0) 0px 0px 0px 1px inset') &&
      afterTab[2] === 'Cancel',
    '7',
    'the ring moves to the focused Cancel button',
    afterTab[2],
  )
  const outline = await app.eval(
    `(()=>{const s=getComputedStyle(document.activeElement,'::after');return [s.content,s.top,s.backgroundImage.slice(0,25)]})()`,
  )
  check(
    outline[0] === '""' && outline[1] === '4px',
    '7',
    'focused button draws the dotted focus rectangle 4px inside',
    outline,
  )
  await shot('07-run-ring-on-cancel', runBox)
  await app.key('Escape')

  // 10 and 31: message box width and accelerators.
  await openStartItem('Run...')
  await app.waitFor(`!!document.querySelector('#run-command')`)
  await app.type('notepad')
  await app.key('Enter')
  await app.waitFor(`!!document.querySelector('[data-window] textarea')`)
  await app.type('unsaved work')
  await app.clickOn('[data-window] button[aria-label="Close"]')
  await app.waitFor(
    `[...document.querySelectorAll('[role="dialog"]')].some(d => d.textContent.includes('Do you want to save'))`,
  )
  const box = await app.eval(
    `(()=>{const d=[...document.querySelectorAll('[role="dialog"]')].at(-1);const p=d.querySelector('p');const w=d.closest('[data-window]').getBoundingClientRect();const b=d.getBoundingClientRect();return {dialog:b.width,owner:w.width,lines:Math.round(p.getBoundingClientRect().height/p.ownerDocument.defaultView.parseFloat(getComputedStyle(p).lineHeight)),text:p.textContent,rect:{x:b.x-2,y:b.y-2,width:b.width+4,height:b.height+4}}})()`,
  )
  await shot('10-31-notepad-save-prompt')
  check(box.lines <= 3, '10', 'the save prompt does not wrap mid-sentence', box)
  const labels = await app.eval(
    `[...[...document.querySelectorAll('[role="dialog"]')].at(-1).querySelectorAll('button')].filter(b=>!b.getAttribute('aria-label')).map(b=>b.innerHTML)`,
  )
  check(
    labels[0]?.includes('<span class="underline">Y</span>') &&
      labels[1]?.includes('<span class="underline">N</span>'),
    '31',
    'Yes and No carry underlined accelerators',
    labels,
  )
  await app.key('n')
  await sleep(200)
  check(!(await exists('[data-window]')), '31', 'pressing N answers No and Notepad closes without saving')

  // 31: Esc does nothing in a Yes/No box; 10: a long message wraps at 5/8 of the screen, not the owner.
  await clickDesktop()
  await rightClick([600, 500])
  await pickMenu('New')
  await pickMenu('Text Document')
  await app.waitFor(`!!document.querySelector('[data-desktop-item] input')`)
  await app.type('A file with a deliberately long name so the confirmation runs past the owner width.txt')
  await app.key('Enter')
  await flushFs()
  await app.key('Delete')
  await app.waitFor(`!!document.querySelector('[role="dialog"][aria-label="Confirm File Delete"]')`)
  await app.key('Escape')
  check(
    await exists('[role="dialog"][aria-label="Confirm File Delete"]'),
    '31',
    'Esc does not dismiss a Yes/No box',
  )
  const wide = await app.eval(
    `(()=>{const p=document.querySelector('[role="dialog"][aria-label="Confirm File Delete"] p');return {width:Math.round(p.getBoundingClientRect().width),limit:Math.round(innerWidth*5/8)}})()`,
  )
  check(
    wide.width > 506 && wide.width <= wide.limit,
    '10',
    'long text wraps at 5/8 of the screen width',
    wide,
  )
  await shot('10-confirm-delete-wide')
  await app.key('y')
  await flushFs()
  check(
    (await fsNodes()).some((n) => n.name.startsWith('A file with a deliberately') && n.parent === 'recycled'),
    '31',
    'pressing Y answers Yes and the file goes to the Recycle Bin',
  )

  // 23: Windows 95 tooltips.
  const clock = await app.eval(
    `(()=>{const e=[...document.querySelectorAll('div')].find(d=>/^\\d{1,2}:\\d{2} [AP]M$/.test(d.textContent) && d.className.includes('bevel-shallow'));const b=e.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await app.move(clock[0] - 5, clock[1])
  await app.move(clock[0], clock[1])
  await sleep(250)
  check(!(await exists('[role="tooltip"]')), '23', 'no tooltip before the 500 ms delay')
  await sleep(450)
  const tip = await app.eval(
    `(()=>{const t=document.querySelector('[role="tooltip"]');if(!t)return null;const s=getComputedStyle(t);return {text:t.textContent,bg:s.backgroundColor,border:s.borderTopColor+' '+s.borderTopWidth+' '+s.borderTopStyle,font:s.fontFamily,size:s.fontSize}})()`,
  )
  const longDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  check(
    tip?.text === longDate && tip.bg === 'rgb(255, 255, 225)' && tip.border === 'rgb(0, 0, 0) 1px solid',
    '23',
    'the clock shows the long date in a #ffffe1 tip with a black border',
    tip,
  )
  await shot('23-clock-tooltip', { x: 760, y: 680, width: 264, height: 88 })
  await app.click(clock[0], clock[1])
  check(!(await exists('[role="tooltip"]')), '23', 'a click hides the tooltip')
  const start = await app.center('[data-start-button]')
  await app.move(start[0], start[1])
  await sleep(700)
  check((await text('[role="tooltip"]')) === 'Click here to begin.', '23', 'Start says Click here to begin.')
  await shot('23-start-tooltip', { x: 0, y: 680, width: 240, height: 88 })
  await app.move(500, 300)
  await openStartItem('Run...')
  await app.waitFor(`!!document.querySelector('#run-command')`)
  await app.type('calc')
  await app.key('Enter')
  await app.waitFor(`!!document.querySelector('[data-task]')`)
  const task = await app.center('[data-task]')
  await app.move(task[0], task[1])
  await sleep(700)
  check(!(await exists('[role="tooltip"]')), '23', 'an untruncated task button shows no tooltip')
  const caption = await app.eval(
    `[...document.querySelectorAll('[data-window] [aria-label="Close"], [data-window] [aria-label="Minimize"]')].map(b => b.getAttribute('title'))`,
  )
  check(
    caption.every((title) => title === null),
    '23',
    'caption buttons have no tooltip',
    caption,
  )
  await closeWindows()
}

async function main() {
  await app.eval(`document.querySelector('[data-desktop]') !== null`)
  if (phase === 'controls' || phase === 'all') await controls()
  if (phase === 'desktop' || phase === 'all') await desktop()
  if (phase === 'dialog' || phase === 'all') await dialog()
  writeFileSync(join(proof, `results-${phase}.json`), JSON.stringify(results, null, 2))
  app.close()
}

async function desktop() {
  await desktopPhase({
    app,
    check,
    shot,
    exists,
    text,
    pickMenu,
    hover,
    menuLabels,
    item,
    selectedKeys,
    fsNodes,
    flushFs,
    clickDesktop,
    rightClick,
    closeMenus,
    closeWindows,
  })
}
async function dialog() {}

await main()
