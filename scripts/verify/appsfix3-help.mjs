import assert from 'node:assert/strict'
import { clickText, connect, reset, run } from './appsfix3-cdp.mjs'

const d = await connect(9411)
try {
  await reset(d)
  await run(d, 'winhlp32')
  await clickText(d, '.help-browser button', 'Print...')
  assert.ok(
    await d.evaluate(
      'document.querySelector("[role=dialog]").textContent.includes("No printers are installed.")',
    ),
  )
  await d.key('Enter')
  await clickText(d, '[role=tab]', 'Find')
  assert.equal(
    await d.evaluate('document.querySelector("[role=dialog]").getAttribute("aria-label")'),
    'Find Setup Wizard',
  )
  await d.shot('35-help-wizard')
  await clickText(d, '[role=dialog] button', 'Next >')
  await clickText(d, '[role=dialog] button', 'Next >')
  await clickText(d, '[role=dialog] button', 'Finish')
  assert.equal(await d.evaluate('document.querySelectorAll("[role=dialog]").length'), 0)
  const body = await d.evaluate('document.querySelector(".help-browser").textContent')
  for (const text of [
    '1 Type the word(s)',
    '2 Select some matching words',
    '3 Click a topic',
    'Clear',
    'Options...',
    'Find Similar...',
    'Find Now',
    'Rebuild...',
  ])
    assert.ok(body.includes(text), text)
  await d.clickSel('.help-browser input')
  await d.type('file')
  await d.shot('35-help-find')
  await clickText(d, '.help-browser button', 'Display')
  assert.ok(await d.evaluate('!!document.querySelector("[aria-label=\'Help topic\']")'))
  await d.shot('35-help-topic')
  await clickText(d, 'button', 'Help Topics')
  await clickText(d, '[role=tab]', 'Find')
  assert.equal(await d.evaluate('document.querySelectorAll("[role=dialog]").length'), 0)
  console.log(
    'PASS finding 35 app-owned: fixed window, Print, setup wizard, numbered Find controls, topic display, persisted setup',
  )
} finally {
  await d.close()
}
