// Usage: node drive.mjs <port> <steps.json | inline JSON>
// Steps: {eval}, {click:[x,y], button?, count?, mods?}, {move:[x,y]}, {down:[x,y]}, {up:[x,y]},
// {drag:{from:[x,y], to:[x,y], steps?, hold?}}, {key:'Escape', mods?:['Alt']}, {type:'text'}, {shot:'path'}, {wait:ms}
import { readFileSync, writeFileSync } from 'node:fs'

const [port = '9320', arg = '[]'] = process.argv.slice(2)
const steps = JSON.parse(arg.trim().startsWith('[') ? arg : readFileSync(arg, 'utf8'))
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let id = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m)
    pending.delete(m.id)
  }
})
const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id
    pending.set(n, r)
    ws.send(JSON.stringify({ id: n, method, params }))
  })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const KEYS = {
  Escape: [27, 'Escape'], Enter: [13, 'Enter'], Tab: [9, 'Tab'], Backspace: [8, 'Backspace'], Delete: [46, 'Delete'],
  ArrowUp: [38, 'ArrowUp'], ArrowDown: [40, 'ArrowDown'], ArrowLeft: [37, 'ArrowLeft'], ArrowRight: [39, 'ArrowRight'],
  Home: [36, 'Home'], End: [35, 'End'], ' ': [32, 'Space'], Alt: [18, 'AltLeft'], Control: [17, 'ControlLeft'],
  Shift: [16, 'ShiftLeft'], Meta: [91, 'MetaLeft'], ContextMenu: [93, 'ContextMenu'],
}
for (let i = 1; i <= 12; i++) KEYS[`F${i}`] = [111 + i, `F${i}`]
const MOD = { Alt: 1, Control: 2, Meta: 4, Shift: 8 }
const keyInfo = (key) => {
  if (KEYS[key]) return { vk: KEYS[key][0], code: KEYS[key][1] }
  const up = key.toUpperCase()
  if (/^[A-Z]$/.test(up)) return { vk: up.charCodeAt(0), code: `Key${up}` }
  if (/^[0-9]$/.test(key)) return { vk: key.charCodeAt(0), code: `Digit${key}` }
  return { vk: 0, code: '' }
}
const mouse = (type, [x, y], o = {}) =>
  send('Input.dispatchMouseEvent', {
    type, x, y, button: o.button ?? 'left', buttons: type === 'mouseReleased' ? 0 : o.buttons ?? 1,
    clickCount: o.count ?? 1, modifiers: (o.mods ?? []).reduce((a, m) => a | MOD[m], 0),
  })

for (const step of steps) {
  if (step.sel) {
    const r = await send('Runtime.evaluate', {
      expression: `(()=>{const e=document.querySelector(${JSON.stringify(step.sel)});if(!e)return null;const b=e.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]})()`,
      returnByValue: true,
    })
    const at = r.result?.result?.value
    if (!at) {
      console.log('missing', step.sel)
      continue
    }
    step.click = at.map(Math.round)
  }
  if (step.eval) {
    const r = await send('Runtime.evaluate', { expression: step.eval, awaitPromise: true, returnByValue: true })
    console.log(JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description ?? null))
  } else if (step.click) {
    const o = { button: step.button ?? 'left', count: 1, mods: step.mods, buttons: step.button === 'right' ? 2 : 1 }
    await mouse('mouseMoved', step.click, { ...o, buttons: 0 })
    for (let c = 1; c <= (step.count ?? 1); c++) {
      await mouse('mousePressed', step.click, { ...o, count: c })
      await mouse('mouseReleased', step.click, { ...o, count: c })
    }
  } else if (step.move) await mouse('mouseMoved', step.move, { buttons: 0, button: 'none' })
  else if (step.down) await mouse('mousePressed', step.down, { button: step.button })
  else if (step.up) await mouse('mouseReleased', step.up, { button: step.button })
  else if (step.drag) {
    const { from, to, steps: n = 10, hold = false } = step.drag
    await mouse('mouseMoved', from, { buttons: 0 })
    await mouse('mousePressed', from)
    for (let i = 1; i <= n; i++) {
      const p = [from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n]
      await mouse('mouseMoved', p)
      await sleep(10)
    }
    if (!hold) await mouse('mouseReleased', to)
  } else if (step.key) {
    const mods = step.mods ?? []
    const modifiers = mods.reduce((a, m) => a | MOD[m], 0)
    for (const m of mods) {
      const k = keyInfo(m)
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: m, code: k.code, windowsVirtualKeyCode: k.vk, modifiers })
    }
    const k = keyInfo(step.key)
    const printable = step.key.length === 1 && !mods.some((m) => m === 'Control' || m === 'Alt')
    await send('Input.dispatchKeyEvent', {
      type: printable || step.key === 'Enter' ? 'keyDown' : 'rawKeyDown', key: step.key, code: k.code, windowsVirtualKeyCode: k.vk, modifiers,
      ...(printable ? { text: step.key } : step.key === 'Enter' ? { text: String.fromCharCode(13) } : {}),
    })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: step.key, code: k.code, windowsVirtualKeyCode: k.vk, modifiers })
    for (const m of [...mods].reverse()) {
      const mk = keyInfo(m)
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: m, code: mk.code, windowsVirtualKeyCode: mk.vk, modifiers: 0 })
    }
  } else if (step.type) await send('Input.insertText', { text: step.type })
  else if (step.shot) {
    const s = await send('Page.captureScreenshot', { format: 'png', ...(step.clip ? { clip: { ...step.clip, scale: step.scale ?? 1 } } : {}) })
    writeFileSync(step.shot, Buffer.from(s.result.data, 'base64'))
    console.log('saved', step.shot)
  } else if (step.wait) await sleep(step.wait)
  await sleep(step.after ?? 60)
}
ws.close()
