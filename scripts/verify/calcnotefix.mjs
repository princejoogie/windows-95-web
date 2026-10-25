import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const output = process.env.W95_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/calcnotefix'
const browser =
  process.env.AGENT_BROWSER_BIN ??
  join(process.env.APPDATA, 'npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe')
const group = process.argv[2] ?? 'calculator'
mkdirSync(output, { recursive: true })
const logFile = join(output, `${group}-live.log`)
writeFileSync(logFile, '')
const run = (...args) =>
  execFileSync(browser, ['--session', 'calcnotefix', ...args], { encoding: 'utf8', timeout: 30000 }).trim()
const evaluate = (script) => JSON.parse(run('eval', script))
const element = (selector) => `document.querySelector(${JSON.stringify(selector)})`
const record = (label, value) => {
  const line = `${label} ${JSON.stringify(value)}\n`
  appendFileSync(logFile, line)
  process.stdout.write(line)
}
const check = (label, script, expected) => {
  const actual = evaluate(script)
  assert.deepEqual(actual, expected, label)
  record(`PASS ${label}`, actual)
}
const shot = (name) => run('screenshot', join(output, `${name}.png`))
function clickText(text, selector = 'button') {
  const index = evaluate(
    `Array.from(document.querySelectorAll(${JSON.stringify(selector)})).findIndex(element => element.textContent.trim() === ${JSON.stringify(text)})`,
  )
  assert.notEqual(index, -1, `Missing ${selector} with text ${text}`)
  run('find', 'nth', String(index), selector, 'click')
}
const key = (value) => run('press', value)
const menu = (name, item) => {
  clickText(name, '[data-window] [role="menubar"] button')
  clickText(item, '[role="menu"] button')
}
const launch = (exe) => {
  clickText('Start')
  clickText('Run...', '[role="menu"] button')
  run('fill', '[role="dialog"] input', exe)
  key('Enter')
  run('wait', '[data-window]')
}
function moveDialog(title, dx, dy) {
  const selector = `[role="dialog"][aria-label="${title}"]`
  const position = evaluate(
    `(() => { const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect(); return {x: rect.x + 60, y: rect.y + 10} })()`,
  )
  run('mouse', 'move', String(Math.round(position.x)), String(Math.round(position.y)))
  run('mouse', 'down', 'left')
  run('mouse', 'move', String(Math.round(position.x + dx)), String(Math.round(position.y + dy)))
  run('mouse', 'up', 'left')
}
run('connect', process.env.W95_CDP_PORT ?? '9350')
run('reload')
run('wait', '[data-desktop-item="app:mycomputer"]')
record(
  'app',
  evaluate('({url: location.href, width: innerWidth, height: innerHeight, userAgent: navigator.userAgent})'),
)

