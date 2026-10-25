import assert from 'node:assert/strict'
import { clickText, connect, hoverMenuItem, menuItem, reset } from './appsfix3-cdp.mjs'

const d = await connect(9411)
try {
  await reset(d)
  await d.clickSel('[data-taskbar] button')
  await hoverMenuItem(d, 'Find')
  await menuItem(d, 'Files or Folders...')
  await d.wait(300)
  const focus = await d.evaluate('document.activeElement?.getAttribute("name")')
  await d.type('*.txt')
  await d.key('Enter')
  await d.wait(400)
  const value = await d.evaluate('document.querySelector("[name=named]").value')
  const rows = await d.evaluate('document.querySelectorAll(".find-results tbody tr").length')
  await d.shot(process.env.W95_PROOF_STAGE === 'before' ? '01-find-before' : '01-find-keyboard')
  console.log(JSON.stringify({ focus, value, rows }))
  assert.equal(focus, 'named', 'Find must open with the caret in Named')
  assert.equal(value, '*.txt', 'Typing immediately after launch must enter the name')
  assert.ok(rows > 0, 'Enter must search without clicking the Named field')
  await d.clickSel('[name=named]')
  await d.key('Tab', { shift: true })
  assert.equal(await d.evaluate('!!document.activeElement?.closest("[role=menubar]")'), false)
  await d.key('f', { alt: true })
  assert.ok(await d.evaluate('!!document.querySelector("[role=menu]")'), 'Alt+F must open File')
  await d.shot('11-find-alt-f')
  await d.key('Escape')
  await d.key('Escape')
  await d.key('F10')
  assert.ok(
    await d.evaluate('!!document.querySelector("[role=menubar] .bg-select")'),
    'F10 must arm the menu',
  )
  await d.key('ArrowRight')
  await d.key('ArrowDown')
  await clickText(d, '[role=menuitem]', 'Select All')
  assert.equal(
    await d.evaluate('document.querySelectorAll(".find-results tr[aria-selected=true]").length'),
    rows,
  )
  console.log('PASS findings 1 and 11: launch focus, type/Enter, Tab order, Alt+F, F10 and arrows')
} finally {
  await d.close()
}
