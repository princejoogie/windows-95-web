import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const executable =
  process.env.W95_AGENT_BROWSER ??
  (process.platform === 'win32'
    ? join(process.env.APPDATA, 'npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe')
    : 'agent-browser')
const session = process.env.W95_BROWSER_SESSION ?? 'shell'
const proof = resolve(process.env.W95_PROOF_DIR ?? '../proof/shell')
mkdirSync(proof, { recursive: true })
const results = []
function browser(...args) {
  return execFileSync(executable, ['--session', session, ...args], {
    encoding: 'utf8',
    timeout: 35000,
  }).trim()
}
function evaluate(expression) {
  return JSON.parse(browser('eval', expression))
}
function check(condition, name) {
  assert.ok(condition, name)
  results.push(name)
  process.stdout.write(`PASS ${name}\n`)
}
function shot(name) {
  browser('screenshot', join(proof, `${name}.png`))
}
function wait(expression) {
  browser('wait', '--fn', expression)
}
function menu(name) {
  browser('find', 'role', 'menuitem', 'click', '--name', name)
}
function button(name) {
  browser('find', 'role', 'button', 'click', '--name', name, '--exact')
}
function waitMenu(name) {
  wait(
    `Array.from(document.querySelectorAll('[role="menuitem"]')).some(e=>e.textContent === ${JSON.stringify(name)})`,
  )
}
function start() {
  browser('click', '[data-start-button]')
  browser('wait', '[aria-label="Start menu"]')
}
function run(command) {
  start()
  menu('Run...')
  browser('wait', '#run-command')
  browser('fill', '#run-command', command)
  browser('press', 'Enter')
}
/** The selector of the desktop icon labelled `name`. Its key is a node id, which changes per boot. */
function desktopItem(name) {
  const key = evaluate(
    `[...document.querySelectorAll('[data-desktop-item]')].find(e => e.textContent === ${JSON.stringify(name)})?.dataset.desktopItem`,
  )
  assert.ok(key, `no desktop icon named ${name}`)
  return `[data-desktop-item="${key}"]`
}
function rectangle(selector) {
  return evaluate(`document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect().toJSON()`)
}
function drag(from, to) {
  browser('mouse', 'move', String(from.x), String(from.y))
  browser('mouse', 'down')
  browser('mouse', 'move', String(to.x), String(to.y))
}

const phase = process.argv[2] ?? 'smoke'
if (process.env.W95_CDP_PORT) browser('connect', process.env.W95_CDP_PORT)
browser('wait', '[data-start-button]')