if (group === 'calculator') {
  launch('calc')
  menu('View', 'Scientific')
  const display = `${element('output[aria-label="Calculator display"]')}.textContent`
  const keys = (...labels) => {
    for (const label of labels) clickText(label, '.calculator button:not([role="menuitem"])')
  }
  const clear = () => key('Escape')
  const number = (text) => {
    for (const char of text) key(char)
  }
  check(
    'Scientific has all required keys',
    `['Sta','F-E','(',')','dms','Exp','ln','sin','cos','tan','x^y','x^3','x^2','log','n!','pi','Mod','And','Or','Xor','Lsh','Not','Int','A','B','C','D','E','F'].every(label => Array.from(document.querySelectorAll('.calculator button')).some(button => button.textContent.trim() === label))`,
    true,
  )
  check(
    'Scientific fixed window width',
    'document.querySelector(".calculator").getBoundingClientRect().width',
    466,
  )
  keys('2', '+', '3', '*', '4', '=')
  check('Scientific precedence', display, '14.')
  clear()
  keys('2', '*', '(', '3', '+', '4')
  check(
    'Open parentheses indicator',
    `${element('output[aria-label="Parentheses indicator"]')}.textContent`,
    '(=1',
  )
  shot('calculator-parentheses')
  keys(')', '=')
  check('Parentheses result', display, '14.')
  clear()
  number('30')
  keys('sin')
  check('Degrees sine', display, '0.5')
  run('find', 'label', 'Inv', 'check')
  keys('sin')
  check('Inverse sine', display, '30.')
  run('find', 'label', 'Radians', 'check')
  clear()
  keys('pi', '/', '2', '=', 'sin')
  check('Radians sine', display, '1.')
  run('find', 'label', 'Grads', 'check')
  clear()
  number('100')
  keys('sin')
  check('Grads sine', display, '1.')
  clear()
  number('255')
  run('find', 'label', 'Hex', 'check')
  check('Hex conversion', display, 'FF')
  run('find', 'label', 'Byte', 'check')
  keys('+', '1', '=')
  check('Byte arithmetic wraps', display, '0')
  keys('Not')
  check('Byte NOT', display, 'FF')
  shot('calculator-hex-byte')
  run('find', 'label', 'Bin', 'check')
  check('Binary conversion', display, '11111111')
  check(
    'Unavailable digits are disabled',
    `Array.from(document.querySelectorAll('.calculator button')).find(button => button.textContent === '2').disabled`,
    true,
  )
  run('find', 'label', 'Oct', 'check')
  check('Octal conversion', display, '377')
  run('find', 'label', 'Dec', 'check')
  clear()
  keys('5', 'n!')
  check('Factorial', display, '120.')
  clear()
  keys('2', 'x^y', '3', '=')
  check('Power', display, '8.')
  clear()
  keys('1', 'Exp', '+/-', '3', '*', '2', '=')
  check('Signed exponent', display, '0.002')
  keys('F-E')
  check('F-E formatting', display, '2.00000000000000e-3')
  keys('F-E')
  clear()
  for (const value of ['2', '4', '6']) {
    number(value)
    keys('Dat')
  }
  keys('Ave')
  check('Statistics mean', display, '4.')
  keys('Sta')
  moveDialog('Statistics Box', 400, 80)
  check(
    'Statistics box count',
    `${element('[role=dialog][aria-label="Statistics Box"]')}.textContent.includes("Count = 3")`,
    true,
  )
  run('select', '[aria-label="Statistical data"]', '1')
  clickText('LOAD', '[role="dialog"] button')
  check('Statistics LOAD recalls selected observation', display, '2.')
  shot('calculator-statistics')
  clickText('CD', '[role="dialog"] button')
  check('Statistics delete', `${element('[aria-label="Statistical data"]')}.options.length`, 2)
  clickText('CAD', '[role="dialog"] button')
  check('Statistics clear', `${element('[aria-label="Statistical data"]')}.options.length`, 0)
  clickText('RET', '[role="dialog"] button')
  clear()
  shot('calculator-scientific')
  menu('Help', 'About Calculator')
  shot('calculator-about')
  clickText('OK', '[role="dialog"] button')
  menu('View', 'Standard')
  number('12+7*2=')
  check('Standard left-to-right unchanged', display, '38.')
  clear()
  number('1/0=')
  check('Finding 38 punctuation preserved pending original reference', display, 'Cannot divide by zero')
  shot('calculator-error-unverified-punctuation')
  clear()
  menu('Help', 'Help Topics')
  check(
    'Help Topics is harmless without installed viewer',
    'document.querySelectorAll("[data-window]").length',
    1,
  )
  record('result', 'PASS calculator')
} else if (group === 'notepad') {
  launch('notepad')
  const editor = '[aria-label="Document text"]'
  const area = element('[aria-label="Document text"]')
  check(
    'Notepad client size',
    '(() => {const r=document.querySelector("[data-window] [role=menubar]").parentElement.getBoundingClientRect();return [r.width,r.height]})()',
    [560, 380],
  )
  check(
    'Borderless editor and permanent scrollbars',
    `(() => {const s=getComputedStyle(${area});return [s.padding,s.borderWidth,s.boxShadow,s.overflowX,s.overflowY,s.lineHeight]})()`,
    ['1px', '0px', 'none', 'scroll', 'scroll', '15px'],
  )
  record(
    'Finding 15 font dependency',
    evaluate(
      `({requested:getComputedStyle(${area}).fontFamily,bitmapLoaded:Array.from(document.fonts).some(font => font.family.includes('Fixedsys') && font.status==='loaded')})`,
    ),
  )
  shot('notepad-editor')
  clickText('Edit', '[role="menubar"] button')
  check(
    'Delete disabled without selection',
    `Array.from(document.querySelectorAll('[role=menu] button')).find(button => button.textContent.includes('Delete')).getAttribute('aria-disabled')`,
    'true',
  )
  shot('notepad-delete-disabled')
  key('Escape')
  run('fill', editor, 'Alpha beta Alpha\nsecond line')
  key('Control+a')
  clickText('Edit', '[role="menubar"] button')
  check(
    'Delete enabled for selection',
    `Array.from(document.querySelectorAll('[role=menu] button')).find(button => button.textContent.includes('Delete')).getAttribute('aria-disabled')`,
    'false',
  )
  clickText('DeleteDel', '[role="menu"] button')
  check('Delete removes selection', `${area}.value`, '')
  run('fill', editor, 'Alpha beta Alpha\nsecond line')
  key('Control+Home')
  menu('File', 'Page Setup...')
  check(
    'Page Setup defaults',
    'Array.from(document.querySelectorAll("[role=dialog] input")).filter(input=>input.type!=="radio").map(input=>input.value)',
    ['0.75', '0.75', '1', '1', '&f', 'Page &p'],
  )
  run('find', 'label', 'Header:', 'fill', 'My header')
  run('find', 'label', 'Landscape', 'check')
  shot('notepad-page-setup')
  clickText('OK', '[role="dialog"] button')
  menu('File', 'Page Setup...')
  check(
    'Page Setup keeps settings',
    'Array.from(document.querySelectorAll("[role=dialog] input")).some(input=>input.value==="My header")',
    true,
  )
  clickText('Cancel', '[role="dialog"] button')
  menu('File', 'Print...')
  check(
    'Print explains missing printer',
    'document.querySelector("[role=dialog]").textContent.includes("No printers are installed.")',
    true,
  )
  shot('notepad-print')
  clickText('OK', '[role="dialog"] button')
  menu('Search', 'Find...Ctrl+F')
  moveDialog('Find', 410, 100)
  run('find', 'label', 'Find what:', 'fill', 'Alpha')
  clickText('Find Next', '[role="dialog"] button')
  check('Find selects first match', `[${area}.selectionStart,${area}.selectionEnd]`, [0, 5])
  check(
    'Find remains modeless',
    'document.querySelector("[role=dialog][aria-label=Find]").getAttribute("aria-modal")',
    'false',
  )
  clickText('Find Next', '[role="dialog"] button')
  check('Find selects next match', `[${area}.selectionStart,${area}.selectionEnd]`, [11, 16])
  run('find', 'label', 'Up', 'check')
  clickText('Find Next', '[role="dialog"] button')
  check('Find Up selects previous match', `[${area}.selectionStart,${area}.selectionEnd]`, [0, 5])
  run('click', editor)
  key('Control+End')
  run('type', editor, ' edited')
  check(
    'Editor accepts typing while Find is open',
    `${area}.value.endsWith(' edited') && !!document.querySelector('[role=dialog][aria-label=Find]')`,
    true,
  )
  shot('notepad-modeless-find')
  run('find', 'label', 'Find what:', 'fill', 'alpha')
  run('find', 'label', 'Match case', 'check')
  clickText('Find Next', '[role="dialog"] button')
  check(
    'Match case reports missing lowercase query',
    'Array.from(document.querySelectorAll("[role=dialog]")).some(dialog=>dialog.textContent.includes("Cannot find \\"alpha\\""))',
    true,
  )
  shot('notepad-find-match-case')
  check(
    'Find is blocked while its owner has a modal message',
    `${element('[role=dialog][aria-label=Find]')}.inert`,
    true,
  )
  clickText('OK', '[role="dialog"] button')
  check(
    'Find is usable again after dismissing the message',
    `${element('[role=dialog][aria-label=Find]')}.inert`,
    false,
  )
  clickText('Cancel', '[role="dialog"] button')
  menu('Edit', 'Word Wrap')
  check(
    'Wrapped editor keeps only vertical scrollbar',
    `(() => {const s=getComputedStyle(${area});return [${area}.wrap,s.overflowX,s.overflowY]})()`,
    ['soft', 'hidden', 'scroll'],
  )
  shot('notepad-word-wrap')
  menu('Help', 'About Notepad')
  shot('notepad-about')
  clickText('OK', '[role="dialog"] button')
  menu('Help', 'Help Topics')
  check(
    'Notepad Help Topics is harmless without viewer',
    'document.querySelectorAll("[data-window]").length',
    1,
  )
  menu('File', 'NewCtrl+N')
  record(
    'Finding 37 protected prompt remains unchanged',
    evaluate('document.querySelector("[role=dialog] p").textContent'),
  )
  shot('notepad-save-prompt-awaits-shell-owner')
  clickText('Cancel', '[role="dialog"] button')
  run('fill', editor, `${'another line\n'.repeat(80)}needle`)
  key('Control+Home')
  menu('Search', 'Find...Ctrl+F')
  run('find', 'label', 'Find what:', 'fill', 'needle')
  run('find', 'label', 'Down', 'check')
  clickText('Find Next', '[role="dialog"] button')
  check('Find scrolls a distant match into view', `${area}.scrollTop > 0`, true)
  shot('notepad-find-scroll')
  clickText('Cancel', '[role="dialog"] button')
  record('result', 'PASS notepad; font and save-prompt ownership dependencies remain')
} else throw new Error(`Unknown group ${group}`)
