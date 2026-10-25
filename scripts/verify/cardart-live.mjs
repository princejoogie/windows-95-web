// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
// Drives the built Electron app over CDP to prove the card art in Solitaire, FreeCell, and Hearts, and
// the FreeCell right-button preview. Usage: node scripts/verify/cardart-live.mjs [cdp port] [proof dir]
import { appendFileSync, mkdirSync } from 'node:fs'
import { connect, sleep } from './cdp.mjs'

const port = Number(process.argv[2] ?? 9401)
const dir = process.argv[3] ?? 'D:/codes/worktrees/windows-95-web/proof/cardart'
mkdirSync(dir, { recursive: true })
const c = await connect(port)
const failures = []
const check = (name, ok, detail) => {
  appendFileSync(
    `${dir}/live.jsonl`,
    `${JSON.stringify({ at: new Date().toISOString(), name, ok, detail })}\n`,
  )
  console.log(ok ? 'ok  ' : 'FAIL', name, JSON.stringify(detail) ?? '')
  if (!ok) failures.push(name)
}
const shot = (name) => c.shot(`${dir}/${name}.png`)
const clickExpr = async (expression, top = false) => {
  const at = await c.eval(
    `(()=>{const e=${expression};if(!e)throw Error('missing target');const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+${top ? '8' : 'r.height/2'}]})()`,
  )
  await c.click(...at)
}
const button = (label, scope = '', starts = false) =>
  clickExpr(
    `Array.from(document.querySelectorAll(${JSON.stringify(scope ? `${scope} button` : 'button')})).find(e=>${starts ? 'e.innerText.trim().startsWith(' : 'e.innerText.trim()===('}${JSON.stringify(label)}) || e.getAttribute('aria-label')===${JSON.stringify(label)})`,
  )
const menu = async (name, item, scope) => {
  await button(name, scope)
  await button(item, '[role=menu]', true)
}
const launch = async (exe) => {
  await c.clickOn('[data-start-button]')
  await button('Run...')
  await c.clickOn('#run-command')
  await c.key('a', ['Control'])
  await c.type(exe)
  await c.key('Enter')
  await sleep(400)
}
const closeActive = async () => {
  await clickExpr(
    `Array.from(document.querySelectorAll('[data-window]')).at(-1).querySelector('button[aria-label=Close]')`,
  )
  await sleep(300)
}

try {
  await launch('SOL.EXE')
  check('solitaire opened', await c.eval(`!!document.querySelector('.solitaire')`))
  await shot('live-solitaire-table')
  await menu('Game', 'Deck', '.solitaire')
  await sleep(200)
  await shot('live-solitaire-deck-gallery')
  const backs = await c.eval(`document.querySelectorAll('[role=dialog] input[name=solitaire-back]').length`)
  check('deck gallery lists twelve backs', backs === 12, backs)
  await c.clickOn('[role=dialog] input[aria-label=Castle]')
  await button('OK', '[role=dialog]')
  await sleep(200)
  await shot('live-solitaire-castle-back')
  await closeActive()
  if (await c.eval(`!!document.querySelector('[role=dialog]')`)) {
    await button('Yes', '[role=dialog]')
    await sleep(300)
  }

  await launch('FREECELL.EXE')
  check('freecell opened', await c.eval(`!!document.querySelector('.freecell')`))
  await c.key('F3')
  await c.clickOn('[aria-label="Game number"]')
  await c.key('a', ['Control'])
  await c.type('1')
  await c.key('Enter')
  await sleep(200)
  if (await c.eval(`document.body.innerText.includes('If you quit now')`))
    await button('Yes', '[role=dialog]')
  await sleep(300)
  const number = await c.eval(`document.querySelector('.freecell').dataset.gameNumber`)
  check('freecell game 1 dealt', number === '1', number)
  await shot('live-freecell-game1')
  const covered = `document.querySelector('[data-column="0"] [data-index="2"]')`
  const rect = await c.eval(`${covered}.getBoundingClientRect().toJSON()`)
  const movesBefore = await c.eval(`document.querySelector('.freecell').dataset.moves`)
  const x = rect.x + 20
  const y = rect.y + 8
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
  await c.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'right',
    buttons: 2,
    clickCount: 1,
  })
  await sleep(200)
  const held = await c.eval(
    `({zIndex:getComputedStyle(${covered}).zIndex,preview:${covered}.classList.contains('freecell-preview'),menu:!!document.querySelector('[role=menu]'),moves:document.querySelector('.freecell').dataset.moves,card:${covered}.dataset.card})`,
  )
  await shot('live-freecell-right-held')
  check('right hold raises the covered card', held.zIndex === '1' && held.preview, held)
  check('right hold opens no context menu', !held.menu, held.menu)
  await c.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'right',
    buttons: 0,
    clickCount: 1,
  })
  await sleep(200)
  const released = await c.eval(
    `({zIndex:getComputedStyle(${covered}).zIndex,preview:${covered}.classList.contains('freecell-preview'),moves:document.querySelector('.freecell').dataset.moves,selected:document.querySelectorAll('.freecell-selected').length})`,
  )
  await shot('live-freecell-right-released')
  check('release restores the overlap', released.zIndex === 'auto' && !released.preview, released)
  check('no move or selection happened', released.moves === movesBefore && released.selected === 0, {
    before: movesBefore,
    after: released.moves,
  })
  await c.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'right',
    buttons: 2,
    clickCount: 1,
  })
  await sleep(100)
  await c.clickOn('[data-window] button[aria-label=Minimize]')
  await sleep(400)
  const minimized = await c.eval(`!!document.querySelector('.freecell-preview')`)
  check('minimize clears the preview', !minimized, minimized)
  await c.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'right',
    buttons: 0,
    clickCount: 1,
  })
  await clickExpr(
    `Array.from(document.querySelectorAll('[data-task]')).find(e=>/FreeCell/.test(e.innerText))`,
  )
  await sleep(400)
  await closeActive()
  if (await c.eval(`!!document.querySelector('[role=dialog]')`)) {
    await button('Yes', '[role=dialog]')
    await sleep(300)
  }

  await launch('MSHEARTS.EXE')
  await sleep(600)
  await clickExpr(
    `Array.from(document.querySelectorAll('[role=dialog] label, [role=dialog] input')).find(e=>/dealer/.test(e.innerText||e.getAttribute('aria-label')||''))`,
  )
  await button('OK', '[role=dialog]')
  await sleep(2500)
  check('hearts opened', await c.eval(`!!document.querySelector('.hearts')`))
  await shot('live-hearts-table')
  const images = await c.eval(`document.querySelectorAll('.hearts img[src^="data:image/svg"]').length`)
  check('hearts shows pixel cards', images > 0, images)
} finally {
  c.close()
}
if (failures.length) {
  console.error('failed:', failures.join(', '))
  process.exit(1)
}