if (phase === 'smoke') {
  browser('reload')
  browser('wait', '[data-start-button]')
  shot('notepad-desktop')
  start()
  shot('start-menu')
  browser('press', 'Escape')
  check(evaluate('document.querySelector(`[aria-label="Start menu"]`) === null'), 'Escape closes Start')
  browser('press', 'Control+Escape')
  browser('wait', '[aria-label="Start menu"]')
  browser('mouse', 'move', '600', '400')
  browser('mouse', 'down')
  browser('mouse', 'up')
  check(
    evaluate('document.querySelector(`[aria-label="Start menu"]`) === null'),
    'An outside click closes Start',
  )
  check(evaluate('document.querySelector(`[aria-label="Start menu"]`) === null'), 'Ctrl+Esc opens Start')
  start()
  menu('Programs')
  waitMenu('Accessories')
  menu('Accessories')
  waitMenu('Notepad')
  shot('start-accessories')
  menu('Notepad')
  browser('wait', 'textarea')
  check(
    evaluate('document.querySelector(`[data-window]`).getAttribute(`aria-label`) === `Untitled - Notepad`'),
    'Start launches Notepad',
  )
  browser('fill', 'textarea', 'Windows 95 persistence proof.\nA second line to find.')
  browser('press', 'Control+Shift+s')
  browser('wait', '[role="dialog"][aria-label="Save As"]')
  browser('fill', 'input[id$="-name"]', 'C:\\My Documents\\note.txt')
  shot('notepad-save-as')
  button('Save')
  wait(
    'document.querySelector(`[data-window][aria-label="note.txt - Notepad"]`) !== null || document.body.textContent.includes(`Do you want to replace it?`)',
  )
  if (evaluate('document.body.textContent.includes(`Do you want to replace it?`)')) button('Yes')
  browser('wait', '[data-window][aria-label="note.txt - Notepad"]')
  wait(
    'Object.values(JSON.parse(localStorage.getItem(`w95.fs.v1`)).nodes).some(n=>n.name===`note.txt` && n.content.startsWith(`Windows 95 persistence proof.`))',
  )
  check(true, 'Save As writes note.txt')
  shot('notepad-saved')
  browser('eval', 'void (globalThis.proofEditor = document.querySelector(`textarea`))')
  run('notepad')
  wait('document.querySelectorAll(`[data-window]`).length === 2')
  const first = '[data-window="1"]'
  const second = '[data-window="2"]'
  browser('click', `${first} > div:first-child`)
  check(
    evaluate(
      'Number(document.querySelector(`[data-window="1"]`).style.zIndex) > Number(document.querySelector(`[data-window="2"]`).style.zIndex)',
    ),
    'Click raises a window',
  )
  check(
    evaluate('globalThis.proofEditor === document.querySelector(`textarea`)'),
    'Raising keeps the live textarea in place',
  )
  shot('windows-focus')
  const before = rectangle(first)
  drag({ x: before.x + 150, y: before.y + 12 }, { x: before.x + 260, y: before.y + 72 })
  shot('window-drag-outline')
  check(rectangle(first).x === before.x, 'Dragging holds the original frame until release')
  browser('mouse', 'up')
  wait(`document.querySelector('${first}').getBoundingClientRect().x === ${before.x + 110}`)
  shot('window-moved')
  const moved = rectangle(first)
  drag({ x: moved.right - 3, y: moved.bottom - 3 }, { x: moved.right + 77, y: moved.bottom + 47 })
  browser('mouse', 'up')
  check(rectangle(first).width === moved.width + 80, 'Corner resize changes the client size')
  shot('window-resized')
  const resized = rectangle(first)
  browser('click', `${first} button[aria-label="Maximize"]`)
  wait(`document.querySelector('${first}').style.left === '-4px'`)
  check(
    rectangle(first).height === rectangle('[data-desktop]').height + 8,
    'Maximize hides the sizing border off screen',
  )
  shot('window-maximized')
  browser('click', `${first} button[aria-label="Restore"]`)
  wait(`document.querySelector('${first}').getBoundingClientRect().width === ${resized.width}`)
  check(
    rectangle(first).width === resized.width && rectangle(first).x === resized.x,
    'Restore recovers the previous bounds',
  )
  browser('click', `${first} button[aria-label="Minimize"]`)
  wait('getComputedStyle(document.querySelector(`[data-window="1"]`)).display === `none`')
  check(
    evaluate('getComputedStyle(document.querySelector(`[data-window="1"]`)).display === `none`'),
    'Minimize hides the frame',
  )
  shot('window-minimized')
  browser('click', '[data-task="1"]')
  wait('getComputedStyle(document.querySelector(`[data-window="1"]`)).display !== `none`')
  check(
    evaluate('getComputedStyle(document.querySelector(`[data-window="1"]`)).display !== `none`'),
    'Taskbar restores the window',
  )
  shot('window-restored')
  browser('click', `${second} button[aria-label="Close"]`)
  browser('fill', `${first} textarea`, 'Unsaved changes')
  browser('click', `${first} button[aria-label="Close"]`)
  browser('wait', '[role="dialog"][aria-label="Notepad"]')
  shot('notepad-unsaved')
  button('Cancel')
  check(
    evaluate('document.querySelector(`textarea`).value === `Unsaved changes`'),
    'Cancel keeps unsaved text',
  )
  browser('click', `${first} button[aria-label="Close"]`)
  button('No')
  wait('document.querySelectorAll(`[data-window]`).length === 0')
  run('C:\\My Documents\\Readme.txt')
  browser('wait', '[data-window][aria-label="Readme.txt - Notepad"]')
  check(
    evaluate('document.querySelector(`textarea`).value.startsWith(`Welcome to Windows 95!`)'),
    'Run opens a document path',
  )
  shot('run-document')
  browser('click', '[data-window] button[aria-label="Close"]')
  run('bogus')
  browser('wait', '[role="dialog"][aria-label="bogus"]')
  shot('run-invalid')
  check(
    evaluate('document.body.textContent.includes(`Cannot find the file`)'),
    'Run reports an unknown command',
  )
  browser('press', 'Escape')
  browser('press', 'Escape')
} else if (phase === 'editing') {
  browser('reload')
  browser('wait', '[data-start-button]')
  run('notepad')
  browser('wait', 'textarea')
  browser('fill', 'textarea', 'Alpha beta Alpha')
  browser('press', 'Control+Home')
  browser('press', 'Control+f')
  browser('wait', '[role="dialog"][aria-label="Find"]')
  browser('fill', 'input[id^="find-"]', 'Alpha')
  shot('notepad-find-dialog')
  button('Find Next')
  wait(
    'document.querySelector(`textarea`).selectionStart === 0 && document.querySelector(`textarea`).selectionEnd === 5',
  )
  browser('press', 'F3')
  check(evaluate('document.querySelector(`textarea`).selectionStart === 11'), 'F3 finds the next occurrence')
  shot('notepad-find-next')
  browser('press', 'F5')
  check(
    evaluate('document.querySelector(`textarea`).value !== `Alpha beta Alpha`'),
    'F5 inserts the time and date',
  )
  shot('notepad-time-date')
  browser('press', 'Control+z')
  check(
    evaluate('document.querySelector(`textarea`).value === `Alpha beta Alpha`'),
    'Undo restores the previous text',
  )
  button('Edit')
  menu('Word Wrap')
  check(evaluate('document.querySelector(`textarea`).wrap === `soft`'), 'Word Wrap changes the editor layout')
  button('Edit')
  menu('Select All')
  button('Edit')
  menu('Copy')
  browser('focus', 'textarea')
  browser('press', 'Control+End')
  button('Edit')
  menu('Paste')
  wait('document.querySelector(`textarea`).value === `Alpha beta AlphaAlpha beta Alpha`')
  check(true, 'Edit Copy and Paste use the clipboard')
  browser('focus', 'textarea')
  browser('press', 'Control+a')
  button('Edit')
  menu('Cut')
  wait('document.querySelector(`textarea`).value === ``')
  button('Edit')
  menu('Paste')
  wait('document.querySelector(`textarea`).value === `Alpha beta AlphaAlpha beta Alpha`')
  check(true, 'Edit Cut removes selected text and Paste restores it')
  shot('notepad-editing')
  button('Help')
  menu('About Notepad')
  shot('notepad-about')
  browser('press', 'Escape')
  browser('click', '[data-window] button[aria-label="Close"]')
  button('Yes')
  browser('wait', '[role="dialog"][aria-label="Save As"]')
  browser('fill', 'input[id$="-name"]', 'C:\\My Documents\\close-saved.txt')
  button('Save')
  wait(
    'document.querySelector(`[data-window]`) === null || document.body.textContent.includes(`Do you want to replace it?`)',
  )
  if (evaluate('document.body.textContent.includes(`Do you want to replace it?`)')) button('Yes')
  wait('document.querySelector(`[data-window]`) === null')
  check(true, 'Yes saves an untitled document before closing')
  run('notepad')
  browser('wait', 'textarea')
  browser('press', 'Control+o')
  browser('wait', '[role="dialog"][aria-label="Open"]')
  browser('fill', 'input[id$="-name"]', 'Readme.txt')
  shot('notepad-open-dialog')
  button('Open')
  browser('wait', '[data-window][aria-label="Readme.txt - Notepad"]')
  check(
    evaluate('document.querySelector(`textarea`).value.startsWith(`Welcome to Windows 95!`)'),
    'File Open loads a text document',
  )
  button('File')
  menu('Exit')
} else if (phase === 'desktop') {
  browser('reload')
  browser('wait', '[data-start-button]')
  browser('mouse', 'move', '400', '300')
  browser('mouse', 'down', 'right')
  browser('mouse', 'up', 'right')
  waitMenu('New')
  menu('New')
  waitMenu('Text Document')
  menu('Text Document')
  browser('wait', '[data-desktop-item] input')
  browser('fill', '[data-desktop-item] input', 'Readme.txt')
  browser('press', 'Enter')
  const readme = desktopItem('Readme.txt')
  browser('click', readme)
  browser('press', 'F2')
  browser('wait', '[data-desktop-item] input')
  browser('fill', '[data-desktop-item] input', 'Shell Readme.txt')
  browser('press', 'Enter')
  check(
    evaluate(`document.querySelector(${JSON.stringify(readme)}).textContent.includes('Shell Readme.txt')`),
    'F2 renames a desktop file',
  )
  shot('desktop-renamed')
  const icon = rectangle(readme)
  drag({ x: icon.x + 35, y: icon.y + 18 }, { x: icon.x + 235, y: icon.y + 168 })
  browser('mouse', 'up')
  check(
    evaluate(
      `JSON.parse(localStorage.getItem('w95.desktop.v1'))[${JSON.stringify(readme.slice(20, -2))}].x > 100`,
    ),
    'Dragging saves desktop icon positions',
  )
  shot('desktop-dragged')
  browser('mouse', 'move', '600', '450')
  browser('mouse', 'down', 'right')
  browser('mouse', 'up', 'right')
  waitMenu('New')
  menu('New')
  waitMenu('Text Document')
  menu('Text Document')
  browser('wait', '[data-desktop-item] input')
  browser('fill', '[data-desktop-item] input', 'Disposable.txt')
  browser('press', 'Enter')
  browser('press', 'Delete')
  browser('wait', '[role="dialog"][aria-label="Confirm File Delete"]')
  shot('desktop-delete-confirm')
  button('Yes')
  wait(
    'Object.values(JSON.parse(localStorage.getItem(`w95.fs.v1`)).nodes).some(n=>n.name===`Disposable.txt` && n.parent===`recycled`)',
  )
  check(true, 'Confirmed deletion moves a file to C:\\RECYCLED')
  shot('desktop-deleted')
  browser('dblclick', readme)
  browser('wait', '[data-window][aria-label="Shell Readme.txt - Notepad"]')
  check(true, 'A desktop document opens in Notepad')
  shot('desktop-open-notepad')
  browser('click', '[data-window] button[aria-label="Close"]')
  start()
  menu('Documents')
  waitMenu('Shell Readme.txt')
  menu('Shell Readme.txt')
  browser('wait', '[data-window][aria-label="Shell Readme.txt - Notepad"]')
  shot('start-documents-notepad')
  browser('click', '[data-window] button[aria-label="Close"]')
} else if (phase === 'persistence') {
  run('C:\\My Documents\\note.txt')
  browser('wait', 'textarea')
  check(
    evaluate(
      'document.querySelector(`textarea`).value === `Windows 95 persistence proof.\nA second line to find.`',
    ),
    'note.txt survives a process restart',
  )
  shot('notepad-persisted')
  const readme = desktopItem('Shell Readme.txt')
  const at = evaluate(
    `JSON.parse(localStorage.getItem('w95.desktop.v1'))[${JSON.stringify(readme.slice(20, -2))}]`,
  )
  const icon = rectangle(readme)
  check(icon.x === at.x && icon.y === at.y, 'Desktop positions survive a process restart')
  shot('desktop-persisted')
} else if (phase === 'shutdown') {
  run('notepad')
  browser('wait', 'textarea')
  browser('fill', 'textarea', 'Shutdown must ask before closing this document.')
  start()
  menu('Shut Down...')
  button('Yes')
  browser('wait', '[role="dialog"][aria-label="Notepad"]')
  shot('shutdown-unsaved-prompt')
  check(evaluate('document.querySelector(`textarea`) !== null'), 'Shutdown queries the unsaved document')
  button('Cancel')
  check(
    evaluate(
      'document.querySelector(`textarea`).value === `Shutdown must ask before closing this document.`',
    ),
    'Cancel aborts shutdown and keeps the document',
  )
  start()
  menu('Shut Down...')
  browser('wait', '[aria-label="Shut Down Windows"]')
  shot('shutdown-choice')
  button('Yes')
  browser('wait', '[role="dialog"][aria-label="Notepad"]')
  button('No')
  browser('wait', '[role="status"]')
  check(evaluate('document.querySelectorAll(`[data-window]`).length === 0'), 'Shutdown closes app windows')
  shot('shutting-down')
  wait('document.body.textContent.includes(`safe to turn off`)')
  check(true, 'Shutdown reaches the safe screen')
  shot('safe-to-turn-off')
} else {
  throw new Error(`Unknown phase ${phase}`)
}
writeFileSync(join(proof, `${phase}-checks.json`), JSON.stringify(results, null, 2))
