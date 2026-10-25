import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const port = Number(process.argv[2] ?? 9410)
const proof = resolve(process.argv[3] ?? '../proof/cpfix')
const group = process.argv[4] ?? 'folders'
mkdirSync(proof, { recursive: true })
const c = await connect(port)
const results = []
const text = (value) => JSON.stringify(value)

async function click(label, selector = 'button, [role="menuitem"]', count = 1) {
  const at = await c.eval(`(() => {
    const el = [...document.querySelectorAll(${text(selector)})].reverse().find(e => e.getClientRects().length && e.textContent.trim() === ${text(label)})
    if (!el) throw new Error('Missing ' + ${text(label)})
    const r = el.getBoundingClientRect(); return [r.x+r.width/2,r.y+r.height/2]
  })()`)
  await c.click(...at, { count })
}

async function run(command) {
  await c.clickOn('[data-start-button]')
  await click('Run...')
  await c.clickOn('#run-command')
  await c.key('a', ['Control'])
  await c.type(command)
  await c.key('Enter')
  await sleep(180)
}

async function reset() {
  await c.eval('localStorage.clear(); location.reload()')
  await sleep(500)
}

async function check(name, expression, shot) {
  const actual = await c.eval(expression)
  results.push({ name, actual, expression, shot })
  if (shot) await c.shot(join(proof, `${shot}.png`))
  assert.ok(actual, name)
  console.log(`PASS ${name}`)
}

try {
  await reset()
  if (group === 'baseline') {
    await run('control')
    const baseline = await c.eval(`({
      icons: [...document.querySelectorAll('.cp-icon')].map(e=>e.textContent.trim()),
      selected: document.querySelector('.cp-icon[aria-selected="true"]')?.textContent.trim(),
      status: [...document.querySelectorAll('[role="status"]')].map(e=>e.textContent),
      cellWidth: document.querySelector('.cp-icon')?.getBoundingClientRect().width
    })`)
    writeFileSync(join(proof, 'baseline.json'), JSON.stringify(baseline, null, 2))
    await c.shot(join(proof, 'before-control-panel.png'))
    await click('Date/Time', '.cp-icon', 2)
    await click('Time Zone', '[role="tab"]')
    await c.shot(join(proof, 'before-time-zone.png'))
    console.log(baseline)
  }
} finally {
  writeFileSync(join(proof, `${group}-checks.json`), JSON.stringify(results, null, 2))
  c.close()
}
