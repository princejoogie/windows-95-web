// The Open/Save dialog phase of shellfix-s2.mjs: findings 26, 27, 28, 41, and 42.
import { sleep } from './cdp.mjs'

export async function dialogPhase(t) {
  const { app, check, shot, exists, pickMenu, closeWindows, openStartItem } = t
  const dialog = '[role="dialog"][aria-label="Save As"]'
  const inDialog = (selector) => `${dialog} ${selector}`
  const entries = () =>
    app.eval(
      `[...document.querySelectorAll('${dialog} [role="listbox"][aria-label="Folder contents"] [role="option"]')].map(e => (e.getAttribute('aria-selected') === 'true' ? '*' : '') + e.textContent)`,
    )
  const lookIn = () => app.eval(`document.querySelector('${dialog} [role="combobox"]').textContent`)
  const clipDialog = () =>
    app.eval(
      `(()=>{const b=document.querySelector('${dialog}').getBoundingClientRect();return {x:b.x-2,y:b.y-2,width:b.width+4,height:b.height+4}})()`,
    )

  await openStartItem('Run...')
  await app.waitFor(`!!document.querySelector('#run-command')`)
  await app.type('notepad')
  await app.key('Enter')
  await app.waitFor(`!!document.querySelector('[data-window] textarea')`)
  await app.type('dialog proof')
  const file = await app.eval(
    `(()=>{const b=[...document.querySelectorAll('[data-window] [role="menubar"] button')].find(e=>e.textContent==='File').getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await app.click(...file)
  await pickMenu('Save As...')
  await app.waitFor(`!!document.querySelector('${dialog}')`)

  // 42: toolbar, labels.
  const toolbar = await app.eval(
    `[...document.querySelectorAll('${dialog} button[aria-label]')].filter(b=>b.getAttribute('aria-label')!=='Close').map(b=>{const r=b.getBoundingClientRect();return b.getAttribute('aria-label')+' '+r.width+'x'+r.height})`,
  )
  check(
    JSON.stringify(toolbar) ===
      JSON.stringify(['Up One Level 23x22', 'Create New Folder 23x22', 'List 23x22', 'Details 23x22']),
    '42',
    'four 23x22 toolbar buttons: Up One Level, Create New Folder, List, Details',
    toolbar,
  )
  const labels = await app.eval(`[...document.querySelectorAll('${dialog} label')].map(l=>l.textContent)`)
  check(
    labels.includes('Save in:') && labels.includes('Save as type:') && labels.includes('File name:'),
    '42',
    'Save mode says Save in and Save as type',
    labels,
  )
  check(!(await exists(inDialog('select'))), '26', 'no native select is left in the dialog')
  await shot('42-save-as', await clipDialog())

  // 26: the Look in combo box.
  await app.clickOn(inDialog('[role="combobox"]'))
  await app.waitFor(`!!document.querySelector('body > [role="listbox"]')`)
  const rows = await app.eval(
    `[...document.querySelectorAll('body > [role="listbox"] [role="option"]')].map(o=>{const s=o.firstElementChild;return {label:o.textContent,indent:parseInt(s.style.paddingLeft),icon:!!o.querySelector('img'),height:o.getBoundingClientRect().height}})`,
  )
  check(
    rows.map((row) => row.label).join('|') === 'Desktop|My Computer|(C:)|My Documents' &&
      rows.every((row, index) => row.indent === [2, 12, 22, 32][index] && row.icon && row.height === 16),
    '26',
    'Look in drops a tree: Desktop, My Computer, (C:), My Documents, 10px per level, 16px rows with icons',
    rows,
  )
  const box = await clipDialog()
  await shot('26-look-in-dropdown', { ...box, height: box.height + 60 })
  await app.key('Escape')
  check(
    (await exists(dialog)) && !(await exists('body > [role="listbox"]')),
    '26',
    'Esc closes the drop-down, not the dialog',
  )
  await app.key('ArrowDown', ['Alt'])
  await app.key('ArrowUp')
  await app.key('Enter')
  check((await lookIn()) === '(C:)', '26', 'Alt+Down, Up, Enter picks (C:) from the keyboard')

  // 27: RECYCLED stays hidden.
  const root = await entries()
  check(
    !root.some((entry) => entry.includes('RECYCLED')) && root.includes('WINDOWS'),
    '27',
    'C:\\ lists no RECYCLED folder',
    root,
  )
  await shot('27-root-no-recycled', await clipDialog())

  // 28 and 41: keyboard in the file list, label-only highlight.
  await app.clickOn(`${dialog} [role="option"]`)
  await app.key('ArrowDown')
  const moved = await entries()
  check(moved[1]?.startsWith('*'), '28', 'ArrowDown moves the selection', moved)
  await app.key('m')
  const typed = await entries()
  check(
    typed.find((entry) => entry.startsWith('*')) === '*My Documents',
    '28',
    'typing a letter jumps to the matching name',
    typed,
  )
  await app.key('Enter')
  check((await lookIn()) === 'My Documents', '28', 'Enter on a folder opens it')
  await app.key('ArrowDown')
  const name = await app.eval(`document.querySelector('${dialog} input[id$="-name"]').value`)
  check(name === 'Readme.txt', '28', 'the file name box follows the selected file', name)
  const highlight = await app.eval(
    `(()=>{const o=document.querySelector('${dialog} [role="option"][aria-selected="true"]');const label=o.querySelector('span');return {row:getComputedStyle(o).backgroundColor,label:getComputedStyle(label).backgroundColor,labelWidth:Math.round(label.getBoundingClientRect().width),rowWidth:Math.round(o.getBoundingClientRect().width),frame:!!label.querySelector('.dotted-frame')}})()`,
  )
  check(
    highlight.row === 'rgba(0, 0, 0, 0)' &&
      highlight.label === 'rgb(0, 0, 128)' &&
      highlight.labelWidth < highlight.rowWidth &&
      highlight.frame,
    '41',
    'only the label is navy, with the XOR focus frame around it',
    highlight,
  )
  await shot('41-list-selection', await clipDialog())
  await app.key('Backspace')
  check((await lookIn()) === '(C:)', '28', 'Backspace goes up one level')

  // 42: List and Details, Create New Folder.
  await app.clickOn(`${dialog} button[aria-label="Details"]`)
  const header = await app.eval(
    `[...document.querySelectorAll('${dialog} .sticky > div')].map(d=>d.textContent)`,
  )
  check(
    JSON.stringify(header) === JSON.stringify(['Name', 'Size', 'Type', 'Modified']),
    '42',
    'Details shows Name, Size, Type, Modified',
    header,
  )
  await shot('42-details', await clipDialog())
  await app.clickOn(`${dialog} button[aria-label="List"]`)
  await app.clickOn(`${dialog} button[aria-label="Up One Level"]`)
  check((await lookIn()) === 'My Computer', '42', 'Up One Level from C:\\ goes to My Computer')
  await app.clickOn(`${dialog} button[aria-label="Up One Level"]`)
  const desktop = await entries()
  check(
    (await lookIn()) === 'Desktop' && desktop[0] === 'My Computer',
    '42',
    'and then to the Desktop',
    desktop,
  )
  await app.click(...(await app.center(`${dialog} [role="option"]`)), { count: 2 })
  await app.click(...(await app.center(`${dialog} [role="option"]`)), { count: 2 })
  await app.click(...(await app.center(`${dialog} [role="option"]`)), { count: 2 })
  check((await lookIn()) === 'My Documents', '28', 'double-clicks walk My Computer > (C:) > My Documents')
  await app.clickOn(`${dialog} button[aria-label="Create New Folder"]`)
  await app.waitFor(`!!document.querySelector('${dialog} [role="listbox"] input')`)
  await app.type('Proofs')
  await app.key('Enter')
  await sleep(200)
  check((await entries()).includes('*Proofs'), '42', 'Create New Folder starts a rename and keeps the name')
  await shot('42-new-folder', await clipDialog())

  // Save into the new folder through the keyboard.
  await app.key('Enter')
  check((await lookIn()) === 'Proofs', '28', 'Enter opens the new folder')
  await app.clickOn(`${dialog} input[id$="-name"]`)
  await app.key('a', ['Control'])
  await app.type('proof.txt')
  await app.key('Enter')
  await sleep(300)
  check(
    !(await exists(dialog)) &&
      (await app.eval(`document.querySelector('[data-window]').getAttribute('aria-label')`)) ===
        'proof.txt - Notepad',
    '28',
    'Save writes proof.txt into the chosen folder',
  )
  await closeWindows()
}
