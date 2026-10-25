import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const port = process.argv[2] ?? '9312'
const proof = resolve(process.argv[3] ?? '../proof/dosprompt')
const binary =
  process.env.AGENT_BROWSER_EXE ??
  join(process.env.APPDATA, 'npm/node_modules/agent-browser/bin/agent-browser-win32-x64.exe')
mkdirSync(proof, { recursive: true })
const checks = []
function browser(...args) {
  const raw = execFileSync(binary, ['--session', 'dosprompt', '--cdp', port, '--json', ...args], {
    encoding: 'utf8',
    timeout: 15000,
  })
  const result = JSON.parse(raw)
  assert.equal(result.success, true, JSON.stringify(result.error))
  return result.data
}
const evaluate = (code) => browser('eval', '-b', Buffer.from(code).toString('base64')).result
const pause = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(code) {
  for (let i = 0; i < 30; i++) {
    if (evaluate(code)) return
    await pause()
  }
  throw new Error(`Timed out: ${code}`)
}
const input = '[aria-label="MS-DOS command line"]'
const dos = '[data-window][aria-label="MS-DOS Prompt"]'
const text = () => evaluate('document.querySelector(".dos-screen pre")?.textContent ?? ""')
const value = () => evaluate('document.querySelector(".dos-screen input")?.value ?? ""')
async function command(line) {
  browser('fill', input, line)
  browser('press', 'Enter')
  await pause(40)
}
function shot(name) {
  browser('screenshot', join(proof, `${name}.png`))
}
function check(name, assertion, screenshot) {
  assert.ok(assertion, name)
  checks.push({ name, screenshot: screenshot ? join(proof, `${screenshot}.png`) : null })
  console.log(`PASS ${name}`)
  if (screenshot) shot(screenshot)
}
async function closeApp(title) {
  const task = `[data-task][title=${JSON.stringify(title)}]`
  if (!evaluate(`document.querySelector(${JSON.stringify(task)})?.classList.contains('bevel-pressed')`))
    browser('click', task)
  browser('click', `[data-window][aria-label=${JSON.stringify(title)}] button[aria-label="Close"]`)
  await pause()
}

