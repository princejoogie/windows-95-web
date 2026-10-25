import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const port = Number(process.argv[2] ?? 9390)
const proof = resolve(process.argv[3] ?? '../proof/wire-a')
const item = process.argv[4] ?? 'wordpad'
mkdirSync(proof, { recursive: true })
const c = await connect(port)
const checks = []

async function check(name, expression, screenshot) {
  const actual = await c.eval(expression)
  assert.ok(actual, `${name}: ${JSON.stringify(actual)}`)
  checks.push({ name, expression, actual, screenshot: screenshot ?? null })
  console.log(`PASS ${name}`)
  if (screenshot) await c.shot(join(proof, `${screenshot}.png`))
}

async function clickText(text, selector = 'button, [role="menuitem"]', count = 1) {
  const point = await c.eval(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].reverse().find(el =>
      el.getClientRects().length && el.textContent.trim() === ${JSON.stringify(text)})
    if (!el) throw new Error('Missing text ' + ${JSON.stringify(text)})
    const b = el.getBoundingClientRect()
    return [b.x + b.width / 2, b.y + b.height / 2]
  })()`)
  await c.click(...point, { count })
}

async function run(command) {
  await c.clickOn('[data-start-button]')
  await clickText('Run...')
  await c.clickOn('#run-command')
  await c.key('a', ['Control'])
  await c.type(command)
  await c.key('Enter')
  await sleep(200)
}

async function shutdown() {
  await c.clickOn('[data-start-button]')
  await clickText('Shut Down...')
  await c.clickOn('input[value="logoff"]')
  await clickText('Yes')
}

try {
  await c.send('Page.reload')
  await sleep(100)
  await c.waitFor('!!document.querySelector("[data-start-button]")')
  if (item === 'wordpad') {
    await run('wordpad')
    await c.clickOn('.wordpad-page[contenteditable]')
    await c.type('Unsaved close verification')
    await shutdown()
    await check(
      'Shutdown asks WordPad to save',
      'document.body.innerText.includes("Save changes to Document?")',
      'wordpad-save-prompt',
    )
    await clickText('Cancel')
    await check(
      'Cancel preserves WordPad and its document',
      'document.querySelector(".wordpad-page[contenteditable]")?.textContent.includes("Unsaved close verification") && !document.querySelector("[role=dialog]")',
    )
    await shutdown()
    await clickText('Yes')
    await c.waitFor('!!document.querySelector("[role=dialog] input")')
    await clickText('Cancel')
    await check(
      'Cancel in Save As also rejects shutdown',
      '!!document.querySelector(".wordpad-page[contenteditable]") && !document.querySelector("[role=dialog]")',
      'wordpad-save-cancel',
    )
    await c.key('F4', ['Alt'])
    await clickText('No')
    await check(
      'Discard completes close after canceled shutdowns',
      '!document.querySelector(".wordpad-page[contenteditable]")',
    )
    await run('wordpad')
    await c.key('F4', ['Alt'])
    await check(
      'Clean document closes without prompting',
      '!document.querySelector(".wordpad-page[contenteditable]") && !document.querySelector("[role=dialog]")',
    )
    await run('wordpad')
    await c.clickOn('.wordpad-page[contenteditable]')
    await c.type('Saved close verification')
    await c.key('F4', ['Alt'])
    await clickText('Yes')
    await c.clickOn('[role="dialog"] input[id$="-name"]')
    await c.key('a', ['Control'])
    await c.type(`WireA-${Date.now()}.doc`)
    await clickText('Save')
    await c.waitFor('!document.querySelector(".wordpad-page[contenteditable]")')
    await c.waitFor(
      'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).some(node => node.kind === "file" && node.content.includes("Saved close verification"))',
    )
    await check(
      'Save persists content before close',
      'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).some(node => node.kind === "file" && node.content.includes("Saved close verification"))',
      'wordpad-saved',
    )
  }
  writeFileSync(join(proof, `${item}.json`), `${JSON.stringify({ port, item, checks }, null, 2)}\n`)
} catch (error) {
  console.log(await c.eval('document.body.innerText'))
  await c.shot(join(proof, `${item}-failure.png`))
  throw error
} finally {
  c.close()
}
