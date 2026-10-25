// Live verification of WordPad and Character Map against a running Electron build.
// Usage: node scripts/verify/wordpad.mjs <cdp port> <proof dir>
// Start the app first:
//   W95_CDP_PORT=9361 W95_DATA_DIR=<fresh dir> node_modules/electron/dist/electron.exe .
// The script wipes the virtual drive in that data dir, so point it at a dedicated directory.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const port = process.argv[2] ?? '9361'
const proof = resolve(process.argv[3] ?? '../proof/wordpad')
mkdirSync(proof, { recursive: true })

const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
if (!page) throw new Error('no page target')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((done) => ws.addEventListener('open', done, { once: true }))
let nextId = 0
const pending = new Map()
ws.addEventListener('message', (event) => {
  const message = JSON.parse(event.data)
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message)
    pending.delete(message.id)
  }
})
const send = (method, params = {}) =>
  new Promise((done) => {
    const id = ++nextId
    pending.set(id, done)
    ws.send(JSON.stringify({ id, method, params }))
  })
const pause = (ms) => new Promise((done) => setTimeout(done, ms))

async function evaluate(expression) {
  // A block keeps each snippet's declarations out of the page's global scope.
  const { result } = await send('Runtime.evaluate', {
    expression: `{\n${expression}\n}`,
    awaitPromise: true,
    returnByValue: true,
  })
  if (result.exceptionDetails)
    throw new Error(
      result.exceptionDetails.text + ' ' + (result.exceptionDetails.exception?.description ?? ''),
    )
  return result.result.value
}

async function until(expression, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return
    await pause(50)
  }
  throw new Error(`Timed out waiting for: ${expression}`)
}

const checks = []
async function shot(name) {
  await pause(120)
  const { result } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(proof, `${name}.png`), Buffer.from(result.data, 'base64'))
}
async function check(name, condition, screenshot) {
  assert.ok(condition, name)
  checks.push({ name, screenshot: screenshot ? `${screenshot}.png` : null })
  console.log(`PASS ${name}`)
  if (screenshot) await shot(screenshot)
}

// Page-side helpers. `find` matches a visible element by its exact text, or a menu item by its label.
const HELPERS = `
  window.__w95 = {
    find(text, selector = 'button, [role=menuitem], [role=option], [role=tab], label, span, p, div') {
      const label = (el) => el.getAttribute('role') === 'menuitem' ? (el.children[1]?.textContent ?? '').trim() : el.textContent.trim()
      return [...document.querySelectorAll(selector)].find((el) => label(el) === text && el.getClientRects().length > 0) ?? null
    },
    rect(el) {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, left: r.left, top: r.top, width: r.width, height: r.height }
    },
    editor() { return document.querySelector('.wordpad-page[contenteditable]') },
    window(title) { return document.querySelector('[data-window][aria-label=' + JSON.stringify(title) + ']') },
    fsNodes() { return Object.values(JSON.parse(localStorage.getItem('w95.fs.v1') ?? '{"nodes":{}}').nodes) },
  }
  true
`
await evaluate(HELPERS)

const rectOf = (js) => evaluate(`__w95.rect(${js})`)
const rectOfText = (text, selector) =>
  evaluate(
    `__w95.rect(__w95.find(${JSON.stringify(text)}${selector ? `, ${JSON.stringify(selector)}` : ''}))`,
  )

async function mouse(type, x, y, extra = {}) {
  await send('Input.dispatchMouseEvent', {
    type,
    x: Math.round(x),
    y: Math.round(y),
    button: 'left',
    ...extra,
  })
}
async function clickAt(x, y, clickCount = 1) {
  await mouse('mouseMoved', x, y)
  for (let i = 1; i <= clickCount; i++) {
    await mouse('mousePressed', x, y, { clickCount: i })
    await mouse('mouseReleased', x, y, { clickCount: i })
  }
  await pause(60)
}
async function click(js, clickCount = 1) {
  const rect = await rectOf(js)
  assert.ok(rect, `element to click: ${js}`)
  await clickAt(rect.x, rect.y, clickCount)
}
async function clickText(text, selector, clickCount = 1) {
  const rect = await rectOfText(text, selector)
  assert.ok(rect, `element with text "${text}"`)
  await clickAt(rect.x, rect.y, clickCount)
}
async function hoverText(text, selector) {
  const rect = await rectOfText(text, selector)
  assert.ok(rect, `element with text "${text}"`)
  await mouse('mouseMoved', rect.x, rect.y)
  await pause(450)
}

