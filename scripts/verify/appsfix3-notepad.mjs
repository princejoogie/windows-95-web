import assert from 'node:assert/strict'
import { appMenu, clickText, connect, hoverMenuItem, menuItem, reset, run } from './appsfix3-cdp.mjs'

const d = await connect(9411)
try {
  await reset(d)
  await run(d, 'notepad')
  await d.type('hello')
  await d.key('f', { ctrl: true })
  await d.type('missing')
  await d.key('Enter')
  await d.wait(100)
  assert.ok(await d.evaluate('document.body.textContent.includes(\'Cannot find "missing"\')'))
  await d.key('Enter')
  await d.wait(150)
  assert.equal(
    await d.evaluate('document.activeElement.closest("[role=dialog]")?.getAttribute("aria-label")'),
    'Find',
  )
  await d.shot('30-notepad-find-focus')
  await d.key('Escape')
  assert.equal(await d.evaluate('!!document.querySelector("[role=dialog]")'), false)
  await appMenu(d, 'File')
  const labels = await d.evaluate(
    'Array.from(document.querySelectorAll("[role=menuitem]")).map(e=>e.textContent)',
  )
  assert.ok(labels.includes('Print'))
  assert.ok(!labels.includes('Print...'))
  await menuItem(d, 'Print')
  assert.ok(
    await d.evaluate(
      'document.querySelector("[role=dialog]").textContent.includes("Before you can perform printer-related tasks")',
    ),
  )
  await d.shot('30-notepad-print')
  await clickText(d, '[role=dialog] button', 'No')
  await appMenu(d, 'File')
  await menuItem(d, 'Page Setup...')
  await clickText(d, '[role=dialog] button', 'Printer...')
  assert.ok(await d.evaluate('document.body.textContent.includes("Do you want to install a printer now?")'))
  await clickText(d, '[role=dialog] button', 'No')
  await d.shot('30-notepad-page-setup')
  await clickText(d, '[role=dialog] button', 'Cancel')
  await d.key('s', { ctrl: true })
  assert.ok(
    await d.evaluate(
      'Array.from(document.querySelectorAll("[role=dialog] input")).some(e=>e.value==="*.txt")',
    ),
  )
  await d.shot('30-notepad-save-as')
  await d.key('a', { ctrl: true })
  await d.type('hello.txt')
  await d.key('Enter')
  await d.wait(350)
  assert.ok(
    await d.evaluate(
      'Array.from(document.querySelectorAll("[data-window]")).some(e=>e.getAttribute("aria-label")==="hello.txt - Notepad")',
    ),
  )
  await d.clickSel('[data-taskbar] button')
  await hoverMenuItem(d, 'Documents')
  assert.ok(
    await d.evaluate(
      'Array.from(document.querySelectorAll("[role=menuitem]")).some(e=>e.textContent==="hello.txt")',
    ),
  )
  await d.shot('39-start-documents')
  console.log(
    'PASS findings 30 app-owned and 39: Find focus/Esc, Print, Page Setup Printer, Save As wildcard, recent document',
  )
} finally {
  await d.close()
}
