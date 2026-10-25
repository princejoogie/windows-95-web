// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import assert from 'node:assert/strict'
import { appMenu, clickText, connect, menuItem, reset, run } from './appsfix3-cdp.mjs'

const d = await connect(9411)
try {
  await reset(d)
  await run(d, 'calc')
  await appMenu(d, 'View')
  await menuItem(d, 'Scientific')
  assert.equal(
    await d.evaluate(
      'Array.from(document.querySelectorAll("fieldset")).filter(e=>e.textContent.includes("Hex") || e.textContent.includes("Degrees")).length',
    ),
    2,
  )
  await d.shot('32-calculator-scientific')
  await clickText(d, 'button', 'Sta')
  assert.ok(await d.evaluate('document.querySelector("[role=dialog]").textContent.includes("n=0")'))
  await d.shot('32-calculator-statistics')
  await reset(d)
  await run(d, 'charmap')
  await d.clickSel('[role=combobox][aria-label=Font]')
  await d.shot('03-charmap-font')
  await d.key('ArrowDown')
  await d.key('Enter')
  assert.notEqual(await d.evaluate('document.querySelector("[role=combobox]").textContent'), 'Arial')
  await reset(d)
  await run(d, 'wordpad')
  await d.clickSel('[contenteditable=true]')
  await d.type('format me')
  await d.key('a', { ctrl: true })
  assert.equal(await d.evaluate('document.querySelectorAll("[aria-label=Script]").length'), 0)
  await d.clickSel('[role=combobox][aria-label=Font]')
  await d.shot('36-wordpad-format-bar')
  await d.key('Home')
  await clickText(d, '[role=option]', 'Courier New')
  assert.ok(
    (await d.evaluate('document.querySelector("[contenteditable=true]").innerHTML')).includes('Courier New'),
  )
  await d.clickSel('[role=combobox][aria-label="Font Size"]')
  await clickText(d, '[role=option]', '18')
  const html = await d.evaluate('document.querySelector("[contenteditable=true]").innerHTML')
  assert.ok(html.includes('Courier New'), html)
  assert.ok(html.includes('18pt'), html)
  await d.shot('03-wordpad-font-applied')
  await appMenu(d, 'Format')
  await menuItem(d, 'Font...')
  assert.equal(await d.evaluate('document.querySelectorAll("[data-window] select").length'), 0)
  await d.shot('03-wordpad-font-dialog')
  await clickText(d, '[role=dialog] button', 'Cancel')
  await d.key('s', { ctrl: true })
  await d.key('a', { ctrl: true })
  await d.type('formatted.doc')
  await d.key('Enter')
  await d.wait(400)
  assert.ok(
    await d.evaluate(
      'JSON.parse(localStorage.getItem("w95.recent.v1")).some(id=>JSON.parse(localStorage.getItem("w95.fs.v1")).nodes[id]?.name==="formatted.doc")',
    ),
  )
  console.log(
    'PASS findings 3 Character Map/WordPad, 32, 36: etched frames, n=0, classic combos, removed Script, selected text formatting',
  )
} finally {
  await d.close()
}