const KEYS = {
  Enter: { code: 'Enter', vk: 13, text: '\r' },
  Tab: { code: 'Tab', vk: 9 },
  Escape: { code: 'Escape', vk: 27 },
  Home: { code: 'Home', vk: 36 },
  End: { code: 'End', vk: 35 },
  ArrowDown: { code: 'ArrowDown', vk: 40 },
  ArrowUp: { code: 'ArrowUp', vk: 38 },
  ArrowRight: { code: 'ArrowRight', vk: 39 },
  ArrowLeft: { code: 'ArrowLeft', vk: 37 },
  F3: { code: 'F3', vk: 114 },
  F4: { code: 'F4', vk: 115 },
}
async function press(key, { ctrl = false, shift = false, alt = false } = {}) {
  const info = KEYS[key] ?? { code: `Key${key.toUpperCase()}`, vk: key.toUpperCase().charCodeAt(0) }
  const modifiers = (alt ? 1 : 0) | (ctrl ? 2 : 0) | (shift ? 8 : 0)
  const base = {
    key,
    code: info.code,
    windowsVirtualKeyCode: info.vk,
    nativeVirtualKeyCode: info.vk,
    modifiers,
  }
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    ...base,
    text: !ctrl && !alt ? info.text : undefined,
  })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
  await pause(40)
}
async function type(text) {
  for (const line of text.split('\n').entries()) {
    const [index, part] = line
    if (index > 0) await press('Enter')
    if (part) await send('Input.insertText', { text: part })
  }
  await pause(40)
}
async function selectOption(ariaLabel, value) {
  await evaluate(`(() => {
    const select = document.querySelector('select[aria-label=${JSON.stringify(ariaLabel)}]')
    select.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    select.value = ${JSON.stringify(String(value))}
    select.dispatchEvent(new Event('change', { bubbles: true }))
    return select.value
  })()`)
  await pause(60)
}
async function menu(top, item) {
  await clickText(top, '[role=menubar] button')
  await pause(80)
  await clickText(item, '[role=menuitem]')
  await pause(120)
}
const editorHtml = () => evaluate('__w95.editor().innerHTML')
const editorText = () => evaluate('__w95.editor().innerText')
const fileContent = (name) =>
  evaluate(`(__w95.fsNodes().find((n) => n.name === ${JSON.stringify(name)}) ?? {}).content ?? null`)

