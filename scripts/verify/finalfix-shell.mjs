import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const proof = 'D:/codes/worktrees/windows-95-web/proof/finalfix-shell'
mkdirSync(proof, { recursive: true })
const phase = process.argv[2] ?? 'dialogs'
const baseline = process.argv.includes('--baseline')
const app = await connect(9440)
const results = []
const exists = (selector) => app.eval(`!!document.querySelector(${JSON.stringify(selector)})`)
const read = (expression) => app.eval(expression)
const check = (finding, behavior, passed, detail) => {
  results.push({ finding, behavior, passed, detail })
  console.log(`${passed ? 'PASS' : 'FAIL'} ${finding} ${behavior}`, detail ?? '')
}
const shot = (name) => app.shot(join(proof, `${baseline ? 'before' : 'after'}-${name}.png`))
const clickText = async (
  label,
  within = 'body',
  selector = 'button,[role="menuitem"],[role="tab"],[role="option"]',
) => {
  const at = await read(
    `(()=>{const e=[...document.querySelector(${JSON.stringify(within)}).querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(label)}&&e.getClientRects().length);if(!e)throw Error('Missing '+${JSON.stringify(label)});const b=e.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await app.click(...at)
}
const fill = async (selector, value) => {
  await app.clickOn(selector)
  await app.key('a', ['Control'])
  await app.type(value)
}
const run = async (command) => {
  await app.clickOn('[data-start-button]')
  await clickText('Run...')
  await fill('#run-command', command)
  await app.key('Enter')
}
const reset = async () => {
  await app.send('Page.reload')
  await sleep(200)
  await app.waitFor(`!!document.querySelector('[data-desktop]')`)
  await sleep(200)
}
const dialogs = async () => {
  await run('notepad')
  await app.type('Held Alt save prompt')
  await app.key('F4', ['Alt'])
  await shot('01-held-alt-prompt')
  check(
    1,
    'held Alt+F4 retains the prompt button focus',
    await read(`document.activeElement?.closest('[role="dialog"]')?.getAttribute('aria-label')==='Notepad'`),
    await read(
      `({tag:document.activeElement?.tagName,text:document.activeElement?.textContent?.slice(0,50)})`,
    ),
  )
  await app.key('n')
  check(1, 'N answers No after releasing held Alt', !(await exists('[data-window]')))
  await reset()
  await run('audit-missing')
  await app.clickOn('[role="dialog"][aria-label="Run"] [data-dialog-caption] button[aria-label="Close"]')
  check(
    2,
    'nested error blocks the Run Close button',
    await exists('[role="dialog"][aria-label="audit-missing"]'),
  )
  await shot('02-blocked-run')
  await reset()
  await app.clickOn('[data-start-button]')
  await clickText('Run...')
  await app.key('Tab')
  await app.key('Tab')
  await app.key('Tab')
  await app.key('o', ['Alt'])
  check(4, 'Alt+O focuses Open', await read(`document.activeElement.id==='run-command'`))
  await app.key('b', ['Alt'])
  check(4, 'Alt+B opens Browse', await exists('[role="dialog"][aria-label="Browse"]'))
  await shot('04-run-browse-mnemonic')
  await reset()
  await run('notepad')
  await app.key('o', ['Control'])
  await app.clickOn('[role="combobox"]')
  await app.key('Escape')
  await app.key('n', ['Alt'])
  check(4, 'Alt+N focuses File name', await read(`document.activeElement.id.endsWith('-name')`))
  await app.key('i', ['Alt'])
  check(4, 'Alt+I focuses location', await read(`document.activeElement.id.endsWith('-folder')`))
  await app.key('t', ['Alt'])
  check(4, 'Alt+T focuses file type', await read(`document.activeElement.id.endsWith('-type')`))
  await app.clickOn('[aria-label="Create New Folder"]')
  await app.key('Escape')
  check(
    3,
    'Escape cancels folder rename and retains Open',
    (await exists('[role="dialog"][aria-label="Open"]')) && !(await exists('[role="listbox"] input')),
  )
  await shot('03-inline-rename-escape')
  await reset()
  await app.click(700, 450, { button: 'right' })
  await clickText('Properties')
  await clickText('Screen Saver')
  await app.clickOn('[role="combobox"][aria-label="Screen saver"]')
  await clickText('Mystify Your Mind')
  await clickText('Preview')
  await app.waitFor(`!!document.querySelector('[data-screen-saver]')`)
  await app.key('Escape')
  check(
    3,
    'Escape dismisses preview and retains the Display draft',
    (await exists('[role="dialog"][aria-label="Display Properties"]')) &&
      (await read(
        `document.querySelector('[aria-label="Screen saver"]')?.textContent.includes('Mystify Your Mind')`,
      )),
  )
  await shot('03-preview-escape')
  await reset()
  for (const command of [
    '"C:\\My Documents\\Readme.txt"',
    'notepad "C:\\My Documents\\Readme.txt"',
    '"C:\\WINDOWS\\NOTEPAD.EXE" "C:\\My Documents\\Readme.txt"',
  ]) {
    await run(command)
    check(
      5,
      command,
      await read(
        `!![...document.querySelectorAll('[data-window]')].find(e=>e.getAttribute('aria-label').includes('Readme'))`,
      ),
    )
    await shot(`05-command-${results.filter((r) => r.finding === 5).length}`)
    await reset()
  }
  await modeless()
}
const modeless = async () => {
  await run('notepad')
  await app.type('Find text')
  await app.key('f', ['Control'])
  const selector = '[role="dialog"][aria-label="Find"]'
  const before = await read(`document.querySelector('${selector}').getBoundingClientRect().toJSON()`)
  const from = await app.center(
    `${selector} [data-titlebar]`.replace(' [data-titlebar]', ' > div:first-child'),
  )
  await app.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: from[0],
    y: from[1],
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })
  for (let step = 1; step <= 10; step++) {
    await app.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: from[0] + step * 8,
      y: from[1] + step * 5,
      button: 'none',
      buttons: 1,
    })
    await sleep(15)
  }
  const during = await read(`document.querySelector('${selector}').getBoundingClientRect().toJSON()`)
  check(
    16,
    'modeless Find holds still while an outline moves',
    during.x === before.x && during.y === before.y && (await exists('[data-outline]')),
    { before, during },
  )
  await shot('16-modeless-outline')
  await app.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: from[0] + 80,
    y: from[1] + 50,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
  await sleep(100)
  const after = await read(`document.querySelector('${selector}').getBoundingClientRect().toJSON()`)
  check(
    16,
    'modeless Find commits on release at whole pixels',
    after.x === before.x + 80 && after.y === before.y + 50 && Number.isInteger(before.x),
    after,
  )
}

const meta = async (key, shift = false) => {
  await app.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Meta',
    code: 'MetaLeft',
    windowsVirtualKeyCode: 91,
    modifiers: 4 | (shift ? 8 : 0),
  })
  if (key) {
    await app.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      code: `Key${key.toUpperCase()}`,
      windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0),
      modifiers: 4 | (shift ? 8 : 0),
    })
    await app.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code: `Key${key.toUpperCase()}`,
      windowsVirtualKeyCode: key.toUpperCase().charCodeAt(0),
      modifiers: 4 | (shift ? 8 : 0),
    })
  }
  await app.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Meta',
    code: 'MetaLeft',
    windowsVirtualKeyCode: 91,
    modifiers: 0,
  })
  await sleep(100)
}
const startItem = async (...items) => {
  await app.clickOn('[data-start-button]')
  for (const item of items) await clickText(item)
}
const shell = async () => {
  check(
    14,
    'fresh desktop excludes built-in game shortcuts and keeps Doom 95',
    await read(
      `![...document.querySelectorAll('[data-desktop-item]')].some(e=>['Minesweeper','Solitaire'].includes(e.getAttribute('aria-label')))&&!![...document.querySelectorAll('[data-desktop-item]')].find(e=>e.getAttribute('aria-label')==='Doom 95')`,
    ),
  )
  await shot('14-desktop')
  await startItem('Find', 'Computer...')
  check(6, 'Start Find Computer opens computer search', await exists('[aria-label="Find: Computer"]'))
  await shot('06-computer-search')
  if (!baseline) {
    await fill('[aria-label="Computer name"]', '*')
    await clickText('Find Now')
    check(
      6,
      'computer search finds the configured local computer',
      await read(`!!document.querySelector('[data-computer-result]')`),
    )
    await shot('06-computer-result')
  }
  await reset()
  await startItem('Find', 'On The Microsoft Network...')
  check(
    6,
    'MSN states that its component is unavailable',
    await read(`document.body.innerText.includes('The Microsoft Network is not installed.')`),
  )
  await shot('06-msn-unavailable')
  await reset()
  await app.clickOn('[data-desktop-item="app:network"]', { button: 'right' })
  await clickText('Find Computer...')
  check(7, 'Network Find opens computer search', await exists('[aria-label="Find: Computer"]'))
  await shot('07-network-find')
  await reset()
  for (const [item, title] of [
    ['mycomputer', 'System Properties'],
    ['network', 'Network'],
  ]) {
    await app.clickOn(`[data-desktop-item="app:${item}"]`)
    await app.key('Enter', ['Alt'])
    check(8, `${item} Alt+Enter opens Properties`, await exists(`[role="dialog"][aria-label="${title}"]`))
    await shot(`08-${item}-properties`)
    await reset()
  }
  await meta()
  check(9, 'Windows key tap opens Start', await exists('[aria-label="Start menu"]'))
  await app.key('Escape')
  await meta('r')
  check(9, 'Windows+R opens Run', await exists('#run-command'))
  await shot('09-windows-run')
  await reset()
  await meta('e')
  check(9, 'Windows+E opens Explorer', await exists('[data-window]'))
  await meta('m')
  check(
    9,
    'Windows+M minimizes windows',
    await read(
      `[...document.querySelectorAll('[data-window]')].every(e=>getComputedStyle(e).display==='none')`,
    ),
  )
  await meta('m', true)
  check(
    9,
    'Shift+Windows+M restores windows',
    await read(
      `[...document.querySelectorAll('[data-window]')].some(e=>getComputedStyle(e).display!=='none')`,
    ),
  )
  await meta('f')
  check(9, 'Windows+F opens file Find', await exists('[aria-label="Find: All Files"]'))
  await app.key('F11')
  await sleep(250)
  await meta('r')
  check(9, 'Windows+R also works in full screen', await exists('#run-command'))
  await shot('09-fullscreen-run')
  await app.key('F11')
  await reset()
  await app.clickOn('[data-desktop-item="app:mycomputer"]')
  await app.key('a', ['Control'])
  await app.clickOn('[data-desktop-item="app:mycomputer"]')
  check(
    10,
    'single click collapses desktop group selection',
    await read(`document.querySelectorAll('[data-desktop-item][aria-selected="true"]').length===1`),
  )
  await shot('10-single-selection')
  await run('notepad')
  const cursors = await read(
    `[...document.querySelectorAll('[data-window] > div')].filter(e=>/resize/.test(getComputedStyle(e).cursor)).map(e=>getComputedStyle(e).cursor)`,
  )
  check(
    11,
    'all four resize URLs are under assets',
    new Set(cursors.map((c) => c.match(/size\d_r/)?.[0]).filter(Boolean)).size === 4 &&
      cursors.every((c) => c.includes('/assets/')),
    cursors,
  )
  const taskCursor = await read(`getComputedStyle(document.querySelector('[data-taskbar-resize]')).cursor`)
  check(11, 'taskbar resize URL is under assets', taskCursor.includes('/assets/'), taskCursor)
  await shot('11-resize-window')
  await reset()
  for (const [label, appName] of [
    ['Bitmap Image', 'Paint'],
    ['WordPad Document', 'WordPad'],
  ]) {
    await app.click(700, 450, { button: 'right' })
    await clickText('New')
    const present = await read(
      `[...document.querySelectorAll('[role="menuitem"]')].some(e=>e.textContent.trim()===${JSON.stringify(label)})`,
    )
    check(15, `New includes ${label}`, present)
    if (present) {
      await clickText(label)
      await app.key('Enter')
      await app.key('Enter')
      await app.waitFor(`!!document.querySelector('[data-window]')`)
      check(
        15,
        `${label} opens in ${appName}`,
        await read(
          `[...document.querySelectorAll('[data-window]')].some(e=>e.getAttribute('aria-label').includes(${JSON.stringify(appName)}))&&!document.querySelector('[role="dialog"]')`,
        ),
      )
      await shot(`15-${appName.toLowerCase()}`)
    }
    await reset()
  }
  for (const label of ['Settings', 'Find']) {
    await startItem(label)
    const rows = await read(
      `[...document.querySelectorAll('[role="menu"]:not([aria-label="Start menu"]) > div > [role="menuitem"]')].map(e=>({label:e.textContent,icons:e.querySelectorAll('img').length,height:e.getBoundingClientRect().height,iconSize:e.querySelector('img')?.getBoundingClientRect().width}))`,
    )
    check(
      17,
      `${label} submenu has 16px icons and 20px rows`,
      rows.length === 3 && rows.every((r) => r.icons && r.height === 20 && r.iconSize === 16),
      rows,
    )
    await shot(`17-${label.toLowerCase()}-icons`)
    await reset()
  }
  await run('sol')
  await app.key('F1')
  check(
    'F1',
    'Solitaire F1 opens its help book',
    await read(
      `!![...document.querySelectorAll('[data-window]')].find(e=>e.getAttribute('aria-label').includes('Help Topics: Solitaire'))`,
    ),
  )
  await shot('f1-solitaire-help')
}

const power = async () => {
  await app.send('Page.reload')
  await sleep(600)
  await shot('13-boot')
  await app.waitFor(`!!document.querySelector('[data-desktop]')`)
  await startItem('Shut Down...')
  await app.clickOn('input[value="dos"]')
  await clickText('Yes')
  await sleep(250)
  check(
    12,
    'DOS restart hides the desktop, taskbar, and window chrome',
    (await exists('[data-dos-session]')) && !(await exists('[data-desktop],[data-taskbar],[data-window]')),
  )
  await shot('12-dos-session')
  if (!baseline) {
    await app.type('ver')
    await app.key('Enter')
    check(
      12,
      'DOS session runs the shared interpreter',
      await read(`document.querySelector('[data-dos-session]').textContent.includes('[Version 4.00.950]')`),
    )
    await app.type('win')
    await app.key('Enter')
    await app.waitFor(`!!document.querySelector('[data-desktop]')`)
    check(12, 'WIN returns to Windows', await exists('[data-taskbar]'))
    await shot('12-return-windows')
    await run('command.com')
    check(
      12,
      'ordinary DOS Prompt keeps its Windows chrome',
      (await exists('[data-window]')) && (await exists('[data-taskbar]')),
    )
    await shot('12-ordinary-dos-prompt')
  }
  await reset()
  await startItem('Shut Down...')
  await clickText('Yes')
  await sleep(500)
  await shot('13-shutdown')
  await app.waitFor(`document.body.textContent.includes("It's now safe to turn off your computer.")`)
  check(13, 'shutdown reaches the safe-to-turn-off artwork', true)
  await shot('13-safe-off')
}

try {
  await reset()
  if (phase === 'dialogs') await dialogs()
  if (phase === 'modeless') await modeless()
  if (phase === 'shell') await shell()
  if (phase === 'power') await power()
} finally {
  writeFileSync(
    join(proof, `${baseline ? 'before' : 'after'}-${phase}.json`),
    JSON.stringify(results, null, 2),
  )
  app.close()
}
if (!baseline) assert(results.length && results.every((r) => r.passed), 'all findings pass')
