// The desktop phase of shellfix-s2.mjs: findings 16 to 19, 46, and missing pieces 6 to 9.
import { sleep } from './cdp.mjs'

export async function desktopPhase(t) {
  const { app, check, shot, exists, text, pickMenu, hover, menuLabels, selectedKeys, fsNodes, flushFs } = t
  const { clickDesktop, rightClick, closeMenus, closeWindows } = t
  const label = (key) =>
    app.eval(`document.querySelector('[data-desktop-item="${key}"]')?.textContent ?? null`)
  const keyByLabel = (name) =>
    app.eval(
      `[...document.querySelectorAll('[data-desktop-item]')].find(e => e.textContent === ${JSON.stringify(name)})?.dataset.desktopItem ?? null`,
    )
  const iconAt = async (key) => app.center(`[data-desktop-item="${key}"] img`)

  // 16: the Windows 95 default desktop.
  const keys = await app.eval(
    `[...document.querySelectorAll('[data-desktop-item]')].map(e => e.dataset.desktopItem)`,
  )
  check(
    keys[0] === 'app:mycomputer' && keys[1] === 'app:network' && keys[2] === 'app:recyclebin',
    '16',
    'My Computer, Network Neighborhood, Recycle Bin lead the desktop',
    keys,
  )
  const readmes = (await fsNodes()).filter((n) => n.name === 'Readme.txt').map((n) => n.parent)
  check(
    !keys.some((key) => key.includes('readme')) && readmes.length === 1 && readmes[0] === 'documents',
    '16',
    'Readme.txt lives only in My Documents',
    readmes,
  )
  await shot('16-desktop')

  // Missing 9: Network Neighborhood opens a folder showing an empty Entire Network.
  await app.click(...(await iconAt('app:network')), { count: 2 })
  await app.waitFor(`!!document.querySelector('[data-window][aria-label="Network Neighborhood"]')`)
  const hood = await app.eval(
    `[document.querySelector('[data-window] [role="option"]')?.textContent, [...document.querySelectorAll('[data-window] *')].find(e => /object\\(s\\)$/.test(e.textContent) && e.children.length === 0)?.textContent]`,
  )
  check(
    hood[0] === 'Entire Network' && hood[1] === '1 object(s)',
    'M9',
    'Network Neighborhood lists Entire Network',
    hood,
  )
  await shot('M9-network-neighborhood')
  await app.click(...(await app.center('[data-window] [role="option"] img')), { count: 2 })
  await app.waitFor(`!!document.querySelector('[data-window][aria-label="Entire Network"]')`)
  const entire = await app.eval(
    `[document.querySelectorAll('[data-window] [role="option"]').length, [...document.querySelectorAll('[data-window] *')].find(e => /object\\(s\\)$/.test(e.textContent) && e.children.length === 0)?.textContent]`,
  )
  check(entire[0] === 0 && entire[1] === '0 object(s)', 'M9', 'Entire Network is empty', entire)
  await shot('M9-entire-network')
  await closeWindows()

  // 17: arrow keys, type-ahead, F2 on a shell icon, Shift+F10.
  await app.click(...(await iconAt('app:mycomputer')))
  await app.key('ArrowDown')
  check((await selectedKeys())[0] === 'app:network', '17', 'ArrowDown moves to Network Neighborhood')
  await app.key('r')
  check((await selectedKeys())[0] === 'app:recyclebin', '17', 'typing r jumps to Recycle Bin')
  await sleep(1100)
  await app.key('m')
  const firstM = (await selectedKeys())[0]
  await app.key('m')
  const secondM = (await selectedKeys())[0]
  check(
    firstM === 'lnk:minesweeper' && secondM === 'app:mycomputer',
    '17',
    'repeating m cycles through the M icons',
    [firstM, secondM],
  )
  await app.key('ArrowDown', ['Control'])
  const focusOnly = await app.eval(
    `[[...document.querySelectorAll('[data-desktop-item][aria-selected="true"]')].map(e=>e.dataset.desktopItem), [...document.querySelectorAll('[data-desktop-item] [data-label]')].find(e => e.className.includes('outline-dotted'))?.textContent]`,
  )
  check(
    focusOnly[0].length === 1 &&
      focusOnly[0][0] === 'app:mycomputer' &&
      focusOnly[1] === 'Network Neighborhood',
    '17',
    'Ctrl+ArrowDown moves the focus box without selecting',
    focusOnly,
  )
  await shot('17-ctrl-arrow-focus', { x: 0, y: 0, width: 160, height: 220 })
  await app.key('ArrowUp')
  await app.key('F2')
  await app.waitFor(`!!document.querySelector('[data-desktop-item="app:mycomputer"] input')`)
  await app.key('a', ['Control'])
  await app.type('Workstation')
  await app.key('Enter')
  check((await label('app:mycomputer')) === 'Workstation', '17', 'F2 renames My Computer')
  await app.key('F2')
  await app.waitFor(`!!document.querySelector('[data-desktop-item="app:mycomputer"] input')`)
  await app.key('a', ['Control'])
  await app.type('My Computer')
  await app.key('Enter')
  await app.key('F10', ['Shift'])
  await app.waitFor(`!!document.querySelector('[role="menu"]')`)
  const shiftF10 = await menuLabels()
  check(shiftF10[0] === 'Open', '17', 'Shift+F10 opens the icon menu', shiftF10)
  await closeMenus()

  // 19: the full menus.
  await rightClick([700, 400])
  const background = await menuLabels()
  check(
    JSON.stringify(background) ===
      JSON.stringify([
        'Arrange Icons',
        'Line up Icons',
        '---',
        '~Paste',
        '~Paste Shortcut',
        '---',
        'New',
        '---',
        'Properties',
      ]),
    '19',
    'desktop menu matches Windows 95',
    background,
  )
  await hover('Arrange Icons')
  const arrange = await menuLabels()
  check(
    JSON.stringify(arrange) ===
      JSON.stringify(['by Name', 'by Type', 'by Size', 'by Date', '---', 'Auto Arrange']),
    '19',
    'Arrange Icons offers Name, Type, Size, Date, and Auto Arrange',
    arrange,
  )
  await shot('19-desktop-arrange')
  await hover('New')
  const newItems = await menuLabels()
  check(
    JSON.stringify(newItems) === JSON.stringify(['Folder', 'Shortcut', '---', 'Text Document']),
    '19',
    'New offers Folder, Shortcut, and Text Document',
    newItems,
  )
  await shot('19-desktop-new')
  await closeMenus()
  await rightClick('[data-desktop-item="app:mycomputer"] img')
  const computer = await menuLabels()
  check(
    JSON.stringify(computer) ===
      JSON.stringify([
        'Open',
        'Explore',
        '~Find...',
        '---',
        '~Map Network Drive...',
        '~Disconnect Network Drive...',
        '---',
        'Create Shortcut',
        'Rename',
        '---',
        '~Properties',
      ]),
    '19',
    'My Computer has its own menu with no Delete',
    computer,
  )
  await shot('19-mycomputer-menu')
  await closeMenus()
  await rightClick('[data-desktop-item="app:recyclebin"] img')
  const bin = await menuLabels()
  check(
    JSON.stringify(bin) ===
      JSON.stringify([
        'Open',
        'Explore',
        '~Empty Recycle Bin',
        '---',
        'Create Shortcut',
        '---',
        '~Properties',
      ]),
    '19',
    'Recycle Bin menu has Empty Recycle Bin, disabled while empty',
    bin,
  )
  await closeMenus()

  // New > Text Document, then the file menu.
  await rightClick([700, 300])
  await pickMenu('New')
  await pickMenu('Text Document')
  await app.waitFor(`!!document.querySelector('[data-desktop-item] input')`)
  await app.type('Letter')
  await app.key('Enter')
  await flushFs()
  const letter = await keyByLabel('Letter.txt')
  check(letter !== null, '19', 'New > Text Document creates a file at the click point', letter)
  await rightClick(`[data-desktop-item="${letter}"] img`)
  const file = await menuLabels()
  check(
    JSON.stringify(file) ===
      JSON.stringify([
        'Open',
        '~Print',
        '---',
        'Send To',
        '---',
        'Cut',
        'Copy',
        '---',
        'Create Shortcut',
        'Delete',
        'Rename',
        '---',
        'Properties',
      ]),
    '19',
    'a file has Open, Send To, Cut, Copy, Create Shortcut, Delete, Rename, and Properties',
    file,
  )
  await shot('19-file-menu')
  await closeMenus()

  // 46: slow double-click renames.
  await app.click(...(await iconAt(letter)))
  await sleep(700)
  const labelAt = await app.center(`[data-desktop-item="${letter}"] [data-label]`)
  await app.click(...labelAt)
  check(
    !(await exists(`[data-desktop-item="${letter}"] input`)),
    '46',
    'no rename before the double-click time passes',
  )
  await sleep(650)
  check(
    await exists(`[data-desktop-item="${letter}"] input`),
    '46',
    'a slow second click on the label starts a rename',
  )
  await shot('46-slow-click-rename', { x: 600, y: 230, width: 200, height: 140 })
  await app.key('Escape')
  await app.click(...(await iconAt(letter)), { count: 2 })
  await app.waitFor(`!!document.querySelector('[data-window] textarea')`)
  check(
    !(await exists(`[data-desktop-item="${letter}"] input`)),
    '46',
    'a quick double-click opens instead of renaming',
  )
  await app.type('Dear Bill,')
  await app.key('s', ['Control'])
  await sleep(300)
  await closeWindows()
  await flushFs()

  // Missing 6: copy, paste, cut, shortcuts, Send To.
  await app.click(...(await iconAt(letter)))
  await app.key('c', ['Control'])
  await app.key('v', ['Control'])
  await flushFs()
  const copyKey = await keyByLabel('Copy of Letter.txt')
  check(copyKey !== null, 'M6', 'Ctrl+C, Ctrl+V on the desktop makes Copy of Letter.txt')
  await rightClick(`[data-desktop-item="${letter}"] img`)
  await pickMenu('Create Shortcut')
  await flushFs()
  const linkKey = await keyByLabel('Shortcut to Letter.txt')
  const overlay = await app.eval(
    `document.querySelectorAll('[data-desktop-item="${linkKey}"] [data-icon] img').length`,
  )
  check(
    linkKey !== null && overlay === 2,
    'M6',
    'Create Shortcut adds Shortcut to Letter.txt with the arrow overlay',
    overlay,
  )
  await shot('M6-copy-and-shortcut')
  await app.click(...(await iconAt(linkKey)), { count: 2 })
  await app.waitFor(`!!document.querySelector('[data-window] textarea')`)
  const opened = await app.eval(`document.querySelector('[data-window] textarea').value`)
  check(opened.startsWith('Dear Bill,'), 'M6', 'the shortcut opens its target in Notepad', opened)
  await closeWindows()
  await rightClick([700, 450])
  await pickMenu('New')
  await pickMenu('Folder')
  await app.waitFor(`!!document.querySelector('[data-desktop-item] input')`)
  await app.type('Drafts')
  await app.key('Enter')
  await flushFs()
  const drafts = await keyByLabel('Drafts')
  await app.click(...(await iconAt(copyKey)))
  await app.key('x', ['Control'])
  const ghost = await app.eval(
    `getComputedStyle(document.querySelector('[data-desktop-item="${copyKey}"] [data-icon] img')).maskImage`,
  )
  check(ghost.includes('repeating-conic-gradient'), 'M6', 'a cut icon is drawn ghosted', ghost.slice(0, 40))
  await shot('M6-cut-ghosted')
  await rightClick(`[data-desktop-item="${drafts}"] img`)
  await pickMenu('Paste')
  await flushFs()
  const moved = (await fsNodes()).find((n) => n.name === 'Copy of Letter.txt')
  check(
    moved?.parent === drafts && !(await keyByLabel('Copy of Letter.txt')),
    'M6',
    'Paste on a folder moves the cut file into it',
  )
  await rightClick(`[data-desktop-item="${letter}"] img`)
  await hover('Send To')
  await pickMenu('My Documents')
  await flushFs()
  check(
    (await fsNodes()).some((n) => n.name === 'Letter.txt' && n.parent === 'documents'),
    'M6',
    'Send To > My Documents copies the file there',
  )
  await rightClick(`[data-desktop-item="${letter}"] img`)
  await pickMenu('Copy')
  await rightClick([850, 120])
  await pickMenu('Paste Shortcut')
  await flushFs()
  check(await keyByLabel('Shortcut (2) to Letter.txt'), 'M6', 'Paste Shortcut numbers the second shortcut')

  // Missing 7: the Properties sheet, by menu and by Alt+Enter.
  await rightClick(`[data-desktop-item="${letter}"] img`)
  await pickMenu('Properties')
  await app.waitFor(`!!document.querySelector('[role="dialog"][aria-label="Letter.txt Properties"]')`)
  const sheet = await app.eval(
    `(()=>{const d=document.querySelector('[role="dialog"][aria-label="Letter.txt Properties"]');const rows=Object.fromEntries([...d.querySelectorAll('div.flex.min-h-\\\\[16px\\\\]')].map(r=>[r.children[0].textContent,r.children[1].textContent]));const boxes=Object.fromEntries([...d.querySelectorAll('input[type=checkbox]')].map(c=>[c.parentElement.textContent,[c.checked,c.disabled]]));return {tab:d.querySelector('[role=tab]')?.textContent,name:d.querySelector('input[aria-label=Name]')?.value,rows,boxes}})()`,
  )
  check(
    sheet.tab === 'General' &&
      sheet.name === 'Letter.txt' &&
      sheet.rows['Type:'] === 'Text Document' &&
      sheet.rows['Location:'] === 'C:\\WINDOWS\\Desktop' &&
      sheet.rows['Size:'] === '10 bytes' &&
      sheet.rows['MS-DOS name:'] === 'LETTER.TXT' &&
      Boolean(sheet.rows['Created:']) &&
      Boolean(sheet.rows['Modified:']) &&
      Boolean(sheet.rows['Accessed:']) &&
      sheet.boxes.Archive[0] === true &&
      sheet.boxes.System[1] === true,
    'M7',
    'the General tab shows type, location, size, 8.3 name, dates, and attributes',
    sheet,
  )
  await shot('M7-properties')
  await app.key('Escape')
  await app.click(...(await iconAt(linkKey)))
  await app.key('Enter', ['Alt'])
  await app.waitFor(
    `!!document.querySelector('[role="dialog"][aria-label="Shortcut to Letter.txt Properties"]')`,
  )
  const dos = await app.eval(
    `[...document.querySelectorAll('[role="dialog"] div.flex.min-h-\\\\[16px\\\\]')].find(r=>r.children[0].textContent==='MS-DOS name:')?.children[1].textContent`,
  )
  check(dos === 'SHORTC~1.LNK', 'M7', 'Alt+Enter opens Properties; a shortcut gets an 8.3 .LNK name', dos)
  const hiddenBox = await app.eval(
    `(()=>{const c=[...document.querySelectorAll('[role="dialog"] input[type=checkbox]')].find(c=>c.parentElement.textContent==='Hidden');const b=c.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
  )
  await app.click(...hiddenBox)
  await app.clickOn('[role="dialog"] button[type="submit"]')
  await flushFs()
  check(!(await keyByLabel('Shortcut to Letter.txt')), 'M7', 'checking Hidden and OK hides the shortcut')

  // Missing 8: Empty Recycle Bin.
  await app.click(...(await iconAt(letter)))
  await app.key('Delete')
  await app.waitFor(`!!document.querySelector('[role="dialog"][aria-label="Confirm File Delete"]')`)
  await app.key('y')
  await app.click(...(await iconAt(drafts)))
  await app.key('Delete')
  await app.waitFor(`!!document.querySelector('[role="dialog"][aria-label="Confirm Folder Delete"]')`)
  await app.key('y')
  await flushFs()
  const binFull = await app.eval(`document.querySelector('[data-desktop-item="app:recyclebin"] img').src`)
  await rightClick('[data-desktop-item="app:recyclebin"] img')
  await pickMenu('Empty Recycle Bin')
  await app.waitFor(`!!document.querySelector('[role="dialog"][aria-label="Confirm Multiple File Delete"]')`)
  const question = await text('[role="dialog"][aria-label="Confirm Multiple File Delete"] p')
  check(
    /^Are you sure you want to delete these \d+ items\?$/.test(question),
    'M8',
    'Empty Recycle Bin asks Confirm Multiple File Delete',
    question,
  )
  await shot('M8-empty-confirm')
  await app.key('y')
  await flushFs()
  const after = await app.eval(`document.querySelector('[data-desktop-item="app:recyclebin"] img').src`)
  check(
    (await fsNodes()).every((n) => n.parent !== 'recycled') && after !== binFull,
    'M8',
    'Yes empties the bin and its icon turns empty',
  )

  // 18: rubber-band selection.
  await clickDesktop()
  const band = await app.drag([150, 10], [5, 300])
  await sleep(100)
  const during = await app.eval(
    `[!!document.querySelector('.border-dotted.mix-blend-difference'), [...document.querySelectorAll('[data-desktop-item][aria-selected="true"]')].map(e=>e.dataset.desktopItem)]`,
  )
  await shot('18-rubber-band', { x: 0, y: 0, width: 240, height: 340 })
  await band.release()
  const chosen = await selectedKeys()
  check(
    during[0] &&
      ['app:mycomputer', 'app:network', 'app:recyclebin', 'lnk:minesweeper'].every((k) =>
        chosen.includes(k),
      ) &&
      !chosen.includes('lnk:solitaire'),
    '18',
    'the dotted band selects every icon it touches',
    chosen,
  )
  const extend = await app.drag([150, 290], [5, 350], { mods: ['Control'] })
  await extend.release()
  const extended = await selectedKeys()
  check(
    extended.includes('lnk:solitaire') && extended.includes('app:mycomputer'),
    '18',
    'Ctrl adds a second band to the selection',
    extended,
  )

  // New > Shortcut wizard.
  await clickDesktop()
  await rightClick([520, 400])
  await pickMenu('New')
  await pickMenu('Shortcut')
  await app.waitFor(`!!document.querySelector('#shortcut-command')`)
  await app.type('calc')
  await shot('19-create-shortcut-wizard')
  await app.key('Enter')
  await app.waitFor(`!!document.querySelector('#shortcut-name')`)
  await app.key('Enter')
  await flushFs()
  check(await keyByLabel('Calculator'), '19', 'New > Shortcut runs the Create Shortcut wizard')

  // Auto Arrange keeps icons in order.
  await rightClick([700, 600])
  await hover('Arrange Icons')
  await pickMenu('Auto Arrange')
  const columns = await app.eval(
    `[...new Set([...document.querySelectorAll('[data-desktop-item]')].map(e=>e.style.left))]`,
  )
  check(columns.length <= 2, '19', 'Auto Arrange packs the icons into columns', columns)
  await shot('19-auto-arrange')
  await rightClick([700, 600])
  await hover('Arrange Icons')
  await pickMenu('Auto Arrange')
}
