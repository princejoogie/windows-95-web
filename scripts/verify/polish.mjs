// Run against Electron on W95_CDP_PORT (default 9420). Usage: node scripts/verify/polish.mjs <phase>
import assert from 'node:assert/strict'
import { appendFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const proof = resolve(process.env.W95_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/polish')
mkdirSync(proof, { recursive: true })
const c = await connect(Number(process.env.W95_CDP_PORT ?? 9420))
const q = JSON.stringify
const phase = process.argv[2] ?? 'menu'
const top = `[...document.querySelectorAll('[data-window]')].filter(w => !w.classList.contains('hidden')).sort((a,b) => Number(b.style.zIndex)-Number(a.style.zIndex))[0]`
const button = (label, scope = 'document') =>
  `[...(${scope}).querySelectorAll('button')].find(e => e.getAttribute('aria-label') === ${q(label)} || e.textContent.trim() === ${q(label)})`
const menuItem = (label) =>
  `[...document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')].find(e => e.textContent.replace('Checked','').replace(/\\s+/g,' ').trim().startsWith(${q(label)}))`
async function click(expression, options) {
  await c.waitFor(`!!(${expression})`)
  const xy = await c.eval(
    `(()=>{const b=(${expression}).getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await c.click(...xy, options)
}
async function reload() {
  await c.eval("document.documentElement.dataset.polishReload = 'pending'")
  await c.send('Page.reload')
  await c.waitFor(
    `!document.documentElement.dataset.polishReload && !!document.querySelector('[data-desktop-item]')`,
    10000,
  )
  await sleep(200)
}
async function fresh() {
  await c.eval(
    "addEventListener('beforeunload', () => localStorage.clear(), {once:true}); localStorage.clear()",
  )
  await reload()
}
async function run(command) {
  await click(`document.querySelector('[data-start-button]')`)
  await click(menuItem('Run...'))
  await c.waitFor(`!!document.querySelector('#run-command')`)
  await c.key('a', ['Control'])
  await c.type(command)
  await c.key('Enter')
  await sleep(350)
}
async function check(expression, name) {
  const detail = await c.eval(expression)
  assert.ok(detail, name)
  appendFileSync(`${proof}/checks.jsonl`, `${JSON.stringify({ phase, name, detail })}\n`)
  console.log(`PASS ${name}`)
}
const shot = (name) => c.shot(`${proof}/${name}.png`)
const option = (label, scope = top) =>
  `[...(${scope}).querySelectorAll('[role="option"]')].find(e => e.getAttribute('aria-label') === ${q(label)} || e.textContent.trim() === ${q(label)})`
const desktopItem = (label) =>
  `[...document.querySelectorAll('[data-desktop-item]')].find(e => e.getAttribute('aria-label') === ${q(label)})`
const saved = `JSON.parse(localStorage.getItem('w95.fs.v1'))`
const systemMenu = async () => {
  await c.key(' ', ['Alt'])
  await c.waitFor(`!!document.querySelector('[role="menu"]')`)
}
async function menu() {
  await fresh()
  await run('command')
  await systemMenu()
  await check(
    `JSON.stringify([...document.querySelectorAll('[role="menuitem"]')].map(e => e.textContent.replace('Checked','').replace('Alt+F4','').trim())) === JSON.stringify(['Restore','Move','Size','Minimize','Maximize','Close','Toolbar','Edit','Properties'])`,
    'DOS system-menu order',
  )
  await shot('01-dos-system-menu')
  await click(menuItem('Toolbar'))
  await check(
    `!document.querySelector('[aria-label="MS-DOS toolbar"]')`,
    'Toolbar hides from the system menu',
  )
  await systemMenu()
  await click(menuItem('Toolbar'))
  await check(
    `!!document.querySelector('[aria-label="MS-DOS toolbar"]')`,
    'Toolbar returns from the system menu',
  )
  await systemMenu()
  await click(menuItem('Edit'))
  await c.key('ArrowRight')
  await c.waitFor(`!!(${menuItem('Scroll')})`)
  await shot('01-dos-edit-menu')
  await click(menuItem('Mark'))
  await check(
    `(${top}).getAttribute('aria-label') === 'Mark - MS-DOS Prompt'`,
    'System Edit Mark enters marking mode',
  )
  await c.key('ArrowRight', ['Shift'])
  await shot('01-dos-mark-selection')
  await systemMenu()
  await click(menuItem('Edit'))
  await c.key('ArrowRight')
  await click(menuItem('Copy'))
  await check(
    `(async () => (await navigator.clipboard.readText()) === 'Mi')()`,
    'System Edit Copy writes the selected DOS text',
  )
  await systemMenu()
  await click(menuItem('Edit'))
  await c.key('ArrowRight')
  await click(menuItem('Paste'))
  await check(
    `document.querySelector('[aria-label="MS-DOS command line"]').value === 'Mi'`,
    'System Edit Paste inserts the copied text',
  )
  await c.key('Escape')
  await systemMenu()
  await click(menuItem('Edit'))
  await c.key('ArrowRight')
  await click(menuItem('Scroll'))
  await check(
    `(${top}).getAttribute('aria-label') === 'Scroll - MS-DOS Prompt'`,
    'System Edit Scroll enters scroll mode',
  )
  await shot('01-dos-scroll')
  await c.key('Escape')
  await systemMenu()
  await click(menuItem('Properties'))
  await check(
    `!!document.querySelector('[role="dialog"][aria-label="MS-DOS Prompt Properties"]')`,
    'System Properties opens DOS properties',
  )
  await shot('01-dos-properties')
}

async function help() {
  await fresh()
  await run('winhlp32')
  await check(
    `JSON.stringify([...(${top}).children[0].querySelectorAll('button')].map(e=>e.getAttribute('aria-label'))) === JSON.stringify(['Help','Close'])`,
    'Help Topics caption has only Help and Close',
  )
  await check(
    `getComputedStyle(${top}).padding === '3px' && !(${top}).querySelector('[style*="cursor:"]')`,
    'Help Topics has a fixed dialog frame without resize handles',
  )
  await shot('02-help-topics-caption')
  await click(button('Help', top))
  await check(
    `!!document.querySelector('[role="dialog"][aria-label="Windows Help"]')`,
    'Caption Help explains the Help Topics tabs',
  )
  await shot('02-help-caption-help')
  await click(button('OK'))
  await click(button('Close', top))
  await check(`!document.querySelector('[data-window]')`, 'Help Topics closes from the caption')
}

async function desktopUndo() {
  await fresh()
  await click(desktopItem('Minesweeper'))
  await c.key('c', ['Control'])
  await c.click(900, 600)
  await c.key('v', ['Control'])
  await sleep(350)
  await check(
    `Object.values((${saved}).nodes).some(n => n.name === 'Copy of Minesweeper')`,
    'Desktop Paste creates the copy',
  )
  await c.click(900, 600, { button: 'right' })
  await check(`!!(${menuItem('Undo Copy')})`, 'Desktop offers Undo Copy')
  await shot('04-desktop-undo-copy')
  await c.key('Escape')
  await c.key('z', ['Control'])
  await sleep(350)
  await check(
    `!Object.values((${saved}).nodes).some(n => n.name === 'Copy of Minesweeper')`,
    'Desktop Ctrl+Z removes the pasted copy',
  )

  await run('C:\\My Documents')
  await click(option('Readme.txt'))
  await c.key('x', ['Control'])
  await click(button('Close', top))
  await c.click(900, 600)
  await c.key('v', ['Control'])
  await sleep(350)
  await check(`(${saved}).nodes.readme.parent === 'desktop'`, 'Desktop Paste moves a cut file')
  await c.click(900, 600, { button: 'right' })
  await check(`!!(${menuItem('Undo Move')})`, 'Desktop offers Undo Move')
  await shot('04-desktop-undo-move')
  await c.key('Escape')
  await c.key('z', ['Control'])
  await sleep(350)
  await check(`(${saved}).nodes.readme.parent === 'documents'`, 'Desktop Ctrl+Z returns the moved file')

  await run('C:\\My Documents')
  await click(option('Readme.txt'))
  await c.key('Delete')
  await c.key('y')
  await sleep(350)
  const record = await c.eval(`(${saved}).recycled.readme`)
  assert.ok(record)
  await click(button('Close', top))
  await run('recycle')
  await click(option('Readme.txt'))
  await c.key('x', ['Control'])
  await click(button('Close', top))
  await c.click(900, 600)
  await c.key('v', ['Control'])
  await sleep(350)
  await check(
    `(${saved}).nodes.readme.parent === 'desktop' && !(${saved}).recycled.readme`,
    'Cut out of the bin clears the active recycle record',
  )
  await c.key('z', ['Control'])
  await sleep(350)
  await check(
    `(${saved}).nodes.readme.parent === 'recycled' && JSON.stringify((${saved}).recycled.readme) === ${q(JSON.stringify(record))}`,
    'Undo Move restores the original recycle record',
  )
  await run('recycle')
  await click(option('Readme.txt'))
  await c.key('Enter', ['Alt'])
  await shot('04-bin-undo-record')
  await c.key('Escape')
  await click(option('Readme.txt'), { button: 'right' })
  await click(menuItem('Restore'))
  await sleep(350)
  await check(
    `(${saved}).nodes.readme.parent === 'documents' && !(${saved}).recycled.readme`,
    'Restore after Undo returns to My Documents',
  )
}

async function shortcut() {
  await fresh()
  const openSheet = async () => {
    await click(desktopItem('Minesweeper'), { button: 'right' })
    await click(menuItem('Properties'))
    await click(
      `document.querySelector('[role="tab"][id$="-Shortcut"]') ?? [...document.querySelectorAll('[role="tab"]')].find(e => e.textContent === 'Shortcut')`,
    )
    await click(`document.querySelector('[aria-label="Shortcut key"]')`)
  }
  await openSheet()
  await c.key('k', ['Control', 'Alt'])
  await check(
    `document.querySelector('[aria-label="Shortcut key"]').value === 'Ctrl + Alt + K'`,
    'Shortcut key captures Ctrl+Alt+K',
  )
  await shot('04-shortcut-key')
  await click(button('OK'))
  await sleep(350)
  await check(
    `Object.values((${saved}).nodes).some(n=>n.name === 'Minesweeper' && n.parent === 'desktop' && n.shortcutKey === 'K')`,
    'Shortcut key is saved on the shortcut',
  )
  await run('notepad')
  await c.type('The global shortcut works while Notepad owns focus.')
  await c.key('k', ['Control', 'Alt'])
  await check(
    `(${top}).getAttribute('aria-label') === 'Minesweeper'`,
    'Ctrl+Alt+K launches Minesweeper from another app',
  )
  await shot('04-global-shortcut-launch')
  await reload()
  await c.key('k', ['Control', 'Alt'])
  await c.waitFor(`!!document.querySelector('[data-window][aria-label="Minesweeper"]')`)
  await check(
    `(${top}).getAttribute('aria-label') === 'Minesweeper'`,
    'Shortcut key still launches after a reload',
  )
  await click(button('Close', top))
  await openSheet()
  await c.key('Delete')
  await click(button('OK'))
  await c.key('k', ['Control', 'Alt'])
  await check(`!document.querySelector('[data-window]')`, 'Clearing Shortcut key disables the global launch')
}

async function capacity() {
  await fresh()
  await sleep(350)
  await c.eval(`addEventListener('beforeunload',()=>{
    const state=${saved};
    for(const [index,name] of ['Oldest','Newest'].entries()) {
      const id='capacity-'+index;
      state.nodes[id]={id,name,parent:'desktop',kind:'folder',modified:index};
      for(let n=0;n<10;n++) {
        const child=id+'-'+n;
        state.nodes[child]={id:child,name:'PAINT'+n+'.EXE',parent:id,kind:'program',app:'paint',modified:0};
      }
    }
    localStorage.setItem('w95.fs.v1',JSON.stringify(state));
  },{once:true})`)
  await reload()
  await c.waitFor(`!!(${desktopItem('Oldest')})`, 10000)
  await click(desktopItem('Recycle Bin'), { button: 'right' })
  await click(menuItem('Properties'))
  await click(`document.querySelector('[role="slider"]')`)
  await c.key('Home')
  await c.key('ArrowRight')
  await shot('04-bin-one-percent')
  await click(button('OK'))
  for (const name of ['Oldest', 'Newest']) {
    await click(desktopItem(name))
    await c.key('Delete')
    await c.key('y')
    await sleep(350)
    if (name === 'Oldest')
      await check(`!!(${saved}).nodes['capacity-0']`, 'The first 3MB deletion fits within the 1% limit')
  }
  await check(
    `!(${saved}).nodes['capacity-0'] && !(${saved}).nodes['capacity-0-0'] && !!(${saved}).nodes['capacity-1'] && !!(${saved}).recycled['capacity-1']`,
    'Overflow evicts the oldest folder and its files, retaining the newer deletion',
  )
  await run('recycle')
  await shot('04-bin-oldest-evicted')
  await click(button('Close', top))
  await click(desktopItem('Recycle Bin'), { button: 'right' })
  await click(menuItem('Properties'))
  await click(`document.querySelector('[role="slider"]')`)
  await c.key('Home')
  await click(button('OK'))
  await sleep(350)
  await check(
    `!(${saved}).nodes['capacity-1'] && Object.keys((${saved}).recycled).length === 0`,
    'Applying a smaller limit immediately evicts excess contents',
  )
  await shot('04-bin-limit-reduced')
}

async function abouts() {
  await fresh()
  await run('freecell')
  await click(button('Help', `${top}.querySelector('[role="menubar"]')`))
  await click(menuItem('About FreeCell...'))
  await check(
    `document.querySelector('[role="dialog"][aria-label="About FreeCell"]').textContent.includes('by Jim Horne')`,
    'FreeCell uses the shared About box and retains its author credit',
  )
  await shot('05-freecell-about')
  await click(button('OK'))
  await check(`!document.querySelector('[role="dialog"]')`, 'FreeCell About closes with OK')
  await fresh()
  await run('mshearts')
  await c.waitFor(`!!document.querySelector('[role="dialog"][aria-label="The Microsoft Hearts Network"]')`)
  await click(
    `document.querySelector('[role="dialog"] input[type="text"], [role="dialog"] input:not([type])')`,
  )
  await c.key('a', ['Control'])
  await c.type('Polish Player')
  await click(
    `[...document.querySelectorAll('[role="dialog"] label')].find(e => e.textContent.includes('I want to be dealer'))`,
  )
  await shot('05-hearts-name-dialog')
  await click(button('OK'))
  await check(
    `!!document.querySelector('.hearts-hand') && document.querySelector('[data-name="0"]').textContent === 'Polish Player'`,
    'Hearts starts a local game after the name dialog',
  )
  await click(button('Help', `${top}.querySelector('[role="menubar"]')`))
  await click(menuItem('About Hearts'))
  await check(
    `document.querySelector('[role="dialog"][aria-label="About Hearts"]').textContent.includes('Microsoft Hearts')`,
    'Hearts opens the shared About box after the name dialog',
  )
  await shot('05-hearts-about')
  await click(button('OK'))
  await check(
    `!document.querySelector('[role="dialog"]') && !!document.querySelector('.hearts-hand')`,
    'Hearts returns to the dealt hand after About closes',
  )
}

try {
  if (phase === 'menu') await menu()
  else if (phase === 'help') await help()
  else if (phase === 'undo') await desktopUndo()
  else if (phase === 'shortcut') await shortcut()
  else if (phase === 'capacity') await capacity()
  else if (phase === 'abouts') await abouts()
  else throw new Error(`Unknown phase ${phase}`)
} finally {
  c.close()
}
