import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const proof =
  process.env.W95_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/finalfix-apps-controlpanel'
mkdirSync(proof, { recursive: true })
const app = await connect(Number(process.env.W95_CDP_PORT ?? 9452))
const phase = process.argv[2] ?? 'baseline'
const results = []
const dialog = (name) => `[role="dialog"][aria-label=${JSON.stringify(name)}]`
const clickText = async (text, within = 'body', options = {}) => {
  const at = await app.eval(
    `(()=>{const root=document.querySelector(${JSON.stringify(within)}); const e=[...root.querySelectorAll('button,[role=tab],[role=option],[role=menuitem],[data-shell-item]')].find(e=>e.textContent.trim()===${JSON.stringify(text)}&&e.getClientRects().length);if(!e)throw Error('Missing '+${JSON.stringify(text)});const b=e.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await app.click(...at, options)
}
const fill = async (selector, value) => {
  await app.clickOn(selector)
  await app.key('a', ['Control'])
  await app.type(value)
}
const choose = async (label, value) => {
  await app.clickOn(`[role=combobox][aria-label=${JSON.stringify(label)}]`)
  await clickText(value)
}
const run = async (command) => {
  await app.clickOn('[data-start-button]')
  await clickText('Run...')
  await fill('#run-command', command)
  await app.key('Enter')
  await sleep(150)
}
const openPanel = async (name) => {
  await run('control')
  await clickText(name, '[data-window]', { count: 2 })
}
const reload = async () => {
  await app.send('Page.reload')
  await sleep(350)
  await app.waitFor(`!!document.querySelector('[data-start-button]')`)
}
const shot = (name) => app.shot(join(proof, `${phase}-${name}.png`))
const check = async (finding, behavior, expression, expected) => {
  const value = await app.eval(expression)
  results.push({ finding, behavior, value, expected })
  assert.deepEqual(value, expected, behavior)
  console.log('PASS', finding, behavior, value)
}
try {
  if (phase === 'fonts') {
    await reload()
    await openPanel('Fonts')
    await app.waitFor(`document.querySelector('[data-window]').textContent.includes('MS Sans Serif')`)
    await shot('catalog-before')
    await app.key('f', ['Alt'])
    await clickText('Install New Font...')
    await shot('add-fonts')
    await choose('Font drive', 'A: Floppy')
    await check(
      10,
      'missing floppy reports unavailable media',
      `document.querySelector(${JSON.stringify(dialog('Add Fonts'))}).textContent.includes('No installation media is available')`,
      true,
    )
    await choose('Font drive', 'C: Local Disk')
    await clickText('WINDOWS', '[aria-label="Font folders"]')
    await clickText('MICROSS.TTF', dialog('Add Fonts'))
    await clickText('OK', dialog('Add Fonts'))
    await app.waitFor(`!document.querySelector(${JSON.stringify(dialog('Add Fonts'))})`)
    await check(
      10,
      'catalog contains installed font from real font bytes',
      `JSON.parse(localStorage.getItem('win95.fonts.v1')).map(f=>({name:f.name,file:f.file,format:f.format,bytes:f.byteLength,copy:f.source.kind}))`,
      [
        {
          name: 'Microsoft Sans Serif',
          file: 'MICROSS.TTF',
          format: 'TrueType',
          bytes: 652664,
          copy: 'copy',
        },
      ],
    )
    await check(
      10,
      'installed browser font face loaded',
      `[...document.fonts].some(f=>f.family.startsWith('Win95Font-')&&f.status==='loaded'&&f.family.length>30)`,
      true,
    )
    await shot('installed')
    await reload()
    await openPanel('Fonts')
    await app.waitFor(`document.querySelector('[data-window]').textContent.includes('Microsoft Sans Serif')`)
    await check(
      10,
      'installed catalog survives full reload',
      `document.querySelector('[data-window]').textContent.includes('Microsoft Sans Serif')`,
      true,
    )
    await shot('reload')
  }
  if (phase === 'baseline') {
    await openPanel('Accessibility Options')
    await app.clickOn('[aria-label="StickyKeys Settings"]')
    await app.clickOn(`${dialog('Settings for StickyKeys')} input[type=checkbox]`)
    await clickText('OK', dialog('Settings for StickyKeys'))
    await app.clickOn('[aria-label="StickyKeys Settings"]')
    await check(
      5,
      'baseline discards nested StickyKeys edit',
      `${JSON.stringify(dialog('Settings for StickyKeys'))}&&document.querySelector(${JSON.stringify(dialog('Settings for StickyKeys'))}).querySelector('input').checked`,
      true,
    )
    await shot('sticky-discarded')
    await reload()
    await openPanel('Network')
    await clickText('TCP/IP')
    await clickText('Properties', dialog('Network'))
    await check(
      7,
      'baseline TCP/IP has no property pages',
      `${JSON.stringify(dialog('TCP/IP Properties'))}&&document.querySelector(${JSON.stringify(dialog('TCP/IP Properties'))}).querySelectorAll('[role=tab]').length`,
      0,
    )
    await shot('tcpip-missing')
    await reload()
    await openPanel('Regional Settings')
    await clickText('Number')
    await app.clickOn('[aria-label="Measurement system"]')
    await check(
      8,
      'baseline offers only U.S.',
      `[...document.querySelectorAll('[role=listbox] [role=option]')].filter(e=>!e.closest('[data-window]')&&!e.closest('[data-desktop]')).map(e=>e.textContent.trim())`,
      ['U.S.'],
    )
    await shot('regional-fixed')
    await reload()
    await run('control')
    await clickText('Display', '[data-window]')
    await app.key('f', ['Alt'])
    await check(
      9,
      'baseline special-folder shortcut disabled',
      `[...document.querySelectorAll('[role=menuitem]')].find(e=>e.textContent.includes('Create Shortcut')).getAttribute('aria-disabled')`,
      'true',
    )
    await shot('shortcut-disabled')
    await reload()
    await openPanel('Fonts')
    await app.key('f', ['Alt'])
    await check(
      10,
      'baseline Install New Font missing',
      `[...document.querySelectorAll('[role=menuitem]')].some(e=>e.textContent.includes('Install New Font'))`,
      false,
    )
    await shot('fonts-install-missing')
  }
} finally {
  writeFileSync(join(proof, `${phase}-results.json`), JSON.stringify(results, null, 2))
  app.close()
}
