import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clickText, connect, hoverMenuItem, menuItem, reset } from './explorerfix-driver.mjs'

const out = 'D:/codes/worktrees/windows-95-web/proof/explorerfix'
const d = await connect(9380)
const results = []
const check = async (finding, name, expression) => {
  const actual = await d.evaluate(expression)
  results.push({ finding, name, actual })
  assert.equal(actual, true, name)
}
const shot = async (name) => {
  await d.wait(100)
  const result = await d.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(out, `${name}.png`), Buffer.from(result.result.data, 'base64'))
}
try {
  await reset(d)
  await d.clickSel('[data-desktop-item="app:mycomputer"]', { clickCount: 2 })
  await d.clickSel('[data-node-id="c"]')
  await check(
    9,
    'Selected drive reports free space and capacity',
    `document.querySelector('[data-location="My Computer"]').innerText.includes('Free Space:') && document.querySelector('[data-location="My Computer"]').innerText.includes('Capacity: 512MB')`,
  )
  await d.clickSel('[data-node-id="c"]', { clickCount: 2 })
  const root = '[data-location="(C:)"]'
  await d.clickSel('[data-window][aria-label="My Computer"] button[aria-label="Close"]')
  await d.clickSel(`${root} [data-node-id="config"]`)
  await d.key('c', { ctrl: true })
  await clickText(d, `${root} [role="menubar"] button`, 'Edit')
  await menuItem(d, 'Paste Shortcut')
  await check(
    3,
    'Paste Shortcut creates a linked item',
    `Boolean(document.querySelector('${root} [aria-label="Shortcut to CONFIG.SYS"]'))`,
  )
  await d.clickSel(`${root} [aria-label="Shortcut to CONFIG.SYS"]`, { button: 'right' })
  await check(
    21,
    'Shortcut context has Open, Cut, Copy, Delete, Rename and Properties',
    `['Open','Cut','Copy','Delete','Rename','Properties'].every(text=>Array.from(document.querySelectorAll('[role="menuitem"]')).some(e=>e.textContent===text))`,
  )
  await shot('shortcut-context')
  await d.key('Escape')
  await clickText(d, `${root} [role="menubar"] button`, 'File')
  await hoverMenuItem(d, 'New')
  await menuItem(d, 'Shortcut')
  await d.clickSel('#shortcut-command')
  await d.type('calc')
  await clickText(d, '[role="dialog"] button', 'Next >')
  await d.key('a', { ctrl: true })
  await d.type('Calculator link')
  await clickText(d, '[role="dialog"] button', 'Finish')
  await check(
    10,
    'New Shortcut wizard creates link in current folder',
    `Boolean(document.querySelector('${root} [aria-label="Calculator link"]'))`,
  )
  await d.clickSel(`${root} [aria-label="Calculator link"]`, { clickCount: 2 })
  await check(
    21,
    'Created shortcut launches target',
    `Boolean(document.querySelector('[data-window][aria-label="Calculator"]'))`,
  )
  await d.clickSel('[data-window][aria-label="Calculator"] button[aria-label="Close"]')
  await clickText(d, `${root} [role="menubar"] button`, 'Edit')
  await menuItem(d, 'Invert Selection')
  await check(
    10,
    'Invert Selection excludes previously selected shortcut',
    `document.querySelector('${root} [aria-label="Calculator link"]').getAttribute('aria-selected')==='false' && document.querySelectorAll('${root} [aria-selected="true"]').length>=4`,
  )
  await clickText(d, `${root} [role="menubar"] button`, 'View')
  await menuItem(d, 'Options...')
  await clickText(d, '[role="tab"]', 'View')
  await d.clickSel('[role="dialog"] input[type="checkbox"]')
  await clickText(d, '[role="dialog"] button', 'OK')
  await check(
    24,
    'Options shows extensions when unchecked',
    `document.querySelector('${root} [data-node-id="config"] .explorer-name').textContent==='CONFIG.SYS'`,
  )
  await clickText(d, `${root} [role="menubar"] button`, 'View')
  await menuItem(d, 'Toolbar')
  await check(
    10,
    'Toolbar toggles on with all commands',
    `document.querySelectorAll('${root} .explorer-toolbar>button').length===11`,
  )
  await clickText(d, `${root} [role="menubar"] button`, 'View')
  await hoverMenuItem(d, 'Arrange Icons')
  await menuItem(d, 'Auto Arrange')
  await d.clickSel(`${root} [data-node-id="config"]`)
  const item = await d.rect(`${root} [data-node-id="config"]`)
  const area = await d.rect(`${root} .explorer-items`)
  await d.drag(item.x + 35, item.y + 20, area.x + area.width - 15, area.y + area.height - 25)
  await check(
    10,
    'Disabling Auto Arrange permits icon placement',
    `document.querySelector('${root} [data-node-id="config"]').style.transform.includes('translate(')`,
  )
  await shot('manual-icon-placement')
  const manual = await d.rect(`${root} [data-node-id="config"]`)
  await clickText(d, `${root} [role="menubar"] button`, 'View')
  await menuItem(d, 'Line up Icons')
  await check(
    10,
    'Line up Icons snaps near the current position',
    `(()=>{const r=document.querySelector('${root} [data-node-id="config"]').getBoundingClientRect();return Math.abs(r.x-${manual.x})<=37.5 && Math.abs(r.y-${manual.y})<=37.5 && Math.abs((r.x-${item.x})%75)<0.01 && Math.abs((r.y-${item.y})%75)<0.01})()`,
  )
  await d.clickSel(`${root} [data-node-id="documents"]`, { button: 'right' })
  await menuItem(d, 'Explore')
  await check(
    1,
    'Explore context opens tree at selected folder',
    `Boolean(document.querySelector('[data-window][aria-label="Exploring - My Documents"] [role="tree"]'))`,
  )
  await shot('explore-folder')
  await d.clickSel('[data-window][aria-label="Exploring - My Documents"] [data-tree-key="c"]', {
    button: 'right',
  })
  await check(
    2,
    'Drive context also works in the folder tree',
    `['Open','Explore','Find...','Format...','Properties'].every(t=>Array.from(document.querySelectorAll('[role="menuitem"]')).some(e=>e.textContent===t))`,
  )
  await shot('tree-context')
  await d.key('Escape')
  await clickText(d, '[data-window][aria-label="Exploring - My Documents"] [role="menubar"] button', 'Tools')
  await menuItem(d, 'Go to...')
  await d.clickSel('[aria-label="Go to folder"]')
  await d.key('a', { ctrl: true })
  await d.type('C:\\WINDOWS')
  await clickText(d, '[role="dialog"] button', 'OK')
  await check(
    1,
    'Go to path navigates Explorer in place',
    `Boolean(document.querySelector('[data-window][aria-label="Exploring - WINDOWS"]')) && document.querySelectorAll('[data-window]').length===2`,
  )
  await d.clickSel('[data-window][aria-label="Exploring - WINDOWS"] button[aria-label="Details"]')
  await check(
    'size',
    'Programs show realistic sizes in live Details',
    `document.querySelector('[data-window][aria-label="Exploring - WINDOWS"] [aria-label="CALC.EXE"] .explorer-size').textContent==='58 KB' && document.querySelector('[data-window][aria-label="Exploring - WINDOWS"] [aria-label="EXPLORER.EXE"] .explorer-size').textContent==='200 KB'`,
  )
  await shot('program-sizes')
  await d.clickSel('[data-window][aria-label="Exploring - WINDOWS"] button[aria-label="Close"]')
  const old = await d.rect('[data-window][aria-label="(C:)"]')
  await d.drag(old.x + old.width - 2, old.y + old.height - 2, old.x + old.width + 80, old.y + old.height + 50)
  const resized = await d.rect('[data-window][aria-label="(C:)"]')
  assert.ok(resized.width > old.width)
  await d.clickSel('[data-window][aria-label="(C:)"] button[aria-label="Close"]')
  await clickText(d, 'button', 'Start')
  await menuItem(d, 'Run...')
  await d.clickSel('#run-command')
  await d.type('mycomp')
  await clickText(d, '[role="dialog"] button', 'OK')
  await d.clickSel('[data-node-id="c"]', { clickCount: 2 })
  const reopened = await d.rect('[data-window][aria-label="(C:)"]')
  assert.deepEqual(reopened, resized)
  await check(
    29,
    'Folder size survives close and reopen',
    `(()=>{const r=document.querySelector('[data-window][aria-label="(C:)"]').getBoundingClientRect();return r.width===${resized.width} && r.height===${resized.height} && r.x===${resized.x} && r.y===${resized.y}})()`,
  )
  await clickText(d, `${root} [role="menubar"] button`, 'View')
  await menuItem(d, 'Options...')
  await clickText(d, '[role="tab"]', 'View')
  await clickText(d, '[role="dialog"] label', 'Show all files')
  await clickText(d, '[role="dialog"] button', 'OK')
  await check(
    10,
    'Show all files reveals the system Recycle folder',
    `Boolean(document.querySelector('${root} [data-node-id="recycled"]'))`,
  )
  await clickText(d, `${root} [role="menubar"] button`, 'View')
  await menuItem(d, 'Options...')
  await clickText(d, '[role="dialog"] label', 'Browse folders by using a single window')
  await clickText(d, '[role="dialog"] button', 'OK')
  await d.clickSel(`${root} [data-node-id="documents"]`, { clickCount: 2 })
  await check(
    10,
    'Single window browsing navigates without opening another window',
    `Boolean(document.querySelector('[data-window][aria-label="My Documents"]')) && document.querySelectorAll('[data-window]').length===2`,
  )
  console.log(`${results.length} command assertions passed`)
} finally {
  writeFileSync(join(out, 'command-runtime-errors.json'), `${JSON.stringify(d.diagnostics, null, 2)}\n`)
  writeFileSync(join(out, 'command-assertions.json'), `${JSON.stringify(results, null, 2)}\n`)
  await d.close()
}
