import {
  button,
  check,
  click,
  drag,
  key,
  load,
  menu,
  mouse,
  point,
  productionUrl,
  read,
  shot,
  socket,
  wait,
} from './solitaire-cdp.mjs'

const devUrl = process.argv[4] ?? 'http://127.0.0.1:5441'
const label = (name) =>
  `Array.from(document.querySelectorAll('[role=dialog] label')).find(e=>e.textContent===${JSON.stringify(name)})`
const prefs = `JSON.parse(localStorage.getItem('w95.solitaire.preferences'))`
const stock = `document.querySelector('button.solitaire-slot')`
const options = () => menu('Game', 'Options...')
const score = (value) =>
  check(
    `document.querySelector('.solitaire').textContent.includes('Score: $${value}')`,
    `Vegas balance ${value}`,
  )
const chooseBack = async (name) => {
  await menu('Game', 'Deck...')
  await click(`document.querySelector('input[name=solitaire-back][value=${JSON.stringify(name)}]')`)
  await key('Enter')
}
async function until(expression) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await read(expression)) return
    await wait(100)
  }
  throw new Error(`Timed out waiting for ${expression}`)
}
async function launch() {
  await until(`!!document.querySelector('[role=option][aria-label="Solitaire"]')`)
  await click(`document.querySelector('[role=option][aria-label="Solitaire"]')`)
  await key('Enter')
  await until(`!!document.querySelector('[data-phase]')`)
}
async function setOptions({
  draw = 3,
  scoring = 'Standard',
  timed = true,
  keepScore = false,
  outline = false,
  statusBar = true,
} = {}) {
  await options()
  await click(label(draw === 1 ? 'Draw one' : 'Draw three'))
  await click(label(scoring))
  for (const [shortcut, checked] of [
    ['t', timed],
    ['k', keepScore],
    ['l', outline],
    ['b', statusBar],
  ]) {
    const value = await read(
      `(()=>{const input=document.querySelector('input[data-shortcut=${shortcut}]');return {checked:input.checked,disabled:input.disabled}})()`,
    )
    if (!value.disabled && value.checked !== checked)
      await click(`document.querySelector('input[data-shortcut=${shortcut}]')`)
  }
  await key('Enter')
}
async function nativeGeometry(name) {
  await check(
    `Array.from(document.querySelectorAll('.solitaire-card, .solitaire-slot')).every(e=>{const r=e.getBoundingClientRect();return r.width===71&&r.height===96&&Number.isInteger(r.x)&&Number.isInteger(r.y)})`,
    `71x96 cards and integer positions ${name}`,
  )
  console.log(
    JSON.stringify({
      name,
      table: await read(`document.querySelector('[data-phase]').getBoundingClientRect().toJSON()`),
      card: await read(`document.querySelector('[data-card]').getBoundingClientRect().toJSON()`),
    }),
  )
  await shot(name)
}
async function foundations() {
  await setOptions({ draw: 1, timed: false })
  for (let attempt = 0; attempt < 200; attempt++) {
    if (await read(`!!document.querySelector('[data-pile=waste][data-card$="-1"]')`)) break
    await click(stock)
    if (attempt % 30 === 29) await key('F2')
  }
  const ace = await read(`document.querySelector('[data-pile=waste]').dataset.card`)
  for (let pile = 0; pile < 4; pile++) {
    await drag(
      `document.querySelector('[data-pile=waste]')`,
      `document.querySelectorAll('[data-foundation]')[${pile}]`,
    )
    await check(
      `document.querySelectorAll('[data-foundation]')[${pile}].dataset.count==='1' && document.querySelector('[data-pile=foundation]').dataset.card===${JSON.stringify(ace)}`,
      `Ace accepted in position ${pile + 1}`,
    )
    await shot(`foundation-${pile + 1}`)
    await key('z', 2)
  }
  await check(
    `Array.from(document.querySelectorAll('[data-foundation]')).every(e=>!e.textContent.trim())`,
    'Empty foundations have no font or suit glyphs',
  )
}
async function settings() {
  await setOptions({ draw: 1, scoring: 'Vegas', timed: false })
  await options()
  await check(
    `document.activeElement.name==='solitaire-draw' && document.activeElement.checked`,
    'Options initial focus is the selected Draw choice',
  )
  await click(label('Keep score'))
  await key('t', 1)
  await check(`document.querySelector('input[data-shortcut=t]').checked`, 'Alt+T toggles Timed game')
  await key('t', 1)
  await click(label('Outline dragging'))
  await shot('options-keep-score')
  await key('Enter')
  await check(`!document.querySelector('[role=dialog]')`, 'Enter accepts Options')
  await score(-52)
  await key('F2')
  await score(-104)
  await menu('Game', 'Deal')
  await score(-156)
  await options()
  await click(label('Draw three'))
  await key('Enter')
  await score(-208)
  const accepted = await read(`localStorage.getItem('w95.solitaire.preferences')`)
  await options()
  await click(label('None'))
  await check(`document.querySelector('input[data-shortcut=k]').disabled`, 'Keep score unavailable in None')
  await key('Escape')
  await check(
    `localStorage.getItem('w95.solitaire.preferences')===${JSON.stringify(accepted)}`,
    'Esc discards pending options',
  )
  await chooseBack('Blue weave')
  await menu('Game', 'Deck...')
  await check(`document.querySelectorAll('input[name=solitaire-back]').length===12`, 'Twelve card backs')
  await shot('deck-gallery')
  await check(
    `Array.from(document.querySelectorAll('.solitaire-back img')).every(image=>image.getBoundingClientRect().width===71&&image.getBoundingClientRect().height===96)`,
    'Deck previews keep native dimensions',
  )
  await key('ArrowRight')
  await key(' ')
  await key('Enter')
  await check(
    `${prefs}.back==='Red diamonds' && !document.querySelector('[role=dialog]')`,
    'Deck arrows, Space, and Enter accept',
  )
  await menu('Game', 'Deck...')
  await key('ArrowDown')
  await check(
    `document.activeElement.value==='Shell' && document.activeElement.checked`,
    'Deck Down moves one gallery row',
  )
  await key('Escape')
  await check(`${prefs}.back==='Red diamonds'`, 'Deck Esc cancels')
  await menu('Game', 'Exit')
  await launch()
  await score(-260)
  await options()
  await check(
    `document.querySelector('input[data-shortcut=h]').checked && document.querySelector('input[data-shortcut=v]').checked && document.querySelector('input[data-shortcut=k]').checked && !document.querySelector('input[data-shortcut=t]').checked && document.querySelector('input[data-shortcut=l]').checked`,
    'Accepted Options survive relaunch',
  )
  await shot('options-reopened')
  await key('Escape')
  await menu('Game', 'Deck...')
  await check(
    `document.activeElement.value==='Red diamonds' && document.activeElement.checked`,
    'Accepted back survives relaunch',
  )
  await shot('deck-reopened')
  await key('Escape')
  await load('Page.reload')
  await launch()
  await score(-312)
  await shot('vegas-reloaded')
  await setOptions({ scoring: 'Vegas', timed: false })
  await key('F2')
  await score(-52)
  await setOptions()
  await options()
  await check(
    `document.querySelector('input[data-shortcut=k]').disabled`,
    'Keep score unavailable in Standard',
  )
  await key('Escape')
}
async function artwork() {
  await nativeGeometry('table-native')
  await click(button('Maximize'))
  await nativeGeometry('table-maximized')
  await click(button('Restore'))
  const bounds = await read(`document.querySelector('[data-window]').getBoundingClientRect().toJSON()`)
  const start = { x: bounds.right - 3, y: bounds.bottom - 3 }
  const end = { x: start.x - 400, y: start.y - 300 }
  await mouse('mouseMoved', start)
  await mouse('mousePressed', start, { button: 'left', buttons: 1, clickCount: 1 })
  await mouse('mouseMoved', end, { button: 'left', buttons: 1 })
  await mouse('mouseReleased', end, { button: 'left', clickCount: 1 })
  await wait()
  await check(
    `document.querySelector('[data-phase]').clientWidth===560`,
    'Window reaches the configured minimum width',
  )
  await nativeGeometry('table-minimum')
  await setOptions({ timed: false })
  for (let draw = 0; draw < 8; draw++) await click(stock)
  await check(
    `document.querySelector('button.solitaire-slot').getAttribute('aria-label')==='Recycle waste' && !decodeURIComponent(document.querySelector('button.solitaire-slot img').src).includes('<text')`,
    'Recycle marker uses pixel artwork',
  )
  await shot('stock-recycle')
  await setOptions({ draw: 1, scoring: 'Vegas', timed: false })
  for (let draw = 0; draw < 24; draw++) await click(stock)
  await check(
    `document.querySelector('button.solitaire-slot').getAttribute('aria-label')==='Stock exhausted' && !decodeURIComponent(document.querySelector('button.solitaire-slot img').src).includes('<text')`,
    'Vegas exhausted marker uses pixel artwork',
  )
  await shot('stock-exhausted')
  await setOptions()
  const backs = [
    'Blue weave',
    'Red diamonds',
    'Blue plaid',
    'Robot',
    'Roses',
    'Ivy',
    'Tropical fish',
    'Shell',
    'Castle',
    'Beach',
    'Poker hand',
    'Sun',
  ]
  for (const back of backs) {
    await chooseBack(back)
    await check(
      `${prefs}.back===${JSON.stringify(back)} && document.querySelector('button.solitaire-slot img').naturalWidth===71 && document.querySelector('button.solitaire-slot img').naturalHeight===96`,
      `Select ${back}`,
    )
  }
  for (const back of ['Robot', 'Castle', 'Poker hand', 'Sun']) {
    await chooseBack(back)
    const initial = await read(`document.querySelector('button.solitaire-slot img').src`)
    await until(`document.querySelector('button.solitaire-slot img').src!==${JSON.stringify(initial)}`)
    await shot(`animated-${back.toLowerCase().replaceAll(' ', '-')}`)
    await options()
    const paused = await read(`document.querySelector('button.solitaire-slot img').src`)
    await wait(500)
    await check(
      `document.querySelector('button.solitaire-slot img').src===${JSON.stringify(paused)}`,
      `${back} pauses for a dialog`,
    )
    await key('Escape')
  }
  await setOptions({ timed: false })
  let frozen = await read(`document.querySelector('button.solitaire-slot img').src`)
  await wait(500)
  await check(
    `document.querySelector('button.solitaire-slot img').src===${JSON.stringify(frozen)}`,
    'Untimed games freeze back animation',
  )
  await setOptions()
  await click(stock)
  await click(button('Minimize'))
  frozen = await read(`document.querySelector('button.solitaire-slot img').src`)
  const time = await read(`document.querySelector('.solitaire').textContent.split('Time: ')[1]`)
  await wait(1100)
  await check(
    `document.querySelector('button.solitaire-slot img').src===${JSON.stringify(frozen)} && document.querySelector('.solitaire').textContent.split('Time: ')[1]===${JSON.stringify(time)}`,
    'Minimize pauses animation and game time',
  )
  await click(button('Solitaire'))
  await menu('Help', 'About Solitaire')
  await check(
    `document.querySelector('[role=dialog]').textContent.includes('Microsoft Solitaire') && document.querySelector('[role=dialog]').textContent.includes('Copyright') && !document.querySelector('[role=dialog]').textContent.includes('Build each foundation')`,
    'About identifies product, version, and copyright',
  )
  await shot('about')
  await key('Enter')
  await check(`!document.querySelector('[role=dialog]')`, 'Enter accepts About')
  await click(button('Help'))
  await check(
    `Array.from(document.querySelectorAll('[role=menuitem]')).map(e=>e.textContent.trim()).join('|')==='Help Topics|About Solitaire'`,
    'Help Topics and About menu order',
  )
  await shot('help-menu')
  await click(
    `Array.from(document.querySelectorAll('[role=menuitem]')).find(e=>e.textContent.trim()==='Help Topics')`,
  )
  await check(
    `!!document.querySelector('[data-phase]')`,
    'Help Topics is harmless without the later Help viewer',
  )
}
async function fixtures() {
  await load('Page.navigate', { url: `${devUrl}/?solitaireDeal=run` })
  await launch()
  await drag(`document.querySelector('[data-card=hearts-7]')`, `document.querySelector('[data-column="2"]')`)
  await check(`document.querySelector('[data-column="0"]').dataset.count==='4'`, 'Illegal run snaps back')
  await drag(`document.querySelector('[data-card=hearts-7]')`, `document.querySelector('[data-column="1"]')`)
  await check(`document.querySelector('[data-column="1"]').dataset.count==='4'`, 'Three-card run moves')
  await click(`document.querySelector('[data-card=clubs-4]')`)
  await check(
    `document.querySelector('[data-card=clubs-4]').getAttribute('aria-label')==='4 of clubs'`,
    'Manual flip after drag',
  )
  await shot('fixture-run')
  await key('z', 2)
  await check(
    `document.querySelector('[data-card=clubs-4]').getAttribute('aria-label')==='Face-down card'`,
    'Undo restores hidden card',
  )
  await setOptions({ outline: true })
  const start = await read(
    `(()=>{const r=document.querySelector('[data-card=hearts-7]').getBoundingClientRect();return {x:r.x+15,y:r.y+5}})()`,
  )
  await mouse('mouseMoved', start)
  await mouse('mousePressed', start, { button: 'left', buttons: 1, clickCount: 1 })
  await mouse('mouseMoved', { x: start.x + 80, y: start.y + 60 }, { button: 'left', buttons: 1 })
  await check(
    `Array.from(document.querySelectorAll('.solitaire [aria-hidden=true] .outline')).every(e=>e.clientWidth===69&&e.clientHeight===94) && document.querySelectorAll('.solitaire [aria-hidden=true] .outline').length===3`,
    'Outline run uses fixed card dimensions',
  )
  await shot('fixture-outline')
  await mouse('mouseReleased', start, { button: 'left', clickCount: 1 })
  await load('Page.navigate', { url: `${devUrl}/?solitaireDeal=win` })
  await launch()
  const target = await point(`document.querySelector('[data-card=spades-13]')`)
  for (const clickCount of [1, 2]) {
    await mouse('mousePressed', target, { button: 'left', clickCount })
    await mouse('mouseReleased', target, { button: 'left', clickCount })
  }
  await until(`document.querySelector('[data-phase]')?.dataset.phase==='won'`)
  await wait(500)
  await check(
    `document.querySelector('[data-foundation="3"]').dataset.count==='13' && document.querySelector('canvas').getContext('2d').getImageData(0,0,500,300).data.some((value,index)=>index%4===3&&value>0)`,
    'Chosen foundation ordering wins and cascade paints',
  )
  await shot('fixture-cascade')
  await click(button('Stop winning animation'))
  await check(`!document.querySelector('canvas')`, 'Click stops cascade')
  await key('F2')
  await check(`document.querySelector('[data-phase]').dataset.phase==='playing'`, 'F2 deals after winning')
  const topics = await read(
    `(async()=>{const {help}=await import('/src/apps/solitaire/help.ts');const topics=help.contents.flatMap(entry=>'topics' in entry ? entry.topics : [entry]);const ids=new Set(topics.map(topic=>topic.id));if(topics.some(topic=>topic.body.split('](').slice(1).some(link=>!ids.has(link.split(')')[0]))))throw Error('Broken help link');return topics.map(topic=>topic.title)})()`,
  )
  console.log(`PASS Local Help book with ${topics.length} topics and no broken topic links`)
  await read(
    `(async()=>{const art=await import('/src/apps/solitaire/cards.ts');const {deck}=await import('/src/apps/solitaire/game.ts');const sheet=document.createElement('div');sheet.id='solitaire-art-proof';sheet.style.cssText='position:fixed;inset:0;z-index:99999;background:#008000;padding:12px;color:white;font:12px Arial';const title=document.createElement('p');title.textContent='Reconstructed Solitaire pixel artwork at 71 by 96. Not a retail resource capture.';sheet.append(title);for(const [images,columns] of [[deck().map(card=>[art.cardImage(card),art.cardName(card)]),13],[art.BACKS.map(back=>[art.backImage(back),back]),12]]){const grid=document.createElement('div');grid.style.cssText='display:grid;gap:5px;grid-template-columns:repeat('+columns+',71px);margin-top:12px';for(const [src,name] of images){const img=new Image(71,96);img.src=src;img.title=name;img.style.cssText='width:71px;height:96px;max-width:none;image-rendering:pixelated';await img.decode();grid.append(img)}sheet.append(grid)}document.body.append(sheet)})()`,
  )
  await shot('art-gallery')
  await load('Page.navigate', { url: productionUrl })
  await launch()
  await check(`location.protocol==='file:'`, 'Returned to production Electron')
  await shot('finished')
}

try {
  if (!productionUrl.startsWith('file:'))
    throw new Error('Start this check on production Electron, not the dev renderer')
  await load('Page.reload')
  await launch()
  await foundations()
  await settings()
  await artwork()
  await fixtures()
  console.log('All Solitaire production and development-fixture checks passed.')
} finally {
  socket.close()
}
