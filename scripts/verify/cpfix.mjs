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
  await c.eval('localStorage.clear()')
  await c.send('Page.reload', { ignoreCache: true })
  await sleep(100)
  await c.waitFor('!!document.querySelector("[data-start-button]")', 8000)
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
  if (group === 'folders') {
    await run('control')
    await check(
      '6: Control Panel starts with no selection on the shared 75px grid',
      `document.querySelectorAll('[data-location="Control Panel"] [aria-selected="true"]').length === 0 && document.querySelector('[data-shell-item="display"]').getBoundingClientRect().width === 75`,
      '06-control-panel',
    )
    await c.clickOn('[data-shell-item="display"]')
    await check(
      '6: selecting Display puts its description in the second status pane and dithers the icon',
      `document.querySelector('[data-location="Control Panel"]').textContent.includes('Changes settings for your display.') && !!document.querySelector('[data-shell-item="display"] .explorer-icon-dither')`,
      '06-description',
    )
    await click('File', '[role="menubar"] button')
    await check(
      '6: Control Panel inherits the full File menu',
      `['Open','Create Shortcut','Delete','Rename','Properties','Close'].every(t=>[...document.querySelectorAll('[role="menu"] [role="menuitem"]')].some(e=>e.textContent.replaceAll('&','').includes(t)))`,
      '06-file-menu',
    )
    await c.key('Escape')
    await c.key('Escape')
    const at = await c.eval(
      `(()=>{const r=document.querySelector('.explorer-items').getBoundingClientRect();return [r.right-10,r.bottom-10]})()`,
    )
    await c.click(...at, { button: 'right' })
    await check(
      '6: background context menu has folder commands',
      `['View','Arrange Icons','Line up Icons','Refresh','Paste','Paste Shortcut','Undo','Properties'].every(t=>[...document.querySelectorAll('[role="menu"] [role="menuitem"]')].some(e=>e.textContent.includes(t)))`,
      '06-background-menu',
    )
    await c.key('Escape')
    await c.clickOn('[data-shell-item="fonts"]', { count: 2 })
    await check(
      '17: Fonts is a folder with five fonts and four menus',
      `!!document.querySelector('[data-location="Fonts"]') && document.querySelectorAll('[data-location="Fonts"] [role="option"]').length === 5 && document.querySelector('[data-location="Fonts"]').textContent.includes('5 font(s)')`,
      '17-fonts-folder',
    )
    await click('View', '[role="menubar"] button')
    await check(
      '17: Fonts has similarity and variation commands',
      `document.querySelector('[role="menu"]').textContent.includes('List Fonts By Similarity') && document.querySelector('[role="menu"]').textContent.includes('Hide Variations')`,
      '17-view-menu',
    )
    await c.key('Escape')
    await c.key('Escape')
    await c.clickOn('[data-shell-item="ARIAL.TTF"]', { count: 2 })
    await check(
      '17: font preview contains metadata, seven point sizes, Done and Print',
      `(()=>{const d=document.querySelector('[role="dialog"]');return d.textContent.includes('Filename: ARIAL.TTF') && [12,18,24,36,48,60,72].every(n=>d.querySelector('[style*="font-size: '+n+'pt"]')) && [...d.querySelectorAll('button')].some(e=>e.textContent==='Print')})()`,
      '17-font-preview',
    )
    await reset()
    await c.clickOn('[aria-label="My Computer"]', { count: 2 })
    await c.clickOn('[data-shell-item="shell:printers"]', { count: 2 })
    await check(
      '4: My Computer opens the Printers folder with Add Printer',
      `!!document.querySelector('[data-location="Printers"] [data-shell-item="add-printer"]') && document.querySelector('[data-location="Printers"]').textContent.includes('1 object(s)')`,
      '04-printers',
    )
    await c.clickOn('[data-shell-item="add-printer"]', { count: 2 })
    await check(
      '4: Add Printer opens its wizard',
      `document.querySelector('[role="dialog"]').textContent.includes('This wizard will help you install a printer.')`,
      '04-printer-welcome',
    )
    await click('Next >')
    await click('Next >')
    await check(
      '4: wizard ends with no printer ports and no fake printer installed',
      `document.querySelector('[role="dialog"]').textContent.includes('No printer ports are available')`,
      '04-printer-no-port',
    )
    await click('Finish')
    await reset()
    await run('nethood')
    await c.clickOn('[data-shell-item="entire-network"]', { button: 'right' })
    await check(
      '5: Entire Network has its shell context menu',
      `['Open','Explore','Find Computer...','Create Shortcut','Properties'].every(t=>[...document.querySelectorAll('[role="menu"] [role="menuitem"]')].some(e=>e.textContent.includes(t)))`,
      '05-network-context',
    )
    await c.key('Escape')
    await c.clickOn('[data-shell-item="entire-network"]', { count: 2 })
    await check(
      '5: Entire Network reports the offline browse failure',
      `document.querySelector('[role="dialog"]').textContent.includes('Unable to browse the network.')`,
      '05-network-error',
    )
    await c.key('Escape')
    await click('View', '[role="menubar"] button')
    await check(
      '5: Network has the full folder View menu',
      `['Toolbar','Status Bar','Large Icons','Small Icons','List','Details','Arrange Icons','Line up Icons','Refresh','Options...'].every(t=>document.querySelector('[role="menu"]').textContent.includes(t))`,
      '05-network-view',
    )
    await reset()
    await run('explorer')
    await c.clickOn('[data-tree-key="controlpanel"]')
    await check(
      'shell integration: the Explorer tree hosts Control Panel in place',
      `!!document.querySelector('[data-location="Control Panel"] [data-shell-item="display"]') && document.querySelectorAll('[data-location]').length === 1`,
      '06-explorer-control-panel',
    )
    await c.clickOn('[data-tree-key="printers"]')
    await check(
      'shell integration: the Explorer tree hosts Printers in place',
      `!!document.querySelector('[data-location="Printers"] [data-shell-item="add-printer"]')`,
      '04-explorer-printers',
    )
  }
} finally {
  writeFileSync(join(proof, `${group}-checks.json`), JSON.stringify(results, null, 2))
  c.close()
}
