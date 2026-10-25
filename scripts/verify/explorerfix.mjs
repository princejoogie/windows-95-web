import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clickText, connect, hoverMenuItem, menuItem, probes, reset } from './explorerfix-driver.mjs'

const out = 'D:/codes/worktrees/windows-95-web/proof/explorerfix'
mkdirSync(out, { recursive: true })
const d = await connect(9380)
const results = []
const check = async (finding, name, expression) => {
  const actual = await d.evaluate(expression)
  results.push({ finding, name, actual })
  assert.equal(actual, true, name)
}
const shot = async (name) => {
  await d.wait(150)
  const result = await d.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(out, `${name}.png`), Buffer.from(result.result.data, 'base64'))
}
try {
  await reset(d)
  await d.clickSel('[data-desktop-item="app:mycomputer"]', { clickCount: 2 })
  await d.clickSel('[data-node-id="c"]', { clickCount: 2 })
  await shot(process.argv.includes('--baseline') ? 'before-folder' : 'folder')
  if (process.argv.includes('--baseline')) {
    const baseline = {
      windows: await d.evaluate(probes.windows),
      tree: await d.evaluate('Boolean(document.querySelector(\'[role="tree"]\'))'),
    }
    await d.clickSel('.explorer-items', { button: 'right' })
    baseline.contextMenu = await d.evaluate('Boolean(document.querySelector(\'[role="menu"]\'))')
    await clickText(d, '[role="menubar"] button', 'Edit')
    baseline.edit = await d.evaluate(probes.menuItems)
    writeFileSync(join(out, 'baseline.json'), `${JSON.stringify(baseline, null, 2)}\n`)
    console.log(JSON.stringify(baseline))
  } else {
    const root = '[data-window="2"]'
    await d.clickSel(`${root} [data-node-id="autoexec"]`, { button: 'right' })
    await check(
      2,
      'File context has Copy and Properties',
      `Array.from(document.querySelectorAll('[role="menuitem"]')).some(e=>e.textContent.trim()==='Copy') && Array.from(document.querySelectorAll('[role="menuitem"]')).some(e=>e.textContent.trim()==='Properties')`,
    )
    await shot('p0-file-context')
    await d.key('Escape')
    await d.key('c', { ctrl: true })
    await d.key('v', { ctrl: true })
    await check(
      3,
      'Copy in same folder has Copy of name',
      `Boolean(document.querySelector('${root} [aria-label="Copy of AUTOEXEC.BAT"]'))`,
    )
    await shot('p0-copy')
    await d.key('x', { ctrl: true })
    await d.clickSel(`${root} [data-node-id="documents"]`, { clickCount: 2 })
    await d.key('v', { ctrl: true })
    await check(
      3,
      'Cut paste moves into destination',
      `Boolean(document.querySelector('[data-window="3"] [aria-label="Copy of AUTOEXEC.BAT"]')) && !document.querySelector('${root} [aria-label="Copy of AUTOEXEC.BAT"]')`,
    )
    await d.key('z', { ctrl: true })
    await check(
      3,
      'Undo Move restores source',
      `Boolean(document.querySelector('${root} [aria-label="Copy of AUTOEXEC.BAT"]')) && !document.querySelector('[data-window="3"] [aria-label="Copy of AUTOEXEC.BAT"]')`,
    )
    await d.clickSel('[data-window="3"] button[aria-label="Close"]')
    await d.clickSel(`${root} [aria-label="Copy of AUTOEXEC.BAT"]`)
    await d.key('F2')
    await d.type('Renamed.BAT')
    await d.key('Enter')
    await d.key('z', { ctrl: true })
    await check(
      3,
      'Undo Rename restores name',
      `Boolean(document.querySelector('${root} [aria-label="Copy of AUTOEXEC.BAT"]'))`,
    )
    await d.key('Delete')
    await clickText(d, '[role="dialog"] button', 'Yes')
    await d.key('z', { ctrl: true })
    await check(
      3,
      'Undo Delete restores item',
      `Boolean(document.querySelector('${root} [aria-label="Copy of AUTOEXEC.BAT"]'))`,
    )
    await clickText(d, 'button', 'Start')
    await hoverMenuItem(d, 'Programs')
    await menuItem(d, 'Windows Explorer')
    await check(
      1,
      'Start Explorer has two panes and title',
      `Array.from(document.querySelectorAll('[data-window]')).some(e=>e.getAttribute('aria-label').startsWith('Exploring - C:') && e.querySelector('[role="tree"]')) && document.body.innerText.includes('Contents of')`,
    )
    await shot('p0-exploring')
    const exploring = '[data-window="4"]'
    await d.clickSel(`${exploring} [data-tree-key="documents"]`)
    await check(
      1,
      'Tree navigates in place',
      `document.querySelectorAll('[data-window]').length===3 && Boolean(document.querySelector('${exploring} [aria-label="Readme.txt"]'))`,
    )
    await d.clickSel(`${exploring} [data-tree-key="c"]`)
    await d.clickSel(`${exploring} .explorer-items`, { button: 'right' })
    await check(
      2,
      'Background context has Paste Shortcut and New',
      `Array.from(document.querySelectorAll('[role="menuitem"]')).some(e=>e.textContent.trim()==='Paste Shortcut') && Array.from(document.querySelectorAll('[role="menuitem"]')).some(e=>e.textContent.trim()==='New')`,
    )
    await shot('p0-background-context')
    console.log(JSON.stringify(results))
  }
} finally {
  writeFileSync(join(out, 'p0-runtime-errors.json'), `${JSON.stringify(d.diagnostics, null, 2)}\n`)
  writeFileSync(join(out, 'assertions.json'), `${JSON.stringify(results, null, 2)}\n`)
  await d.close()
}
