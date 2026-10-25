import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clickText, connect, menuItem, reset } from './explorerfix-driver.mjs'

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
  await check(
    8,
    'My Computer lists floppy, C, Control Panel, Printers in order',
    `JSON.stringify(Array.from(document.querySelectorAll('.explorer-item')).map(e=>e.getAttribute('aria-label')))==='["3½ Floppy (A:)","C:","Control Panel","Printers"]'`,
  )
  await shot('mycomputer')
  await d.clickSel('[data-shell-item="shell:floppy"]', { clickCount: 2 })
  await check(
    8,
    'Floppy shows device not ready with Retry and Cancel',
    `document.querySelector('[role="dialog"]').innerText.includes('The device is not ready.') && Array.from(document.querySelectorAll('[role="dialog"] button')).some(e=>e.textContent==='Retry')`,
  )
  await shot('floppy-not-ready')
  await clickText(d, '[role="dialog"] button', 'Cancel')
  await d.clickSel('[data-shell-item="shell:controlpanel"]', { clickCount: 2 })
  await check(
    8,
    'Control Panel launches from My Computer',
    `Boolean(document.querySelector('[data-window][aria-label="Control Panel"]'))`,
  )
  await d.clickSel('[data-window][aria-label="Control Panel"] button[aria-label="Close"]')
  await d.clickSel('[data-node-id="c"]', { clickCount: 2 })
  const root = '[data-location="(C:)"]'
  await check(
    8,
    'Drive window title is (C:)',
    `Boolean(document.querySelector('[data-window][aria-label="(C:)"]'))`,
  )
  await check(
    24,
    'Registered extensions hidden',
    `document.querySelector('${root} [data-node-id="autoexec"] .explorer-name').textContent==='AUTOEXEC'`,
  )
  await d.clickSel(`${root} .explorer-items`)
  await d.key('Home')
  await d.key('ArrowDown')
  await check(
    25,
    'Down moves one grid row',
    `(()=>{const l=document.querySelector('${root} .explorer-items'); const items=[...l.querySelectorAll('.explorer-item')]; const step=Math.max(1,Math.floor(l.clientWidth/75)); return items[Math.min(step,items.length-1)].getAttribute('aria-selected')==='true'})()`,
  )
  await d.key('c')
  await check(
    26,
    'Type ahead selects CONFIG',
    `document.querySelector('${root} [data-node-id="config"]').getAttribute('aria-selected')==='true'`,
  )
  await check(
    9,
    'Selection count and size have separate status panes',
    `document.querySelector('${root}').innerText.includes('1 object(s) selected') && document.querySelector('${root}').innerText.includes('bytes')`,
  )
  await check(
    28,
    'Selected icon has a masked dither',
    `Boolean(document.querySelector('${root} .selected .explorer-icon-dither'))`,
  )
  await d.key('Enter', { alt: true })
  await check(
    11,
    'Alt Enter opens shared General property sheet',
    `Boolean(document.querySelector('[role="dialog"][aria-label="CONFIG.SYS Properties"] [role="tab"]')) && document.querySelector('[role="dialog"]').innerText.includes('MS-DOS name:')`,
  )
  await shot('properties')
  await clickText(d, '[role="dialog"] button', 'Cancel')
  await d.key('F2')
  await check(
    24,
    'Rename edits only registered stem',
    `document.querySelector('input[aria-label="Rename"]').value==='CONFIG'`,
  )
  await d.key('a', { ctrl: true })
  await d.type('bad/name')
  await d.key('Enter')
  await check(
    30,
    'Rename failure has error title and filename prefix',
    `Boolean(document.querySelector('[role="dialog"][aria-label="Error Renaming File"]')) && document.querySelector('[role="dialog"]').innerText.includes('Cannot rename CONFIG.SYS:')`,
  )
  await shot('rename-error')
  await clickText(d, '[role="dialog"] button', 'OK')
  await clickText(d, `${root} [role="menubar"] button`, 'View')
  await menuItem(d, 'Details')
  await d.clickSel(`${root} [data-node-id="config"]`)
  await check(
    12,
    'Details leaves Type and Size cells white with right aligned size',
    `(()=>{const r=document.querySelector('${root} .selected');return getComputedStyle(r).backgroundColor!=='rgb(0, 0, 128)' && getComputedStyle(r.querySelector('.explorer-size')).textAlign==='right'})()`,
  )
  await check(
    23,
    'Details uses two digit date without seconds',
    `Array.from(document.querySelectorAll('${root} .explorer-cell')).some(e=>new RegExp('^[0-9]{1,2}/[0-9]{1,2}/[0-9]{2} [0-9]{1,2}:[0-9]{2} [AP]M$').test(e.textContent))`,
  )
  await check(
    31,
    'Details has no needless vertical scrollbar',
    `(()=>{const e=document.querySelector('${root} .explorer-files');return e.scrollHeight<=e.clientHeight})()`,
  )
  await shot('details')
  await clickText(d, `${root} [role="menubar"] button`, 'View')
  await check(
    10,
    'View has Toolbar, Arrange, Refresh and Options',
    `['Toolbar','Arrange Icons','RefreshF5','Options...'].every(t=>Array.from(document.querySelectorAll('[role="menuitem"]')).some(e=>e.textContent.replaceAll(' ','')===t.replaceAll(' ','')))`,
  )
  await menuItem(d, 'Options...')
  await clickText(d, '[role="tab"]', 'View')
  await check(
    10,
    'Options has extension and hidden file settings',
    `document.querySelector('[role="dialog"]').innerText.includes('Hide MS-DOS file extensions') && document.querySelector('[role="dialog"]').innerText.includes('Show all files')`,
  )
  await shot('folder-options')
  await clickText(d, '[role="dialog"] button', 'Cancel')
  await clickText(d, `${root} [role="menubar"] button`, 'Help')
  await check(
    33,
    'Help Topics precedes About',
    `Array.from(document.querySelectorAll('[role="menuitem"]')).map(e=>e.textContent).join('|')==='Help Topics|About Windows 95'`,
  )
  await menuItem(d, 'About Windows 95')
  await check(
    32,
    'About uses Windows license and resource layout',
    `document.querySelector('[role="dialog"]').innerText.includes('This product is licensed to:') && document.querySelector('[role="dialog"]').innerText.includes('32,000 KB')`,
  )
  await shot('about')
  await clickText(d, '[role="dialog"] button', 'OK')
  const before = await d.rect('[data-window][aria-label="(C:)"]')
  await d.clickSel('[data-window][aria-label="(C:)"] button[aria-label="Close"]')
  await d.clickSel('[data-node-id="c"]', { clickCount: 2 })
  const after = await d.rect('[data-window][aria-label="(C:)"]')
  assert.deepEqual(after, before)
  await check(
    29,
    'Reopening folder remembers Details view and placement',
    `Boolean(document.querySelector('${root} .explorer-details'))`,
  )
  await d.clickSel(`${root} [data-node-id="config"]`)
  await d.key('Delete')
  await check(
    22,
    'Recycle confirmation names item and uses recycle picture',
    `document.querySelector('[role="dialog"]').innerText.includes("Are you sure you want to send 'CONFIG.SYS' to the Recycle Bin?") && Boolean(document.querySelector('[role="img"][aria-label="Send file to Recycle Bin"]'))`,
  )
  await shot('recycle-confirmation')
  await clickText(d, '[role="dialog"] button', 'Yes')
  await d.clickSel('[data-window][aria-label="(C:)"] button[aria-label="Close"]')
  await d.clickSel('[data-window][aria-label="My Computer"] button[aria-label="Close"]')
  await d.clickSel('[data-desktop-item="app:recyclebin"]', { clickCount: 2 })
  const bin = '[data-location="Recycle Bin"]'
  await check(
    20,
    'Recycle Bin opens in Details with original column order',
    `Array.from(document.querySelectorAll('${bin} .explorer-head button')).map(e=>e.textContent).join('|')==='Name|Original Location|Date Deleted|Type|Size'`,
  )
  await shot('recycle-bin')
  await d.clickSel(`${bin} [data-node-id="config"]`)
  await d.key('Delete')
  await check(
    22,
    'Permanent deletion names single item',
    `document.querySelector('[role="dialog"]').innerText.includes("Are you sure you want to delete 'CONFIG.SYS'?")`,
  )
  await shot('permanent-confirmation')
  await clickText(d, '[role="dialog"] button', 'No')
  await d.clickSel(`${bin} .explorer-items`)
  await clickText(d, `${bin} [role="menubar"] button`, 'File')
  await menuItem(d, 'Properties')
  await check(
    'missing',
    'Recycle Bin property tabs exist',
    `Array.from(document.querySelectorAll('[role="tab"]')).map(e=>e.textContent).join('|')==='Global|(C:)'`,
  )
  await shot('recycle-properties')
  await d.clickSel('[role="dialog"] input[type="checkbox"]')
  await clickText(d, '[role="dialog"] button', 'OK')
  await d.clickSel('[data-window][aria-label="Recycle Bin"] button[aria-label="Close"]')
  await d.clickSel('[data-desktop-item="app:mycomputer"]', { clickCount: 2 })
  await d.clickSel('[data-node-id="c"]', { clickCount: 2 })
  await d.clickSel(`${root} [data-node-id="autoexec"]`)
  await d.key('Delete')
  await check(
    'missing',
    'Recycle Bin confirmation setting applies to folder deletes',
    `!document.querySelector('[role="dialog"]') && !document.querySelector('${root} [data-node-id="autoexec"]')`,
  )
  await d.clickSel('[data-window][aria-label="(C:)"] button[aria-label="Close"]')
  await d.clickSel('[data-window][aria-label="My Computer"] button[aria-label="Close"]')
  await d.clickSel('[data-desktop-item="app:recyclebin"]', { clickCount: 2 })
  await d.clickSel(`${bin} .explorer-items`)
  await d.key('a', { ctrl: true })
  await d.key('Delete')
  await check(
    22,
    'Multiple permanent deletion names the item count',
    `document.querySelector('[role="dialog"]').innerText.includes('Are you sure you want to delete these 2 items?')`,
  )
  await shot('multiple-delete-confirmation')
  await clickText(d, '[role="dialog"] button', 'No')
  await clickText(d, `${bin} [role="menubar"] button`, 'File')
  await menuItem(d, 'Empty Recycle Bin')
  await check(
    22,
    'Empty Recycle Bin uses the same counted wording',
    `document.querySelector('[role="dialog"]').innerText.includes('Are you sure you want to delete these 2 items?')`,
  )
  await shot('empty-bin-confirmation')
  await clickText(d, '[role="dialog"] button', 'No')
  console.log(`${results.length} fidelity assertions passed`)
} finally {
  writeFileSync(join(out, 'fidelity-runtime-errors.json'), `${JSON.stringify(d.diagnostics, null, 2)}\n`)
  writeFileSync(join(out, 'fidelity-assertions.json'), `${JSON.stringify(results, null, 2)}\n`)
  await d.close()
}
