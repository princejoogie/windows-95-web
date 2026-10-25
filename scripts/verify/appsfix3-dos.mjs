import assert from 'node:assert/strict'
import { clickText, connect, reset, run } from './appsfix3-cdp.mjs'

const d = await connect(9411)
try {
  await reset(d)
  await run(d, 'command')
  assert.equal(await d.evaluate('document.activeElement.getAttribute("aria-label")'), 'MS-DOS command line')
  await d.type('help')
  await d.key('Enter')
  await d.type('edit new.txt')
  await d.key('Enter')
  assert.equal(
    await d.evaluate(
      '(document.querySelector(".dos-screen").textContent.match(/Bad command or file name/g) || []).length',
    ),
    2,
  )
  assert.equal(await d.evaluate('document.querySelectorAll("[data-window]").length'), 1)
  await d.clickSel('[aria-label="Mark"]')
  assert.equal(
    await d.evaluate('document.querySelector("[data-window]").getAttribute("aria-label")'),
    'Mark - MS-DOS Prompt',
  )
  const r = await d.rect('.dos-screen')
  await d.drag(r.x + 4, r.y + 8, r.x + 150, r.y + 36)
  assert.equal(
    await d.evaluate('document.querySelector("[data-window]").getAttribute("aria-label")'),
    'Select - MS-DOS Prompt',
  )
  await d.shot('34-dos-select')
  await d.key('Escape')
  await d.clickSel('[aria-label="Font"]')
  assert.equal(
    await d.evaluate('document.querySelector("[role=tabpanel]").getAttribute("aria-label")'),
    'Font',
  )
  const tabs = await d.evaluate('Array.from(document.querySelectorAll("[role=tab]")).map(e=>e.textContent)')
  assert.deepEqual(tabs, ['Program', 'Font', 'Memory', 'Screen', 'Misc'])
  assert.ok(
    await d.evaluate('document.querySelector("[role=dialog]").textContent.includes("Window preview")'),
  )
  await d.shot('34-dos-font')
  for (const tab of ['Program', 'Memory', 'Misc']) {
    await clickText(d, '[role=tab]', tab)
    await d.shot(`34-dos-${tab.toLowerCase()}`)
  }
  await clickText(d, '[role=dialog] button', 'Cancel')
  await d.clickSel('[role=combobox][aria-label="Font size"]')
  await d.shot('03-dos-combo')
  await d.key('ArrowDown')
  await d.key('Enter')
  assert.equal(
    await d.evaluate('document.querySelector(".dos-screen").style.getPropertyValue("--dos-row")'),
    '18px',
  )
  console.log(
    'PASS findings 3 DOS and 34 app-owned: EDIT/HELP, Mark/Select titles, Font button, five property tabs, font combo',
  )
} finally {
  await d.close()
}