try {
  browser('reload')
  await until(
    '!!document.querySelector("button[aria-label=Start]") || [...document.querySelectorAll("button")].some(b => b.textContent === "Start")',
  )
  browser('snapshot', '-i')
  browser('find', 'role', 'button', 'click', '--name', 'Start', '--exact')
  browser('find', 'role', 'menuitem', 'click', '--name', 'Programs', '--exact')
  browser('snapshot', '-i')
  check(
    'MS-DOS Prompt appears directly in Programs',
    evaluate(
      '[...document.querySelectorAll("[role=menuitem]")].some(b => b.textContent === "MS-DOS Prompt")',
    ),
    'programs',
  )
  browser('find', 'role', 'menuitem', 'click', '--name', 'MS-DOS Prompt', '--exact')
  await until('!!document.querySelector(".dos-screen")')
  check(
    'Banner and initial C:\\WINDOWS> prompt',
    text().includes('Microsoft(R) Windows 95') && text().endsWith('C:\\WINDOWS>'),
    'banner',
  )
  const dimensions = evaluate(
    '(() => { const e = document.querySelector(".dos-screen"); const s = getComputedStyle(e); return {width:e.clientWidth,height:e.clientHeight,cell:s.getPropertyValue("--dos-cell"),row:s.getPropertyValue("--dos-row"),font:s.fontFamily} })()',
  )
  check(
    'Default console is 80 columns by 25 rows',
    dimensions.width === 640 &&
      dimensions.height === 400 &&
      dimensions.cell === '8px' &&
      dimensions.row === '16px',
  )
  writeFileSync(join(proof, 'console-metrics.json'), JSON.stringify(dimensions, null, 2))
  await command('DIR')
  const listing = text()
  check(
    'DIR shows volume, serial, directory rows, executables, and byte totals',
    [
      'Volume in drive C has no label',
      'Volume Serial Number is 1995-0950',
      'Directory of C:\\WINDOWS',
      '<DIR>',
      'COMMAND  COM',
      'bytes free',
    ].every((part) => listing.includes(part)),
    'dir',
  )
  writeFileSync(join(proof, 'dir-observed.txt'), listing)

  await command('MD TEST')
  await command('CD TEST')
  await command('CLS')
  await command('ECHO hi > A.TXT')
  await command('TYPE A.TXT')
  check('ECHO redirection creates a file that TYPE reads', text().includes('\nhi\n'), 'files-console')
  await command('START .')
  browser('snapshot', '-i')
  check(
    'Explorer opens the same TEST folder and sees A.TXT',
    evaluate(
      '[...document.querySelectorAll("[data-window]")].some(e => e.getAttribute("aria-label").includes("TEST") && e.textContent.includes("A.TXT"))',
    ),
    'files-explorer',
  )
  const explorerTitle = evaluate(
    '[...document.querySelectorAll("[data-window]")].find(e => e.getAttribute("aria-label").includes("TEST"))?.getAttribute("aria-label")',
  )
  browser('find', 'role', 'button', 'click', '--name', 'MS-DOS Prompt', '--exact')
  browser('click', `${dos} .dos-screen`)
  await command('DEL A.TXT')
  await command('DIR')
  check(
    'DEL removes the file from the open Explorer immediately',
    evaluate(
      `[...document.querySelectorAll('[data-window]')].find(e => e.getAttribute('aria-label') === ${JSON.stringify(explorerTitle)})?.textContent.includes('A.TXT') === false`,
    ) && !text().includes('A        TXT'),
    'files-deleted',
  )
  await closeApp(explorerTitle)
  browser('click', `${dos} .dos-screen`)
  await command('notepad c:\\mydocu~1\\readme.txt')
  browser('snapshot', '-i')
  check(
    'Short DOS path launches Notepad with the shared Readme.txt content',
    evaluate(
      '[...document.querySelectorAll("[data-window]")].some(e => e.getAttribute("aria-label") === "Readme.txt - Notepad" && e.querySelector("textarea")?.value.includes("Welcome to Windows 95!"))',
    ),
    'launch-notepad',
  )
  await closeApp('Readme.txt - Notepad')
  browser('click', `${dos} .dos-screen`)

  await command('CLS')
  await command('ECHO history proof')
  browser('fill', input, 'draft')
  browser('press', 'ArrowUp')
  check('Up recalls the last command', value() === 'ECHO history proof')
  browser('press', 'ArrowDown')
  check('Down restores the unfinished draft', value() === 'draft')
  browser('press', 'Escape')
  check('Esc clears the command line', value() === '')
  browser('press', 'F3')
  check('F3 repeats the last command', value() === 'ECHO history proof', 'history')
  browser('press', 'Control+c')
  check('Ctrl+C cancels the current command', value() === '' && text().includes('^C'))
  await command('DATE')
  check('DATE asks for input', text().includes('Enter new date'))
  browser('press', 'Control+c')
  await command('VER')
  check('Ctrl+C also cancels a pending DOS prompt', text().includes('Windows 95. [Version 4.00.950]'))

  browser('press', 'Alt+Enter')
  check(
    'Alt+Enter displays the full-screen black console',
    evaluate('!!document.querySelector(".dos-fullscreen")'),
    'fullscreen',
  )
  await command('ECHO full screen input')
  check('Full-screen console accepts commands', text().includes('full screen input'))
  browser('press', 'Alt+Enter')
  check(
    'Alt+Enter restores the window and command line',
    !evaluate('!!document.querySelector(".dos-fullscreen")') &&
      evaluate('document.activeElement?.getAttribute("aria-label")') === 'MS-DOS command line',
  )

  browser('press', 'Shift+F10')
  browser('snapshot', '-i')
  browser('press', 't')
  check(
    'Keyboard menu hides the toolbar',
    !evaluate('!!document.querySelector(".dos-toolbar")'),
    'toolbar-hidden',
  )
  browser('press', 'Shift+F10')
  browser('press', 't')
  check('Keyboard menu restores the toolbar', evaluate('!!document.querySelector(".dos-toolbar")'))
  browser('click', '[aria-label="Properties"]')
  browser('snapshot', '-i')
  check(
    'Properties opens a modal property sheet',
    evaluate(
      `!!document.querySelector(${JSON.stringify('[role=dialog][aria-label="MS-DOS Prompt Properties"]')})`,
    ),
    'properties',
  )
  browser('find', 'role', 'radio', 'click', '--name', '10 x 18', '--exact')
  browser('find', 'role', 'button', 'click', '--name', 'OK', '--exact')
  check(
    'Property font choice changes the console cell size',
    evaluate('document.querySelector(".dos-screen").clientWidth') === 800,
  )
  browser('select', '[aria-label="Font size"]', '1')
  browser('click', `${dos} .dos-screen`)

  await command('CLS')
  await command('ECHO copy proof')
  browser('click', '[aria-label="Mark"]')
  browser('press', 'Shift+ArrowRight')
  browser('press', 'Shift+ArrowRight')
  check(
    'Mark highlights a rectangular text selection',
    evaluate('document.querySelector(".dos-mark")?.textContent') === 'C:\\',
    'mark',
  )
  browser('press', 'Enter')
  await until('!document.querySelector(".dos-mark")')
  browser('click', '[aria-label="Paste"]')
  await until('document.querySelector(".dos-screen input")?.value === "C:\\\\"')
  check('Copy and Paste use the system clipboard', value() === 'C:\\', 'clipboard')
  browser('press', 'Escape')

  browser('click', `${dos} .dos-screen`)
  await command('CLS')
  await command('DIR C:\\ /S /P')
  check('DIR /S /P pauses at a screen boundary', text().includes('-- More --'), 'paging')
  const page = text()
  browser('press', 'Space')
  check('Space advances the directory page', text() !== page)
  browser('press', 'Control+c')
  await command('DIR C:\\WINDOWS /W')
  check('DIR /W uses the wide layout', text().includes('[DESKTOP]'), 'wide')

  await command('ECHO saved > PERSIST.TXT')
  await pause(350)
  check(
    'DOS writes reach the persisted virtual drive',
    evaluate(
      'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).some(n => n.name === "PERSIST.TXT" && n.content === "saved\\r\\n")',
    ),
  )
  browser('click', '[aria-label="Background"]')
  check(
    'Background minimizes the DOS window',
    evaluate(`document.querySelector(${JSON.stringify(dos)}).classList.contains('hidden')`),
    'background',
  )
  browser('find', 'role', 'button', 'click', '--name', 'MS-DOS Prompt', '--exact')
  browser('click', `${dos} .dos-screen`)
  browser('reload')
  await until('!!document.querySelector("[data-start-button]")')
  browser('find', 'role', 'button', 'click', '--name', 'Start', '--exact')
  browser('find', 'role', 'menuitem', 'click', '--name', 'Programs', '--exact')
  browser('find', 'role', 'menuitem', 'click', '--name', 'MS-DOS Prompt', '--exact')
  await command('TYPE C:\\WINDOWS\\TEST\\PERSIST.TXT')
  check('DOS files survive a renderer reload', text().includes('\nsaved\n'), 'persistence')
  await command('EXIT')
  check('EXIT closes the DOS window', !evaluate(`!!document.querySelector(${JSON.stringify(dos)})`), 'exit')
  writeFileSync(
    join(proof, 'live-checks.json'),
    JSON.stringify({ port, checks, passed: checks.length }, null, 2),
  )
  console.log(`Verified ${checks.length} live checks. Proof: ${proof}`)
} catch (error) {
  shot('failure')
  writeFileSync(
    join(proof, 'live-checks.json'),
    JSON.stringify({ port, checks, error: String(error) }, null, 2),
  )
  throw error
}
