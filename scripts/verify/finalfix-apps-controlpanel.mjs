import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const proof =
  process.env.W95_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/finalfix-apps-controlpanel'
mkdirSync(proof, { recursive: true })
const app = await connect(Number(process.env.W95_CDP_PORT ?? 9452))
const phase = process.argv[2] ?? 'baseline'
writeFileSync(
  join(proof, `${phase}-runtime.json`),
  JSON.stringify(
    await app.eval('({url:location.href,title:document.title,userAgent:navigator.userAgent})'),
    null,
    2,
  ),
)
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
  await clickText(name, '[data-window][aria-label="Control Panel"]', { count: 2 })
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
const checkbox = async (label, within = 'body') => {
  const at = await app.eval(
    `(()=>{const e=[...document.querySelector(${JSON.stringify(within)}).querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)throw Error('Missing checkbox '+${JSON.stringify(label)});const b=e.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await app.click(...at)
}
const inputValue = (label) => `document.querySelector('input[aria-label=${JSON.stringify(label)}]').value`
const persisted = (path) => `JSON.parse(localStorage.getItem('win95.settings.v1'))?.${path}`
const chooseKeyboard = async (selector, name) => {
  await app.clickOn(selector)
  const index = await app.eval(
    `[...document.querySelector('[role=listbox][id]').querySelectorAll('[role=option]')].findIndex(e=>e.textContent.trim()===${JSON.stringify(name)})`,
  )
  assert.ok(index >= 0, `Font option ${name} exists`)
  await app.key('Home')
  for (let n = 0; n < index; n++) await app.key('ArrowDown')
  await app.key('Enter')
}
const checkRender = async (selector, behavior) => {
  await app.send('DOM.enable')
  await app.send('CSS.enable')
  const tree = await app.send('DOM.getDocument')
  const nodes = await app.send('DOM.querySelectorAll', {
    nodeId: tree.result.root.nodeId,
    selector: `${selector}, ${selector} *`,
  })
  const rendered = await Promise.all(
    nodes.result.nodeIds.map((nodeId) => app.send('CSS.getPlatformFontsForNode', { nodeId })),
  )
  const fonts = rendered.flatMap((result) => result.result?.fonts ?? [])
  const passed =
    fonts.length > 0 &&
    fonts.every(
      (font) => font.isCustomFont && font.familyName === 'Microsoft Sans Serif' && font.glyphCount > 0,
    )
  results.push({ finding: 10, behavior, passed, fonts })
  assert.ok(passed, behavior)
  console.log('PASS', 10, behavior, fonts.filter((font) => font.isCustomFont).slice(0, 2))
}
try {
  if (process.argv.includes('--fresh')) {
    await app.eval('localStorage.clear()')
    await reload()
  }
  if (phase === 'consumers') {
    await reload()
    await run('wordpad')
    const wordpad = '[data-window][aria-label$="WordPad"]'
    await check(
      10,
      'WordPad retains Times New Roman as its default',
      `document.querySelector(${JSON.stringify(`${wordpad} [role=combobox][aria-label="Font"]`)}).textContent.trim()`,
      'Times New Roman',
    )
    await app.clickOn(`${wordpad} [role=combobox][aria-label="Font"]`)
    await check(
      10,
      'installed family absent before installation',
      `[...document.querySelector('[role=listbox][id]').querySelectorAll('[role=option]')].some(e=>e.textContent.trim()==='Microsoft Sans Serif')`,
      false,
    )
    await check(
      10,
      'legacy and symbol font choices retained',
      `['Times New Roman','Arial','Wingdings','Symbol'].every(name=>[...document.querySelector('[role=listbox][id]').querySelectorAll('[role=option]')].some(e=>e.textContent.trim()===name))`,
      true,
    )
    await app.key('Escape')
    await run('charmap')
    await openPanel('Fonts')
    await app.key('f', ['Alt'])
    await clickText('Install New Font...')
    await clickText('MICROSS.TTF', dialog('Add Fonts'))
    await clickText('OK', dialog('Add Fonts'))
    await app.waitFor(`!document.querySelector(${JSON.stringify(dialog('Add Fonts'))})`)
    await app.clickOn('[data-window][aria-label="Fonts"] [aria-label="Close"]')
    await clickText('Document - WordPad', '[data-taskbar]')
    await chooseKeyboard(`${wordpad} [role=combobox][aria-label="Font"]`, 'Microsoft Sans Serif')
    await app.clickOn('[contenteditable=true]')
    await app.type('Installed font semantic roundtrip 123.')
    await app.key('a', ['Control'])
    await chooseKeyboard(`${wordpad} [role=combobox][aria-label="Font"]`, 'Microsoft Sans Serif')
    await check(
      10,
      'already-open WordPad accepts newly installed font',
      `document.querySelector(${JSON.stringify(`${wordpad} [role=combobox][aria-label="Font"]`)}).textContent.trim()`,
      'Microsoft Sans Serif',
    )
    await check(
      10,
      'WordPad DOM retains semantic installed font family',
      `[...document.querySelector('[contenteditable=true]').querySelectorAll('*')].some(e=>getComputedStyle(e).fontFamily.includes('Microsoft Sans Serif'))`,
      true,
    )
    await check(
      10,
      'selected semantic family is a loaded installed face',
      `[...document.fonts].some(f=>f.family==='Microsoft Sans Serif'&&f.status==='loaded')`,
      true,
    )
    await shot('wordpad-installed')
    await checkRender('[contenteditable=true]', 'WordPad renders glyphs from the installed custom face')
    await app.key('s', ['Control'])
    await fill('input[id$="-name"]', 'installed-font.rtf')
    await clickText('Save', dialog('Save As'))
    await sleep(300)
    await check(
      10,
      'saved RTF records semantic family and text',
      `(()=>{const n=Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).find(n=>n.kind==='file'&&n.name==='installed-font.rtf');return !!n&&n.content.includes('Microsoft Sans Serif')&&n.content.includes('Installed font semantic roundtrip 123.')&&!n.content.includes('Win95Font-')})()`,
      true,
    )
    await clickText('Character Map', '[data-taskbar]')
    const charmap = '[data-window][aria-label="Character Map"]'
    await chooseKeyboard(`${charmap} [role=combobox][aria-label="Font"]`, 'Microsoft Sans Serif')
    await check(
      10,
      'already-open Character Map accepts installed font',
      `document.querySelector(${JSON.stringify(`${charmap} [role=combobox][aria-label="Font"]`)}).textContent.trim()`,
      'Microsoft Sans Serif',
    )
    await check(
      10,
      'Character Map grid uses installed family',
      `[...document.querySelector(${JSON.stringify(charmap)}).querySelectorAll('[style]')].some(e=>getComputedStyle(e).fontFamily.includes('Microsoft Sans Serif'))`,
      true,
    )
    await shot('charmap-installed')
    await checkRender(
      '[data-window][aria-label="Character Map"] fieldset',
      'Character Map renders glyphs from the installed custom face',
    )
    await chooseKeyboard(`${charmap} [role=combobox][aria-label="Font"]`, 'Symbol')
    await app.key('s', ['Alt'])
    await check(
      10,
      'symbol-font character handling survives integration',
      `document.querySelector(${JSON.stringify(charmap)}).querySelector('input').value.charCodeAt(0)`,
      0xf041,
    )
    await reload()
    await run('"C:\\My Documents\\installed-font.rtf"')
    await check(
      10,
      'reopened WordPad text survives full reload',
      `document.querySelector('[contenteditable=true]').textContent`,
      'Installed font semantic roundtrip 123.',
    )
    await app.clickOn('[contenteditable=true]')
    await app.key('a', ['Control'])
    await check(
      10,
      'reopened WordPad keeps semantic family',
      `[...document.querySelector('[contenteditable=true]').querySelectorAll('*')].some(e=>getComputedStyle(e).fontFamily.includes('Microsoft Sans Serif'))`,
      true,
    )
    await check(
      10,
      'reopened document font is loaded from persistent catalog',
      `[...document.fonts].some(f=>f.family==='Microsoft Sans Serif'&&f.status==='loaded')`,
      true,
    )
    await shot('reopened-semantic-font')
    await checkRender('[contenteditable=true]', 'reopened WordPad renders the persisted custom face')
    await app.key('o', ['Alt'])
    await clickText('Font...', '[role=menu]')
    await check(
      10,
      'WordPad Font dialog also lists installed family',
      `[...document.querySelector('[aria-label="Font list"]').querySelectorAll('[role=option]')].some(e=>e.textContent.trim()==='Microsoft Sans Serif')`,
      true,
    )
    await shot('font-dialog-installed')
  }
  if (phase === 'font-virtual') {
    await reload()
    const data = `data:font/ttf;base64,${readFileSync(new URL('../../src/renderer/src/assets/fonts/micross.ttf', import.meta.url)).toString('base64')}`
    await run('notepad')
    await app.type(data)
    await app.key('s', ['Control'])
    await fill('input[id$="-name"]', 'virtual.ttf')
    await clickText('Save', dialog('Save As'))
    await sleep(300)
    const source = await app.eval(
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).find(n=>n.kind==='file'&&n.name==='virtual.ttf').id`,
    )
    await check(
      10,
      'font bytes saved as a real virtual font file',
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).find(n=>n.id===${JSON.stringify(source)}).content.length`,
      data.length,
    )
    await reload()
    await openPanel('Fonts')
    await app.key('f', ['Alt'])
    await clickText('Install New Font...')
    await clickText('..', '[aria-label="Font folders"]')
    await clickText('My Documents', '[aria-label="Font folders"]')
    await clickText('virtual.ttf', dialog('Add Fonts'))
    await shot('virtual-source-file')
    await clickText('OK', dialog('Add Fonts'))
    await app.waitFor(`!document.querySelector(${JSON.stringify(dialog('Add Fonts'))})`)
    await check(
      10,
      'actual virtual font installs its parsed family and bytes',
      `JSON.parse(localStorage.getItem('win95.fonts.v1')).map(f=>({name:f.name,file:f.file,bytes:f.byteLength,source:f.source.kind}))`,
      [{ name: 'Microsoft Sans Serif', file: 'virtual.ttf', bytes: 652664, source: 'copy' }],
    )
    await reload()
    await app.clickOn('[data-desktop-item="app:mycomputer"]', { count: 2 })
    await app.clickOn('[data-node-id="c"]', { count: 2 })
    await app.clickOn('[data-node-id="documents"]', { count: 2 })
    await app.clickOn(`[data-node-id="${source}"]`)
    await app.key('Delete')
    await clickText('Yes')
    await reload()
    await openPanel('Fonts')
    await app.waitFor(`document.querySelector('[data-window]').textContent.includes('Microsoft Sans Serif')`)
    await check(
      10,
      'copied font remains loaded after original source is recycled',
      `[...document.fonts].some(f=>f.family==='Microsoft Sans Serif'&&f.status==='loaded')`,
      true,
    )
    await shot('copied-font-source-removed')
  }
  if (phase === 'font-negative') {
    await reload()
    await run('notepad')
    await app.type('This file is not a font.')
    await app.key('s', ['Control'])
    await fill('input[id$="-name"]', 'bad.ttf')
    await clickText('Save', dialog('Save As'))
    await sleep(300)
    await check(
      10,
      'invalid font fixture is an actual persisted virtual file',
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).some(n=>n.kind==='file'&&n.name==='bad.ttf'&&n.content==='This file is not a font.')`,
      true,
    )
    await reload()
    await openPanel('Fonts')
    await app.key('f', ['Alt'])
    await clickText('Install New Font...')
    await clickText('..', '[aria-label="Font folders"]')
    await clickText('My Documents', '[aria-label="Font folders"]')
    await clickText('bad.ttf', dialog('Add Fonts'))
    await clickText('OK', dialog('Add Fonts'))
    await check(
      10,
      'renamed text is rejected through installation UI',
      `[...document.querySelectorAll(${JSON.stringify(dialog('Add Fonts'))})].some(e=>e.textContent.includes('does not contain supported'))`,
      true,
    )
    await check(
      10,
      'invalid font creates no installed catalog entry',
      `JSON.parse(localStorage.getItem('win95.fonts.v1')??'[]').length`,
      0,
    )
    await shot('invalid-font-rejected')
    await app.key('Escape')
    await clickText('Cancel', dialog('Add Fonts'))
    await check(
      10,
      'Cancel leaves the font catalog unchanged',
      `JSON.parse(localStorage.getItem('win95.fonts.v1')??'[]').length`,
      0,
    )
  }
  if (phase === 'font-linked') {
    await reload()
    await openPanel('Fonts')
    await app.key('f', ['Alt'])
    await clickText('Install New Font...')
    await clickText('MICROSS.TTF', dialog('Add Fonts'))
    await checkbox('Copy fonts to Fonts folder', dialog('Add Fonts'))
    await clickText('OK', dialog('Add Fonts'))
    await app.waitFor(`!document.querySelector(${JSON.stringify(dialog('Add Fonts'))})`)
    await check(
      10,
      'unchecked copy keeps an available media reference',
      `JSON.parse(localStorage.getItem('win95.fonts.v1')).map(f=>({name:f.name,source:f.source}))`,
      [{ name: 'Microsoft Sans Serif', source: { kind: 'bundled', id: 'micross' } }],
    )
    await reload()
    await openPanel('Fonts')
    await app.waitFor(`document.querySelector('[data-window]').textContent.includes('Microsoft Sans Serif')`)
    await check(
      10,
      'media reference loads the actual font after reload',
      `[...document.fonts].some(f=>f.family==='Microsoft Sans Serif'&&f.status==='loaded')`,
      true,
    )
    await shot('linked-font-reload')
  }
  if (phase === 'printer-shortcut') {
    const baseline = process.argv.includes('--baseline')
    await reload()
    await openPanel('Date/Time')
    await fill('input[aria-label="Year"]', '1995')
    await clickText('OK', dialog('Date/Time Properties'))
    await reload()
    await run('printers')
    await clickText('Add Printer', '[data-window]')
    await app.key('f', ['Alt'])
    await clickText('Create Shortcut', '[role=menu]')
    await clickText('Yes', dialog('Shortcut'))
    await sleep(300)
    await check(
      9,
      'Add Printer shortcut records virtual creation year',
      `new Date(Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).find(n=>n.app==='shell:printers:add-printer').created).getUTCFullYear()`,
      baseline || process.argv.includes('--before-clock') ? new Date().getUTCFullYear() : 1995,
    )
    await reload()
    const printer = await app.eval(
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).find(n=>n.app==='shell:printers:add-printer').id`,
    )
    await app.clickOn(`[data-desktop-item="${printer}"]`, { count: 2 })
    await check(
      9,
      'Add Printer desktop shortcut opens its wizard',
      `!!document.querySelector(${JSON.stringify(dialog('Add Printer Wizard'))})`,
      !baseline,
    )
    await shot(baseline ? 'before-folder-only' : 'wizard-after-reload')
  }
  if (phase === 'exit') await app.eval('setTimeout(() => window.win95.shutdown(), 100)')
  if (phase === 'shortcuts') {
    await reload()
    await run('control')
    await clickText('Display', '[data-window]')
    await app.key('f', ['Alt'])
    await app.key('s')
    await shot('display-confirmation')
    await clickText('No', dialog('Shortcut'))
    await sleep(300)
    await check(
      9,
      'No declines desktop shortcut creation',
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).filter(n=>n.app==='shell:controlpanel:display').length`,
      0,
    )
    await app.key('f', ['Alt'])
    await app.key('s')
    await clickText('Yes', dialog('Shortcut'))
    await sleep(300)
    await check(
      9,
      'File menu creates persisted applet shortcut',
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).filter(n=>n.app==='shell:controlpanel:display').map(n=>({kind:n.kind,name:n.name,parent:n.parent}))`,
      [{ kind: 'shortcut', name: 'Shortcut to Display', parent: 'desktop' }],
    )
    await reload()
    const display = await app.eval(
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).find(n=>n.app==='shell:controlpanel:display').id`,
    )
    await app.clickOn(`[data-desktop-item="${display}"]`, { count: 2 })
    await check(
      9,
      'desktop applet shortcut launches Display Properties',
      `!!document.querySelector(${JSON.stringify(dialog('Display Properties'))})`,
      true,
    )
    await shot('desktop-display-launch')
    await clickText('Cancel', dialog('Display Properties'))
    await app.clickOn('[data-window] [aria-label="Close"]')
    await app.clickOn(`[data-desktop-item="${display}"]`)
    await app.key('Enter', ['Alt'])
    await clickText('Shortcut', dialog('Shortcut to Display Properties'))
    await check(
      9,
      'special shortcut Properties exposes its named target',
      `document.querySelector('input[aria-label="Target"]').value`,
      'Control Panel\\Display',
    )
    await clickText('OK', dialog('Shortcut to Display Properties'))
    await reload()
    await app.clickOn('[data-desktop-item="app:network"]', { count: 2 })
    await clickText('Entire Network', '[data-window]')
    await app.key('F10', ['Shift'])
    await clickText('Create Shortcut', '[role=menu]')
    await clickText('Yes', dialog('Shortcut'))
    await sleep(300)
    await check(
      9,
      'keyboard context menu creates Entire Network shortcut',
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).filter(n=>n.app==='shell:network:entire-network').map(n=>n.name)`,
      ['Shortcut to Entire Network'],
    )
    await reload()
    const entire = await app.eval(
      `Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).find(n=>n.app==='shell:network:entire-network').id`,
    )
    await app.clickOn(`[data-desktop-item="${entire}"]`)
    await app.key('Enter')
    await check(
      9,
      'Entire Network desktop shortcut reaches truthful browse error',
      `document.querySelector(${JSON.stringify(dialog('Network Neighborhood'))}).textContent.includes('Unable to browse the network')`,
      true,
    )
    await shot('entire-network-launch')
    await clickText('OK', dialog('Network Neighborhood'))
    await app.key('f', ['Alt'])
    await clickText('Find Computer...', '[role=menu]')
    await check(
      9,
      'Network folder Find Computer routes to final shell app',
      `!!document.querySelector('[data-window][aria-label="Find: Computer"]')`,
      true,
    )
    await shot('find-computer')
  }
  if (phase === 'accessibility') {
    await reload()
    await openPanel('Accessibility Options')
    const parent = dialog('Accessibility Properties')
    for (const [name, tab] of [
      ['StickyKeys', 'Keyboard'],
      ['FilterKeys', 'Keyboard'],
      ['ToggleKeys', 'Keyboard'],
      ['SoundSentry', 'Sound'],
      ['High Contrast', 'Display'],
      ['MouseKeys', 'Mouse'],
      ['SerialKeys', 'General'],
    ]) {
      await clickText(tab, parent)
      await app.clickOn(`[aria-label=${JSON.stringify(`${name} Settings`)}]`)
      const nested = dialog(`Settings for ${name}`)
      if (name === 'SoundSentry') await choose('Warning for windowed programs', 'Flash desktop')
      else if (name === 'SerialKeys') {
        await choose('Serial port', 'COM3')
        await choose('Baud rate', '9600')
      } else await checkbox(`Use shortcut for ${name}`, nested)
      await shot(`feature-${name.replaceAll(' ', '-')}`)
      await clickText('OK', nested)
      await app.clickOn(`[aria-label=${JSON.stringify(`${name} Settings`)}]`)
      if (name === 'SoundSentry')
        await check(
          5,
          'SoundSentry nested OK retained',
          `document.querySelector('[aria-label="Warning for windowed programs"]').textContent.trim()`,
          'Flash desktop',
        )
      else if (name === 'SerialKeys')
        await check(
          5,
          'SerialKeys nested OK retained',
          `document.querySelector('[aria-label="Serial port"]').textContent.trim()`,
          'COM3',
        )
      else
        await check(
          5,
          `${name} nested OK retained before parent Apply`,
          `document.querySelector(${JSON.stringify(nested)}).querySelector('input').checked`,
          false,
        )
      if (name === 'StickyKeys') {
        await checkbox('Use shortcut for StickyKeys', nested)
        await clickText('Cancel', nested)
        await app.clickOn('[aria-label="StickyKeys Settings"]')
        await check(
          5,
          'nested Cancel discarded the later edit',
          `document.querySelector(${JSON.stringify(nested)}).querySelector('input').checked`,
          false,
        )
      }
      await clickText('Cancel', nested)
    }
    await clickText('Cancel', parent)
    await clickText('Accessibility Options', '[data-window]', { count: 2 })
    await app.clickOn('[aria-label="StickyKeys Settings"]')
    await check(
      5,
      'parent Cancel discards nested OK draft',
      `document.querySelector(${JSON.stringify(dialog('Settings for StickyKeys'))}).querySelector('input').checked`,
      true,
    )
    await checkbox('Use shortcut for StickyKeys', dialog('Settings for StickyKeys'))
    await clickText('OK', dialog('Settings for StickyKeys'))
    await clickText('Apply', parent)
    await check(
      5,
      'parent Apply persists nested settings',
      persisted('accessibility.features.StickyKeys.shortcut'),
      false,
    )
    await app.clickOn('[aria-label="StickyKeys Settings"]')
    await check(
      5,
      'nested reopen after parent Apply',
      `document.querySelector(${JSON.stringify(dialog('Settings for StickyKeys'))}).querySelector('input').checked`,
      false,
    )
    await clickText('Cancel', dialog('Settings for StickyKeys'))
    await clickText('General', parent)
    await app.clickOn('[aria-label="SerialKeys Settings"]')
    await choose('Serial port', 'COM4')
    await clickText('OK', dialog('Settings for SerialKeys'))
    await clickText('OK', parent)
    await check(
      5,
      'parent OK commits another feature',
      persisted('accessibility.features.SerialKeys.port'),
      'COM4',
    )
    await reload()
    await openPanel('Accessibility Options')
    await app.clickOn('[aria-label="StickyKeys Settings"]')
    await check(
      5,
      'nested settings survive full reload',
      `document.querySelector(${JSON.stringify(dialog('Settings for StickyKeys'))}).querySelector('input').checked`,
      false,
    )
    await shot('reload-sticky')
  }
  if (phase === 'regional') {
    await reload()
    await openPanel('Regional Settings')
    const parent = dialog('Regional Settings Properties')
    await clickText('Number', parent)
    await fill('input[aria-label="Decimal symbol"]', ',')
    await fill('input[aria-label="Digit grouping symbol"]', '.')
    await fill('input[aria-label="Negative sign symbol"]', '~')
    await fill('input[aria-label="List separator"]', ';')
    await choose('No. of digits after decimal', '3')
    await choose('No. of digits in group', '12,34,56,789')
    await choose('Negative number format', '1.1-')
    await choose('Display leading zeroes', '.7')
    await choose('Measurement system', 'Metric')
    await check(
      8,
      'number preview follows grouping symbols precision and negative format',
      `document.querySelector('[data-number-sample=negative]').textContent`,
      'Negative: 12.34.56.789,000~',
    )
    await check(
      8,
      'leading zero preview updates',
      `document.querySelector('[data-number-sample=fraction]').textContent`,
      'Fraction: ,700',
    )
    await shot('draft-preview')
    await clickText('Apply', parent)
    const expected = {
      decimalSymbol: ',',
      digits: 3,
      groupSymbol: '.',
      grouping: '3;2',
      negativeSign: '~',
      negativeFormat: 'n-',
      leadingZero: false,
      measurement: 'Metric',
      listSeparator: ';',
    }
    await check(8, 'Apply stores every number field', persisted('regional.number'), expected)
    await choose('Measurement system', 'U.S.')
    await fill('input[aria-label="Decimal symbol"]', '!')
    await clickText('Cancel', parent)
    await clickText('Regional Settings', '[data-window]', { count: 2 })
    await clickText('Number', parent)
    await check(8, 'Cancel after Apply keeps applied values', persisted('regional.number'), expected)
    await check(8, 'reopen shows saved decimal symbol', inputValue('Decimal symbol'), ',')
    await fill('input[aria-label="List separator"]', '|')
    await clickText('OK', parent)
    await reload()
    await openPanel('Regional Settings')
    await clickText('Number', parent)
    await check(8, 'OK and reload retain all number settings', persisted('regional.number'), {
      ...expected,
      listSeparator: '|',
    })
    await check(
      8,
      'Metric survives reopen after reload',
      `document.querySelector('[aria-label="Measurement system"]').textContent.trim()`,
      'Metric',
    )
    await shot('reload')
  }
  if (phase === 'tcpip') {
    await reload()
    await openPanel('Network')
    const parent = dialog('Network')
    const nested = dialog('TCP/IP Properties')
    await clickText('TCP/IP', parent)
    await clickText('Properties', parent)
    await check(
      7,
      'TCP/IP has six configuration pages',
      `[...document.querySelector(${JSON.stringify(nested)}).querySelectorAll('[role=tab]')].map(e=>e.textContent.trim())`,
      ['IP Address', 'WINS Configuration', 'Gateway', 'DNS Configuration', 'Bindings', 'Advanced'],
    )
    await checkbox('Specify an IP address', nested)
    await fill('input[aria-label="IP address"]', '192.168.95.2')
    await fill('input[aria-label="Subnet mask"]', '255.255.255.0')
    await shot('ip-address')
    await clickText('WINS Configuration', nested)
    await checkbox('Enable WINS Resolution', nested)
    await fill('input[aria-label="Primary WINS server"]', '192.168.95.3')
    await fill('input[aria-label="Secondary WINS server"]', '192.168.95.4')
    await shot('wins')
    await clickText('Gateway', nested)
    await fill('input[aria-label="New Installed gateways"]', '999.1.1.1')
    await clickText('Add', nested)
    await check(
      7,
      'invalid gateway shows validation error',
      `!!document.querySelector(${JSON.stringify(dialog('TCP/IP'))})`,
      true,
    )
    await clickText('OK', dialog('TCP/IP'))
    await fill('input[aria-label="New Installed gateways"]', '192.168.95.1')
    await clickText('Add', nested)
    await shot('gateway')
    await clickText('DNS Configuration', nested)
    await checkbox('Enable DNS', nested)
    await fill('input[aria-label="DNS host"]', 'win95')
    await fill('input[aria-label="DNS domain"]', 'example.test')
    await fill('input[aria-label="New DNS Server Search Order"]', '192.168.95.5')
    await clickText('Add', `${nested} fieldset:nth-of-type(1)`)
    await fill('input[aria-label="New Domain Suffix Search Order"]', 'example.test')
    await clickText('Add', `${nested} fieldset:nth-of-type(2)`)
    await shot('dns')
    await clickText('Bindings', nested)
    await checkbox('Client for Microsoft Networks', nested)
    await shot('bindings')
    await clickText('Advanced', nested)
    await choose('Advanced property value', 'No')
    await shot('advanced')
    await clickText('OK', nested)
    await clickText('Properties', parent)
    await check(7, 'nested OK retains address before parent Apply', inputValue('IP address'), '192.168.95.2')
    await fill('input[aria-label="IP address"]', '10.0.0.1')
    await clickText('Cancel', nested)
    await clickText('Properties', parent)
    await check(7, 'nested Cancel discards changed address', inputValue('IP address'), '192.168.95.2')
    await clickText('Cancel', nested)
    await clickText('Apply', parent)
    await check(7, 'Apply stores virtual network configuration', persisted('network.tcpip'), {
      addressMode: 'manual',
      address: '192.168.95.2',
      subnet: '255.255.255.0',
      winsMode: 'manual',
      winsPrimary: '192.168.95.3',
      winsSecondary: '192.168.95.4',
      dhcpWins: true,
      gateways: ['192.168.95.1'],
      dnsEnabled: true,
      host: 'win95',
      domain: 'example.test',
      dnsServers: ['192.168.95.5'],
      domainSuffixes: ['example.test'],
      clientBinding: false,
      defaultProtocol: true,
      allowBindingToAtm: false,
      forwardBroadcasts: false,
      enableLmhosts: false,
    })
    await clickText('Properties', parent)
    await fill('input[aria-label="IP address"]', '10.0.0.2')
    await clickText('OK', nested)
    await clickText('Cancel', parent)
    await reload()
    await openPanel('Network')
    await clickText('TCP/IP', parent)
    await clickText('Properties', parent)
    await check(
      7,
      'parent Cancel and full reload retain applied IP',
      inputValue('IP address'),
      '192.168.95.2',
    )
    await shot('reload')
    await clickText('Cancel', nested)
    await clickText('Dial-Up Adapter', parent)
    await clickText('Properties', parent)
    await check(
      7,
      'adapter retains component-specific properties',
      `!!document.querySelector(${JSON.stringify(dialog('Dial-Up Adapter Properties'))})`,
      true,
    )
    await shot('adapter')
  }
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
      `[...document.fonts].some(f=>f.family==='Microsoft Sans Serif'&&f.status==='loaded')`,
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