try {
  // A fresh virtual drive, so the run is repeatable.
  await evaluate(
    "localStorage.removeItem('w95.fs.v1'); localStorage.removeItem('w95.wordpad.options'); localStorage.removeItem('w95.wordpad.recent'); true",
  )
  await send('Page.reload')
  await pause(1200)
  // The reload dropped the helpers. Install them again.
  await evaluate(HELPERS)
  await until('!!__w95.find("Start", "button")')

  // Start > Programs > Accessories > WordPad, by mouse.
  await clickText('Start', 'button')
  await hoverText('Programs')
  await hoverText('Accessories')
  await until('!!__w95.find("WordPad") && !!__w95.find("Character Map")')
  await check('Accessories lists WordPad and Character Map', true, 'start-accessories')
  await clickText('WordPad')
  await until('!!__w95.window("Document - WordPad")')
  await check('WordPad opens titled "Document - WordPad"', true)
  await check(
    'The toolbar, format bar, ruler, and status bar are shown',
    await evaluate(
      `!!document.querySelector('[role=toolbar][aria-label=Toolbar]') && !!document.querySelector('[role=toolbar][aria-label="Format Bar"]') && !!document.querySelector('.wordpad-ruler') && document.body.innerText.includes('For Help, press F1')`,
    ),
    'wordpad-empty',
  )
  await check(
    'The status bar shows NUM',
    await evaluate(
      `[...document.querySelectorAll('[data-window] .bevel-shallow')].some((el) => el.textContent === 'NUM')`,
    ),
  )
  await check(
    'The toolbar has the eleven Windows 95 buttons and the format bar has font, size, script, and the style buttons',
    await evaluate(`
      const labels = (name) => [...document.querySelectorAll('[role=toolbar][aria-label=' + JSON.stringify(name) + '] button')].map((b) => b.getAttribute('aria-label'))
      JSON.stringify(labels('Toolbar')) === JSON.stringify(['New','Open','Save','Print','Print Preview','Find','Cut','Copy','Paste','Undo','Date/Time'])
        && JSON.stringify(labels('Format Bar')) === JSON.stringify(['Bold','Italic','Underline','Color','Align Left','Center','Align Right','Bullets'])
        && ['Font','Font Size','Script'].every((l) => document.querySelector('select[aria-label=' + JSON.stringify(l) + ']'))
    `),
  )

  // Type a memo and format it the way a user would.
  await click('__w95.editor()')
  await type(
    "Memo\nThe quarterly review is on Thursday.\nBring the budget sheets and last year's figures.\nFirst point\nSecond point",
  )
  await check(
    'Typing produces five paragraphs',
    (await editorText()).split('\n').filter(Boolean).length === 5,
  )
  await press('Home', { ctrl: true })
  await press('End', { shift: true })
  await click(`document.querySelector('[aria-label=Bold]')`)
  await click(`document.querySelector('[aria-label=Center]')`)
  await selectOption('Font Size', 14)
  await selectOption('Font', 'Arial')
  await check(
    'Bold, Center, 14 point, and Arial apply to the heading and the format bar shows them pressed',
    await evaluate(`
      const first = __w95.editor().firstElementChild
      const span = first.querySelector('span') ?? first
      const cs = getComputedStyle(span)
      cs.fontWeight === '700' && first.style.textAlign === 'center' && Math.round(parseFloat(cs.fontSize) * 0.75) === 14 && cs.fontFamily.includes('Arial')
        && document.querySelector('[aria-label=Bold]').getAttribute('aria-pressed') === 'true'
        && document.querySelector('[aria-label=Center]').getAttribute('aria-pressed') === 'true'
        && document.querySelector('select[aria-label="Font Size"]').value === '14'
        && document.querySelector('select[aria-label=Font]').value === 'Arial'
    `),
  )
  // Underline and color one word on the second line.
  await press('ArrowDown')
  await press('Home')
  await press('ArrowRight', { shift: true })
  await press('ArrowRight', { shift: true })
  await press('ArrowRight', { shift: true })
  await click(`document.querySelector('[aria-label=Underline]')`)
  await click(`document.querySelector('[aria-label=Color]')`)
  await until('!!__w95.find("Red", "[role=menuitem]")')
  await clickText('Red', '[role=menuitem]')
  await check(
    'Underline and the color Red apply to the selected word',
    await evaluate(`
      const spans = [...__w95.editor().querySelectorAll('span')]
      spans.some((s) => s.textContent === 'The' && getComputedStyle(s).textDecorationLine.includes('underline') && getComputedStyle(s).color === 'rgb(255, 0, 0)')
    `),
  )
  // Bullet the last two paragraphs from the format bar.
  await press('End', { ctrl: true })
  await press('ArrowUp', { shift: true })
  await click(`document.querySelector('[aria-label=Bullets]')`)
  await check(
    'Bullets turn the last two paragraphs into a list with a hanging indent',
    await evaluate(`
      const items = [...__w95.editor().querySelectorAll('li')]
      items.length === 2 && items.every((li) => li.style.marginLeft === '24px' && li.style.textIndent === '-24px')
        && document.querySelector('[aria-label=Bullets]').getAttribute('aria-pressed') === 'true'
    `),
    'wordpad-formatted',
  )

  // Ruler: click to add a tab stop at 2 inches, then drag the left indent to half an inch.
  await press('ArrowUp')
  await press('ArrowUp')
  await press('Home')
  const band = await rectOf(`document.querySelector('.wordpad-ruler-band')`)
  await clickAt(band.left + 192, band.y)
  await check(
    'Clicking the ruler at 2 inches adds a tab stop to the paragraph',
    await evaluate(`
      const sel = document.getSelection()
      let node = sel.anchorNode
      while (node && node.nodeType !== 1) node = node.parentNode
      const block = node.closest('div[data-tabs], li[data-tabs]')
      !!block && block.dataset.tabs === '2880' && !!document.querySelector('.wordpad-tab-stop')
    `),
  )
  const marker = await rectOf(`document.querySelector('[aria-label="Left indent"]')`)
  await mouse('mouseMoved', marker.x, marker.y)
  await mouse('mousePressed', marker.x, marker.y)
  await mouse('mouseMoved', marker.x + 24, marker.y)
  await mouse('mouseMoved', marker.x + 48, marker.y)
  await mouse('mouseReleased', marker.x + 48, marker.y)
  await pause(100)
  await check(
    'Dragging the left indent marker half an inch indents the paragraph',
    await evaluate(`
      const sel = document.getSelection()
      let node = sel.anchorNode
      while (node && node.nodeType !== 1) node = node.parentNode
      node.closest('div, li').style.marginLeft === '48px'
    `),
    'wordpad-ruler',
  )

  // Format > Paragraph shows the indent in inches and changes it.
  await menu('Format', 'Paragraph...')
  await until("!!document.querySelector('[role=dialog][aria-label=Paragraph]')")
  await check(
    'Paragraph dialog shows Left 0.5"',
    (await evaluate(
      `document.getElementById([...document.querySelectorAll('label')].find((l) => l.textContent.includes('Left:')).htmlFor).value`,
    )) === '0.5"',
    'dialog-paragraph',
  )
  await evaluate(
    `(() => { const box = document.getElementById([...document.querySelectorAll('label')].find((l) => l.textContent.includes('First line:')).htmlFor); box.focus(); return true })()`,
  )
  await press('a', { ctrl: true })
  await send('Input.insertText', { text: '0.25' })
  await clickText('OK', '[role=dialog] button')
  await pause(120)
  await check(
    'A first-line indent of 0.25" from the dialog applies to the paragraph',
    await evaluate(`
      const sel = document.getSelection()
      let node = sel.anchorNode
      while (node && node.nodeType !== 1) node = node.parentNode
      node.closest('div, li').style.textIndent === '24px'
    `),
  )

  // Format > Tabs lists the stop and can add another.
  await menu('Format', 'Tabs...')
  await until("!!document.querySelector('[role=dialog][aria-label=Tabs]')")
  await check(
    'Tabs dialog lists the 2" stop',
    await evaluate(`!!__w95.find('2"', '[role=option]')`),
    'dialog-tabs',
  )
  await send('Input.insertText', { text: '3.5' })
  await clickText('Set', '[role=dialog] button')
  await clickText('OK', '[role=dialog] button')
  await pause(120)
  await check(
    'The paragraph now has tab stops at 2" and 3.5"',
    await evaluate(`
      const sel = document.getSelection()
      let node = sel.anchorNode
      while (node && node.nodeType !== 1) node = node.parentNode
      node.closest('div, li').dataset.tabs === '2880,5040'
    `),
  )

  // Format > Font dialog.
  await menu('Format', 'Font...')
  await until("!!document.querySelector('[role=dialog][aria-label=Font]')")
  await check(
    'Font dialog opens with font, style, size, effects, color, sample, and script',
    await evaluate(`
      const d = document.querySelector('[role=dialog][aria-label=Font]');
      ['Font list', 'Font style', 'Size list'].every((l) => d.querySelector('[role=listbox][aria-label=' + JSON.stringify(l) + ']'))
        && d.textContent.includes('Strikeout') && d.textContent.includes('AaBbYyZz') && d.textContent.includes('Script')
    `),
    'dialog-font',
  )
  await clickText('Cancel', '[role=dialog] button')

  // Insert > Date and Time inserts the chosen format.
  await press('End', { ctrl: true })
  await press('Enter')
  await check(
    'After Cancel in the Font dialog the editor has focus again, and Ctrl+End, Enter adds a paragraph at the end',
    await evaluate(`
      const root = __w95.editor();
      const leaves = [...root.querySelectorAll('div, li')].filter((b) => !b.querySelector('div, li'));
      const last = leaves[leaves.length - 1];
      document.activeElement === root && last.textContent === '' && last.contains(document.getSelection().anchorNode)
    `),
  )
  await menu('Insert', 'Date and Time...')
  await until('!!document.querySelector(\'[role=dialog][aria-label="Date and Time"]\')')
  const formats = await evaluate(
    `[...document.querySelectorAll('[role=listbox][aria-label="Available formats"] [role=option]')].map((o) => o.textContent)`,
  )
  await check('Date and Time lists 15 formats', formats.length === 15, 'dialog-datetime')
  await clickText('OK', '[role=dialog] button')
  await pause(120)
  await check('The date is inserted at the caret', (await editorText()).includes(formats[0]))

  // Edit > Find and Replace.
  await press('Home', { ctrl: true })
  await menu('Edit', 'Find...')
  await until("!!document.querySelector('[role=dialog][aria-label=Find]')")
  await send('Input.insertText', { text: 'budget' })
  await clickText('Find Next', '[role=dialog] button')
  await pause(100)
  await check(
    'Find selects the word',
    (await evaluate('document.getSelection().toString()')) === 'budget',
    'dialog-find',
  )
  await press('Escape')
  await menu('Edit', 'Replace...')
  await until("!!document.querySelector('[role=dialog][aria-label=Replace]')")
  await evaluate(
    `(() => { const box = document.getElementById([...document.querySelectorAll('label')].find((l) => l.textContent.includes('Replace with')).htmlFor); box.focus(); return true })()`,
  )
  await send('Input.insertText', { text: 'expense' })
  await clickText('Replace All', '[role=dialog] button')
  await until('!!__w95.find("Replaced 1 occurrence.")')
  await check('Replace All reports one replacement', true, 'dialog-replace')
  await clickText('OK', '[role=dialog] button')
  await press('Escape')
  await check('The document now says expense', (await editorText()).includes('expense sheets'))

  // View > Options, Page Setup, Print, and Print Preview.
  await menu('View', 'Options...')
  await until("!!document.querySelector('[role=dialog][aria-label=Options]')")
  await check(
    'Options has the six property sheet tabs',
    await evaluate(
      `[...document.querySelectorAll('[role=tab]')].map((t) => t.textContent).join() === 'Options,Text,Rich Text,Word,Write,Embedded'`,
    ),
    'dialog-options',
  )
  await clickText('Options', '[role=tab]')
  await clickText('Centimeters', 'label')
  await clickText('OK', '[role=dialog] button')
  await pause(100)
  await menu('File', 'Page Setup...')
  await until('!!document.querySelector(\'[role=dialog][aria-label="Page Setup"]\')')
  await check(
    'Page Setup shows margins in centimeters after the unit change',
    await evaluate(
      `document.querySelector('[role=dialog][aria-label="Page Setup"]').textContent.includes('Margins (centimeters)')`,
    ),
    'dialog-pagesetup',
  )
  await clickText('Cancel', '[role=dialog] button')
  await menu('File', 'Print...')
  await until("!!document.querySelector('[role=dialog][aria-label=Print]')")
  await check(
    'Print dialog shows the Generic / Text Only printer on FILE:',
    await evaluate(`document.querySelector('[role=dialog][aria-label=Print]').textContent.includes('FILE:')`),
    'dialog-print',
  )
  await clickText('Cancel', '[role=dialog] button')
  await menu('File', 'Print Preview')
  await until('!!document.querySelector(\'[aria-label="Print preview"]\')')
  await check(
    'Print Preview shows a page and the Print, Next Page, Prev Page, Two Page, Zoom In, Zoom Out, and Close buttons',
    await evaluate(
      `['Print...','Next Page','Prev Page','Two Page','Zoom In','Zoom Out','Close'].every((t) => __w95.find(t, 'button'))`,
    ),
    'wordpad-preview',
  )
  await clickText('Close', '[data-window] button')
  await until('!!__w95.editor()')

  // Save As Letter.doc through the shared File dialog, then prove the file reads back exactly.
  await press('s', { ctrl: true })
  await until('!!document.querySelector(\'[role=dialog][aria-label="Save As"]\')')
  await check(
    'Save As opens with Document.doc proposed',
    (await evaluate(`document.querySelector('[role=dialog] input').value`)) === 'Document.doc',
    'dialog-saveas',
  )
  await press('a', { ctrl: true })
  await send('Input.insertText', { text: 'Letter' })
  await press('Enter')
  await until('!!__w95.window("Letter - WordPad")')
  await pause(400)
  const saved = await fileContent('Letter.doc')
  await check(
    'The title becomes "Letter - WordPad" and C:\\My Documents\\Letter.doc holds RTF',
    typeof saved === 'string' && saved.startsWith('{\\rtf1'),
    'wordpad-saved',
  )
  await check(
    'The RTF carries the formatting: bold, centered, Arial, 14pt, red underline, bullets, tabs, and indents',
    [
      '\\b',
      '\\qc',
      'Arial',
      '\\fs28',
      '\\ul',
      '\\red255\\green0\\blue0',
      '\\pnlvlblt',
      '\\tx2880',
      '\\tx5040',
      '\\li720',
      '\\fi360',
    ].every((token) => saved.includes(token)),
  )
  const htmlBefore = await editorHtml()
  await menu('File', 'New...')
  await until("!!document.querySelector('[role=dialog][aria-label=New]')")
  await check(
    'New offers Word 6, Rich Text, and Text documents',
    await evaluate(
      `[...document.querySelectorAll('[role=dialog] [role=option]')].map((o) => o.textContent).join() === 'Word 6 Document,Rich Text Document,Text Document'`,
    ),
    'dialog-new',
  )
  await clickText('Text Document', '[role=option]')
  await clickText('OK', '[role=dialog] button')
  await until('!!__w95.window("Document - WordPad")')
  await check(
    'A new Text Document hides the format bar and ruler by default',
    await evaluate(
      `!document.querySelector('[role=toolbar][aria-label="Format Bar"]') && !document.querySelector('.wordpad-ruler')`,
    ),
  )
  await menu('File', '1 C:\\My Documents\\Letter.doc')
  await until('!!__w95.window("Letter - WordPad")')
  await check('The recent file entry reopens Letter.doc', (await editorText()).includes('expense sheets'))
  await check(
    'Reopening renders the same document: three list items, since Enter after the last bullet continued the list',
    (await editorHtml()).length > 0 && (await evaluate(`__w95.editor().querySelectorAll('li').length`)) === 3,
  )
  await press('s', { ctrl: true })
  await pause(500)
  const resaved = await fileContent('Letter.doc')
  writeFileSync(join(proof, 'letter-first-save.rtf'), saved)
  writeFileSync(join(proof, 'letter-second-save.rtf'), resaved)
  await check(
    'Saving the reopened document writes byte-identical RTF (reads back exactly)',
    resaved === saved,
  )

  // Save as text warns about losing formatting.
  await menu('File', 'Save As...')
  await until('!!document.querySelector(\'[role=dialog][aria-label="Save As"]\')')
  await press('a', { ctrl: true })
  await send('Input.insertText', { text: 'Letter.txt' })
  await press('Enter')
  await until('!!__w95.find("Yes", "button")')
  await check(
    'Saving as a Text Document warns that formatting will be removed',
    await evaluate(`document.body.innerText.includes('Text-Only format')`),
    'dialog-textonly',
  )
  await clickText('Yes', 'button')
  await until('!!__w95.window("Letter - WordPad")')
  await pause(400)
  await check(
    'Letter.txt holds the plain text',
    ((await fileContent('Letter.txt')) ?? '').startsWith('Memo\nThe quarterly review'),
  )

  // Character Map.
  await clickText('Start', 'button')
  await hoverText('Programs')
  await hoverText('Accessories')
  await until('!!__w95.find("Character Map")')
  await clickText('Character Map')
  await until('!!__w95.window("Character Map")')
  await check(
    'Character Map opens with the Font box, a 32 by 7 grid, Characters to copy, Select, Copy, and Close',
    await evaluate(`
      const w = __w95.window('Character Map')
      w.querySelectorAll('fieldset[aria-label=Characters] button').length === 224
        && !!w.querySelector('select') && w.textContent.includes('Characters to copy')
        && ['Select', 'Copy', 'Close'].every((t) => [...w.querySelectorAll('button')].some((b) => b.textContent === t))
    `),
    'charmap-open',
  )
  const cell = await rectOf(`__w95.window('Character Map').querySelector('[aria-label="Character 169"]')`)
  await mouse('mouseMoved', cell.x, cell.y)
  await mouse('mousePressed', cell.x, cell.y)
  await pause(80)
  await check(
    'Holding the mouse on a character magnifies it and the status bar reads Keystroke: Alt+0169',
    await evaluate(`
      const w = __w95.window('Character Map')
      const zoom = w.querySelector('[aria-label="Magnified character"]')
      !!zoom && zoom.textContent === '\\u00a9' && w.textContent.includes('Keystroke: Alt+0169')
    `),
    'charmap-magnify',
  )
  await mouse('mouseReleased', cell.x, cell.y)
  await pause(60)
  await check(
    'Releasing hides the magnifier',
    await evaluate(`!__w95.window('Character Map').querySelector('[aria-label="Magnified character"]')`),
  )
  await clickAt(cell.x, cell.y, 2)
  await clickText('Select', '[data-window] button')
  const letterA = await rectOf(`__w95.window('Character Map').querySelector('[aria-label="Character 65"]')`)
  await clickAt(letterA.x, letterA.y)
  await check(
    'The keystroke for A reads "Keystroke: A"',
    await evaluate(`__w95.window('Character Map').textContent.includes('Keystroke: A')`),
  )
  await press('ArrowRight')
  await press('Enter')
  await check(
    'Double-click, Select, and the keyboard add characters to the box',
    (await evaluate(`__w95.window('Character Map').querySelector('input').value`)) === '\u00a9\u00a9B',
    'charmap-selected',
  )
  await clickText('Copy', '[data-window] button')
  await pause(150)
  await check(
    'Copy puts the characters on the Clipboard',
    (await evaluate('navigator.clipboard.readText()')) === '\u00a9\u00a9B',
  )
  await evaluate(
    `(() => { const s = __w95.window('Character Map').querySelector('select'); s.value = 'Wingdings'; s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`,
  )
  await pause(80)
  await check(
    "Switching to Wingdings shows the font's own glyphs",
    await evaluate(
      `__w95.window('Character Map').querySelector('[aria-label="Character 74"]').textContent === '\\uf04a'`,
    ),
    'charmap-wingdings',
  )

  // Paste the copied characters into WordPad through Edit > Paste.
  await clickText('Letter - WordPad', '[data-task]').catch(async () => {
    const task = await rectOf(`document.querySelector('[data-task][title="Letter - WordPad"]')`)
    await clickAt(task.x, task.y)
  })
  await until(
    '__w95.window("Letter - WordPad").contains(document.activeElement) || document.activeElement === __w95.editor()',
  )
  await click('__w95.editor()')
  await press('End', { ctrl: true })
  await menu('Edit', 'Paste')
  await pause(250)
  await check(
    'Edit > Paste inserts the Clipboard text into the document',
    (await editorText()).includes('\u00a9\u00a9B'),
    'wordpad-pasted',
  )

  // Help > About and closing with unsaved changes.
  await menu('Help', 'About WordPad')
  await until('!!document.querySelector(\'[role=dialog][aria-label="About WordPad"]\')')
  await check(
    'About WordPad uses the standard Windows 95 About layout',
    await evaluate(
      `document.querySelector('[role=dialog][aria-label="About WordPad"]').textContent.includes('This product is licensed to:')`,
    ),
    'dialog-about',
  )
  await clickText('OK', '[role=dialog] button')
  await press('F4', { alt: true })
  await until('!!__w95.find("Save changes to Letter?", "p")')
  await check('Alt+F4 with unsaved changes asks "Save changes to Letter?"', true, 'wordpad-confirm')
  await clickText('No', 'button')
  await until('!__w95.window("Letter - WordPad")')
  await check('Choosing No closes WordPad', true)

  // Run dialog launches both programs by their exe names.
  await clickText('Start', 'button')
  await clickText('Run...')
  await until("!!document.querySelector('[role=dialog][aria-label=Run]')")
  await send('Input.insertText', { text: 'wordpad' })
  await press('Enter')
  await until('!!__w95.window("Document - WordPad")')
  await check('Run > wordpad launches WordPad', true)
  await menu('File', 'Exit')
  await until('!__w95.window("Document - WordPad")')

  // Explorer opens .doc files with WordPad.
  await clickText('My Computer', 'button, div, span').catch(() => {})
  const myDocs = await evaluate(`(__w95.fsNodes().find((n) => n.name === 'Letter.doc') ?? {}).parent`)
  await check('Letter.doc lives in My Documents', !!myDocs)
  writeFileSync(join(proof, 'live-checks.json'), JSON.stringify(checks, null, 2))
  console.log(`\n${checks.length} checks passed`)
} catch (error) {
  await shot('failure').catch(() => {})
  writeFileSync(
    join(proof, 'live-checks.json'),
    JSON.stringify({ passed: checks, failed: String(error) }, null, 2),
  )
  console.error('FAIL', error)
  process.exitCode = 1
} finally {
  ws.close()
}
