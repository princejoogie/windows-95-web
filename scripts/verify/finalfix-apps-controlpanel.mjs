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
const checkbox = async (label, within = 'body') => {
  const at = await app.eval(
    `(()=>{const e=[...document.querySelector(${JSON.stringify(within)}).querySelectorAll('label')].find(e=>e.textContent.trim()===${JSON.stringify(label)});if(!e)throw Error('Missing checkbox '+${JSON.stringify(label)});const b=e.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await app.click(...at)
}
const inputValue = (label) => `document.querySelector('input[aria-label=${JSON.stringify(label)}]').value`
const persisted = (path) => `JSON.parse(localStorage.getItem('win95.settings.v1'))?.${path}`
try {
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
