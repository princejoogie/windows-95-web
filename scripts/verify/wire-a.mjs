import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { connect, sleep } from './cdp.mjs'

const port = Number(process.argv[2] ?? 9390)
const proof = resolve(process.argv[3] ?? '../proof/wire-a')
const item = process.argv[4] ?? 'wordpad'
mkdirSync(proof, { recursive: true })
const c = await connect(port)
const checks = []

async function check(name, expression, screenshot) {
  const actual = await c.eval(expression)
  assert.ok(Array.isArray(actual) ? actual.length > 0 : actual, `${name}: ${JSON.stringify(actual)}`)
  checks.push({ name, expression, actual, screenshot: screenshot ?? null })
  console.log(`PASS ${name}`)
  if (screenshot) await c.shot(join(proof, `${screenshot}.png`))
}

async function clickText(text, selector = 'button, [role="menuitem"]', count = 1) {
  const point = await c.eval(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].reverse().find(el =>
      el.getClientRects().length && el.textContent.trim() === ${JSON.stringify(text)})
    if (!el) throw new Error('Missing text ' + ${JSON.stringify(text)})
    const b = el.getBoundingClientRect()
    return [b.x + b.width / 2, b.y + b.height / 2]
  })()`)
  await c.click(...point, { count })
}

async function run(command) {
  await c.clickOn('[data-start-button]')
  await clickText('Run...')
  await c.clickOn('#run-command')
  await c.key('a', ['Control'])
  await c.type(command)
  await c.key('Enter')
  await sleep(200)
}

async function combo(label, option) {
  await c.clickOn(`[role="combobox"][aria-label="${label}"]`)
  if (option) {
    await c.eval(
      `(() => {const el=[...document.querySelectorAll('[role="option"]')].find(el=>el.textContent.trim()===${JSON.stringify(option)});if(!el)throw new Error('Missing option');el.scrollIntoView({block:'nearest'})})()`,
    )
    await clickText(option, '[role="option"]')
  } else {
    await c.key('End')
    await c.key('Enter')
  }
  await check(
    `${label} uses the shared ComboBox and accepts a choice`,
    `!!document.querySelector('[role="combobox"][aria-label="${label}"][aria-expanded="false"]')`,
  )
}

async function shutdown() {
  await c.clickOn('[data-start-button]')
  await clickText('Shut Down...')
  await c.clickOn('input[value="logoff"]')
  await clickText('Yes')
}

const audioProbe = `(() => {
  window.__audio = []
  const bytes = new WeakMap(), buffers = new WeakMap()
  const arrayBuffer = Response.prototype.arrayBuffer
  Response.prototype.arrayBuffer = async function(...args) {
    const result = await arrayBuffer.apply(this, args)
    bytes.set(result, this.url.split('/').pop().split('-')[0])
    return result
  }
  const decode = AudioContext.prototype.decodeAudioData
  AudioContext.prototype.decodeAudioData = async function(data, ...args) {
    const name = bytes.get(data)
    const buffer = await decode.call(this, data, ...args)
    buffers.set(buffer, name)
    return buffer
  }
  const start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function(...args) {
    window.__audio.push({name: buffers.get(this.buffer), duration: this.buffer?.duration, sampleRate: this.buffer?.sampleRate})
    return start.apply(this, args)
  }
})()`

const cursorProbe = `(() => {
  window.__cursors = []
  new MutationObserver(() => {
    const root = document.documentElement
    if (root) window.__cursors.push({kind: root.dataset.systemCursor ?? 'arrow', cursor: getComputedStyle(document.body ?? root).cursor, windows: document.querySelectorAll('[data-window]').length})
  }).observe(document, {subtree: true, attributes: true, attributeFilter: ['data-system-cursor']})
})()`

async function hear(name, label) {
  await c.waitFor(`window.__audio?.some(entry => entry.name === ${JSON.stringify(name)})`)
  await check(
    label,
    `window.__audio.filter(entry => entry.name === ${JSON.stringify(name)} && entry.duration > 0 && entry.sampleRate > 0)`,
  )
  await c.eval('window.__audio = []')
}

try {
  await c.send('Page.enable')
  if (item === 'sounds') await c.send('Page.addScriptToEvaluateOnNewDocument', { source: audioProbe })
  if (item === 'cursors' || item === 'wallpaper')
    await c.send('Page.addScriptToEvaluateOnNewDocument', { source: cursorProbe })
  await c.send('Page.reload')
  await sleep(100)
  await c.waitFor('!!document.querySelector("[data-start-button]")')
  if (item === 'wordpad') {
    await run('wordpad')
    await c.clickOn('.wordpad-page[contenteditable]')
    await c.type('Unsaved close verification')
    await shutdown()
    await check(
      'Shutdown asks WordPad to save',
      'document.body.innerText.includes("Save changes to Document?")',
      'wordpad-save-prompt',
    )
    await clickText('Cancel')
    await check(
      'Cancel preserves WordPad and its document',
      'document.querySelector(".wordpad-page[contenteditable]")?.textContent.includes("Unsaved close verification") && !document.querySelector("[role=dialog]")',
    )
    await shutdown()
    await clickText('Yes')
    await c.waitFor('!!document.querySelector("[role=dialog] input")')
    await clickText('Cancel')
    await check(
      'Cancel in Save As also rejects shutdown',
      '!!document.querySelector(".wordpad-page[contenteditable]") && !document.querySelector("[role=dialog]")',
      'wordpad-save-cancel',
    )
    await c.key('F4', ['Alt'])
    await clickText('No')
    await check(
      'Discard completes close after canceled shutdowns',
      '!document.querySelector(".wordpad-page[contenteditable]")',
    )
    await run('wordpad')
    await c.key('F4', ['Alt'])
    await check(
      'Clean document closes without prompting',
      '!document.querySelector(".wordpad-page[contenteditable]") && !document.querySelector("[role=dialog]")',
    )
    await run('wordpad')
    await c.clickOn('.wordpad-page[contenteditable]')
    await c.type('Saved close verification')
    await c.key('F4', ['Alt'])
    await clickText('Yes')
    await c.clickOn('[role="dialog"] input[id$="-name"]')
    await c.key('a', ['Control'])
    await c.type(`WireA-${Date.now()}.doc`)
    await clickText('Save')
    await c.waitFor('!document.querySelector(".wordpad-page[contenteditable]")')
    await c.waitFor(
      'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).some(node => node.kind === "file" && node.content.includes("Saved close verification"))',
    )
    await check(
      'Save persists content before close',
      'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).some(node => node.kind === "file" && node.content.includes("Saved close verification"))',
      'wordpad-saved',
    )
  }
  if (item === 'sounds') {
    await hear('tada', 'Startup plays the tada buffer')
    await run('missing-wire-a-program')
    await hear('chord', 'Missing program plays the chord buffer')
    await clickText('OK')
    await clickText('Cancel')
    await run('wordpad')
    await c.clickOn('.wordpad-page[contenteditable]')
    await c.type('Modal sound verification')
    await c.key('F4', ['Alt'])
    await c.click(
      ...(await c.eval(
        '(() => {const b=document.querySelector("[data-window]").getBoundingClientRect();return [b.x+12,b.y+12]})()',
      )),
    )
    await hear('ding', 'Clicking a blocked owner plays the ding buffer')
    await clickText('No')
    await run('C:\\My Documents')
    const recycled = await c.eval(
      'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).find(node => node.kind === "file" && node.name.startsWith("WireA-"))?.id',
    )
    assert.ok(recycled, 'Run the WordPad item first to create a disposable saved document')
    await c.clickOn(`[data-node-id="${recycled}"]`)
    await c.key('Delete')
    await clickText('Yes')
    await c.key('F4', ['Alt'])
    await c.clickOn('[aria-label="Desktop"] [aria-label="Recycle Bin"]', { button: 'right' })
    await clickText('Empty Recycle Bin')
    await clickText('Yes')
    await hear('recycle', 'Emptying Recycle Bin plays the recycle buffer')
    await run('control')
    await c.clickOn('[data-applet="sounds"]', { count: 2 })
    await c.clickOn('[aria-label="Sound scheme"]')
    await c.key('Home')
    await c.key('ArrowDown')
    await c.key('Enter')
    await clickText('OK')
    await check(
      'No Sounds persists from Control Panel',
      'Object.values(JSON.parse(localStorage.getItem("win95.settings.v1")).soundScheme).every(name => name === "(None)")',
      'no-sounds',
    )
    await c.key('F4', ['Alt'])
    await c.eval('window.__audio = []')
    await run('missing-wire-a-program')
    await c.clickOn('#run-command')
    await sleep(250)
    await check('No Sounds silences errors and blocked-owner clicks', 'window.__audio.length === 0')
    await clickText('OK')
    await clickText('Cancel')
    await run('control')
    await c.clickOn('[data-applet="sounds"]', { count: 2 })
    await c.clickOn('[aria-label="Sound scheme"]')
    await c.key('Home')
    await c.key('Enter')
    await clickText('OK')
    await c.key('F4', ['Alt'])
    await shutdown()
    await hear('chimes', 'Logoff plays the chimes exit buffer')
  }
  if (item === 'cursors') {
    await check(
      'Boot uses the real wait cursor',
      'window.__cursors.filter(entry => entry.kind === "wait" && entry.cursor.includes("wait_r"))',
    )
    await run('notepad')
    await check(
      'Launch uses the real arrow-with-hourglass cursor',
      'window.__cursors.filter(entry => entry.kind === "busy" && entry.cursor.includes("busy_r"))',
    )
    await c.waitFor('!document.documentElement.dataset.systemCursor')
    await check(
      'Cursor returns to the real arrow after painting',
      'getComputedStyle(document.body).cursor.includes("arrow_r")',
      'cursor-ready',
    )
    await check(
      'Taskbar resize cursor uses the exported value',
      '[...document.querySelectorAll("[style]")].some(el => el.style.cursor.includes("var(--cursor-ns-resize"))',
    )
  }
  if (item === 'display') {
    await c.clickOn('[aria-label="Desktop"]', { button: 'right' })
    await clickText('Properties')
    await check(
      'Desktop Properties opens the Control Panel display sheet',
      `!!document.querySelector('[role="dialog"][aria-label="Display Properties"] [aria-label="Monitor preview"]')`,
      'display-properties',
    )
    await clickText('Cancel')
    await c.clickOn('[data-clock]', { count: 2 })
    await check(
      'Double-clicking the taskbar clock opens Date/Time',
      `!!document.querySelector('[role="dialog"][aria-label="Date/Time Properties"]')`,
      'date-time',
    )
    await c.clickOn('[aria-label="Year"]')
    await c.key('a', ['Control'])
    await c.type('1995')
    await c.key('Tab')
    await clickText('OK')
    await check(
      'Clock reads the saved clock offset and time zone',
      '(() => { const s = JSON.parse(localStorage.getItem("win95.settings.v1")); const expected = new Date(Date.now() + s.clockOffset).toLocaleTimeString("en-US", {timeZone: s.timeZone, hour:"numeric", minute:"2-digit", hour12:!s.regional.time24}); return document.querySelector("[data-clock]").textContent === expected && Math.abs(s.clockOffset) > 3600000 })()',
      'clock-offset',
    )
    await c.eval(
      '(() => {const s=JSON.parse(localStorage.getItem("win95.settings.v1"));s.screenSaver={...s.screenSaver,name:"Blank Screen",waitMinutes:1/60};localStorage.setItem("win95.settings.v1",JSON.stringify(s))})()',
    )
    await c.send('Page.reload')
    await sleep(100)
    await c.waitFor('!!document.querySelector("[data-screen-saver]")', 6000)
    await check(
      'Idle screen saver covers the desktop',
      'document.querySelector("[data-screen-saver]")?.getAttribute("data-screen-saver") === "Blank Screen"',
      'screen-saver-idle',
    )
    await c.key('Escape')
    await check(
      'User input dismisses the idle screen saver',
      '!document.querySelector("[data-screen-saver]")',
      'screen-saver-dismissed',
    )
    await c.eval(
      '(() => {const s=JSON.parse(localStorage.getItem("win95.settings.v1"));s.screenSaver.name="(None)";s.clockOffset=0;localStorage.setItem("win95.settings.v1",JSON.stringify(s))})()',
    )
  }
  if (item === 'controlpanel') {
    await run('control')
    for (const [applet, tabs] of [
      [
        'display',
        [
          ['Background', ['Pattern', 'Wallpaper']],
          ['Screen Saver', ['Screen saver']],
          ['Appearance', ['Scheme', 'Appearance item']],
        ],
      ],
      [
        'datetime',
        [
          ['Date & Time', ['Month']],
          ['Time Zone', ['Time zone']],
        ],
      ],
      [
        'regional',
        [
          ['Regional Settings', ['Regional language']],
          ['Time', ['Time style']],
          ['Date', ['Short date style']],
        ],
      ],
      ['sounds', [['Sounds', ['Sound events', 'Sound name', 'Sound scheme']]]],
      ['programs', [['Install/Uninstall', ['Installed programs']]]],
    ]) {
      await c.clickOn(`[data-applet="${applet}"]`, { count: 2 })
      for (const [tab, labels] of tabs) {
        await clickText(tab, '[role="tab"]')
        await check(`${applet} ${tab} has no native select`, '!document.querySelector("select")')
        for (const label of labels) await combo(label)
        await c.shot(join(proof, `combobox-${applet}-${tab.replaceAll(' ', '-').replaceAll('/', '-')}.png`))
      }
      await clickText('Cancel')
    }
    await c.clickOn('[data-applet="regional"]', { count: 2 })
    await clickText('Time', '[role="tab"]')
    await combo('Time style', 'HH:mm:ss')
    await clickText('OK')
    await check(
      'Taskbar clock honors the selected 24-hour format',
      '(() => {const s=JSON.parse(localStorage.getItem("win95.settings.v1"));return s.regional.time24 && document.querySelector("[data-clock]").textContent===new Date(Date.now()+s.clockOffset).toLocaleTimeString("en-US",{timeZone:s.timeZone,hour:"numeric",minute:"2-digit",hour12:false})})()',
      'clock-24-hour',
    )
    await c.key('F4', ['Alt'])
  }
  if (item === 'wallpaper') {
    await run('mspaint')
    const [cx, cy] = await c.center('[aria-label="Paint canvas"]')
    const stroke = await c.drag([cx - 60, cy - 40], [cx + 60, cy + 40])
    await stroke.release()
    await c.eval('window.__cursors = []')
    await clickText('File', '[role="menubar"] button')
    await clickText('Set As Wallpaper (Tiled)')
    await c.waitFor(
      'getComputedStyle(document.querySelector(".bg-desktop")).backgroundRepeat === "repeat, repeat"',
    )
    await c.waitFor(
      '!!JSON.parse(localStorage.getItem("w95.fs.v1")).nodes[JSON.parse(localStorage.getItem("win95.settings.v1")).wallpaper]',
    )
    await check(
      'Unsaved Paint picture tiles as a file wallpaper',
      '(() => {const s=JSON.parse(localStorage.getItem("win95.settings.v1"));const f=JSON.parse(localStorage.getItem("w95.fs.v1")).nodes[s.wallpaper];return f?.kind==="file" && f.content.startsWith("data:image/png;base64,") && s.wallpaperMode==="tile" && getComputedStyle(document.querySelector(".bg-desktop")).backgroundSize==="440px 280px, 8px 8px"})()',
      'paint-wallpaper-tiled',
    )
    await check(
      'Decoding the wallpaper uses the hourglass and releases it',
      'window.__cursors.some(entry => entry.kind === "wait" && entry.cursor.includes("wait_r")) && !document.documentElement.dataset.systemCursor',
    )
    await clickText('File', '[role="menubar"] button')
    await clickText('Set As Wallpaper (Centered)')
    await c.waitFor(
      'getComputedStyle(document.querySelector(".bg-desktop")).backgroundRepeat === "no-repeat, repeat"',
    )
    await check(
      'Paint picture centers at native size',
      'JSON.parse(localStorage.getItem("win95.settings.v1")).wallpaperMode==="center"',
      'paint-wallpaper-centered',
    )
    await c.key('F4', ['Alt'])
    await clickText('No')
    await sleep(300)
    await c.send('Page.reload')
    await sleep(100)
    await c.waitFor('!!document.querySelector("[data-start-button]")')
    await check(
      'File wallpaper survives a renderer restart',
      'getComputedStyle(document.querySelector(".bg-desktop")).backgroundSize==="440px 280px, 8px 8px" && getComputedStyle(document.querySelector(".bg-desktop")).backgroundImage.includes("data:image/png;base64,")',
      'wallpaper-restart',
    )
  }
  if (item === 'notepad') {
    await run('notepad')
    await c.clickOn('[aria-label="Document text"]')
    await c.type('Save prompt verification')
    for (const [key, mods, action] of [
      ['n', ['Control'], 'New'],
      ['o', ['Control'], 'Open'],
      ['F4', ['Alt'], 'Close'],
    ]) {
      await c.key(key, mods)
      await check(
        `${action} uses the exact Windows 95 save prompt and blank line`,
        `document.querySelector('[role="dialog"] p')?.textContent === ${JSON.stringify('The text in the Untitled file has changed.\n\nDo you want to save the changes?')}`,
        `notepad-${action.toLowerCase()}-prompt`,
      )
      await clickText('Cancel')
    }
  }
  if (item === 'freecell') {
    await run('freecell')
    await c.key('g', ['Alt'])
    await check(
      'Alt+G opens the shared Game menu with the original entries',
      '[...document.querySelectorAll("[role=menuitem]")].map(el=>el.textContent).join("|").includes("New GameF2|Select Game...F3|Restart Game|Statistics...F4|Options...F5|UndoF10|Exit")',
      'freecell-game-menu',
    )
    await c.key('s')
    await check(
      'Game menu S accelerator opens Select Game',
      `!!document.querySelector('[role="dialog"][aria-label="Game Number"]')`,
      'freecell-select-game',
    )
    await clickText('Cancel')
    await c.key('Alt')
    await c.key('ArrowRight')
    await c.key('ArrowDown')
    await check(
      'Alt and arrows move to the shared Help menu',
      '[...document.querySelectorAll("[role=menuitem]")].some(el=>el.textContent.includes("Help Topics"))',
      'freecell-help-menu',
    )
    await c.key('Escape')
    await c.key('Escape')
    await c.key('F5')
    await check('F5 still opens Options', `!!document.querySelector('[role="dialog"][aria-label="Options"]')`)
    await clickText('Cancel')
    await c.clickOn('[data-column="0"] [data-index="6"]')
    await c.clickOn('[data-cell="0"]')
    await check(
      'A card can move to a free cell',
      'Number(document.querySelector(".freecell").dataset.moves)>0',
    )
    await c.key('F10')
    await check(
      'F10 keeps the original Undo command',
      'Number(document.querySelector(".freecell").dataset.moves)===0 && !document.querySelector("[role=menu]")',
      'freecell-undo',
    )
  }
  if (item === 'find-help') {
    await run('find')
    await c.clickOn('input[name="named"]')
    await c.type('Readme.txt')
    await clickText('Find Now')
    await c.waitFor('document.querySelectorAll("tbody tr").length === 1')
    await check(
      'Find displays the shared byte length for the real Readme file',
      `(() => {const f=Object.values(JSON.parse(localStorage.getItem('w95.fs.v1')).nodes).find(n=>n.name==='Readme.txt');return document.querySelector('tbody tr td:nth-child(3)').textContent===Math.ceil(new TextEncoder().encode(f.content).length/1024)+' KB'})()`,
      'find-size',
    )
    await c.key('F4', ['Alt'])
    await run('winhlp32')
    const book = '[role="treeitem"][aria-expanded="false"]'
    const blueBook = `async () => {
      const img = document.querySelector('[role="treeitem"][aria-expanded] img')
      await img.decode()
      const canvas = document.createElement('canvas');canvas.width=16;canvas.height=16
      const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0)
      const pixels=ctx.getImageData(0,0,16,16).data
      let blue=0,green=0
      for(let i=0;i<pixels.length;i+=4) {if(pixels[i]===0&&pixels[i+1]===0&&pixels[i+2]>=128&&pixels[i+3])blue++;if(pixels[i]===0&&pixels[i+1]===128&&pixels[i+2]===0&&pixels[i+3])green++}
      return img.naturalWidth===16&&img.naturalHeight===16&&blue>10&&green===0
    }`
    await check('Closed Help book is a crisp 16-pixel blue book', `(${blueBook})()`, 'help-book-closed')
    const closed = await c.eval(`document.querySelector('${book} img').src`)
    await c.clickOn(book, { count: 2 })
    await check(
      'Opening a Help book changes its icon',
      `document.querySelector('[role="treeitem"][aria-expanded="true"] img')?.src !== ${JSON.stringify(closed)}`,
    )
    await check('Open Help book has blue covers and white pages', `(${blueBook})()`, 'help-book-open')
  }
  writeFileSync(join(proof, `${item}.json`), `${JSON.stringify({ port, item, checks }, null, 2)}\n`)
} catch (error) {
  console.log(await c.eval('document.body.innerText'))
  await c.shot(join(proof, `${item}-failure.png`))
  throw error
} finally {
  c.close()
}
