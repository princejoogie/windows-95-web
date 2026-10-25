// A small CDP client that drives the real Electron renderer with trusted mouse and key events.
import { writeFileSync } from 'node:fs'

const KEYS = {
  Escape: [27, 'Escape'],
  Enter: [13, 'Enter'],
  Tab: [9, 'Tab'],
  Backspace: [8, 'Backspace'],
  Delete: [46, 'Delete'],
  ArrowUp: [38, 'ArrowUp'],
  ArrowDown: [40, 'ArrowDown'],
  ArrowLeft: [37, 'ArrowLeft'],
  ArrowRight: [39, 'ArrowRight'],
  Home: [36, 'Home'],
  End: [35, 'End'],
  ' ': [32, 'Space'],
  Alt: [18, 'AltLeft'],
  Control: [17, 'ControlLeft'],
  Shift: [16, 'ShiftLeft'],
  ContextMenu: [93, 'ContextMenu'],
}
for (let i = 1; i <= 12; i++) KEYS[`F${i}`] = [111 + i, `F${i}`]
const MOD = { Alt: 1, Control: 2, Meta: 4, Shift: 8 }

function keyInfo(key) {
  if (KEYS[key]) return { vk: KEYS[key][0], code: KEYS[key][1] }
  const up = key.toUpperCase()
  if (/^[A-Z]$/.test(up)) return { vk: up.charCodeAt(0), code: `Key${up}` }
  if (/^[0-9]$/.test(key)) return { vk: key.charCodeAt(0), code: `Digit${key}` }
  return { vk: 0, code: '' }
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function connect(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = targets.find((target) => target.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }))
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id
      pending.set(n, resolve)
      ws.send(JSON.stringify({ id: n, method, params }))
    })

  const mouse = (type, x, y, { button = 'left', count = 1, mods = [] } = {}) =>
    send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: type === 'mouseMoved' ? 'none' : button,
      buttons: type === 'mousePressed' ? (button === 'right' ? 2 : 1) : 0,
      clickCount: count,
      modifiers: mods.reduce((sum, m) => sum | MOD[m], 0),
    })

  const api = {
    send,
    close: () => ws.close(),
    async eval(expression) {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.result?.exceptionDetails) {
        throw new Error(result.result.exceptionDetails.exception?.description ?? 'evaluation failed')
      }
      return result.result?.result?.value
    },
    async center(selector) {
      const at = await api.eval(
        `(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const b=e.getBoundingClientRect();return [Math.round(b.x+b.width/2),Math.round(b.y+b.height/2)]})()`,
      )
      if (!at) throw new Error(`no element ${selector}`)
      return at
    },
    async move(x, y) {
      await mouse('mouseMoved', x, y)
      await sleep(30)
    },
    async click(x, y, options = {}) {
      await mouse('mouseMoved', x, y)
      for (let c = 1; c <= (options.count ?? 1); c++) {
        await mouse('mousePressed', x, y, { ...options, count: c })
        await mouse('mouseReleased', x, y, { ...options, count: c })
      }
      await sleep(options.after ?? 80)
    },
    async clickOn(selector, options = {}) {
      const [x, y] = await api.center(selector)
      await api.click(x, y, options)
    },
    async drag(from, to, { steps = 10, mods = [] } = {}) {
      await mouse('mouseMoved', ...from)
      await mouse('mousePressed', ...from, { mods })
      for (let i = 1; i <= steps; i++) {
        await mouse(
          'mouseMoved',
          from[0] + ((to[0] - from[0]) * i) / steps,
          from[1] + ((to[1] - from[1]) * i) / steps,
          { mods },
        )
        await sleep(10)
      }
      return { release: () => mouse('mouseReleased', ...to, { mods }) }
    },
    async key(key, mods = []) {
      const modifiers = mods.reduce((sum, m) => sum | MOD[m], 0)
      for (const m of mods) {
        const k = keyInfo(m)
        await send('Input.dispatchKeyEvent', {
          type: 'rawKeyDown',
          key: m,
          code: k.code,
          windowsVirtualKeyCode: k.vk,
          modifiers,
        })
      }
      const k = keyInfo(key)
      const printable = key.length === 1 && !mods.some((m) => m === 'Control' || m === 'Alt')
      await send('Input.dispatchKeyEvent', {
        type: printable || key === 'Enter' ? 'keyDown' : 'rawKeyDown',
        key,
        code: k.code,
        windowsVirtualKeyCode: k.vk,
        modifiers,
        ...(printable ? { text: key } : key === 'Enter' ? { text: '\r' } : {}),
      })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: k.code, windowsVirtualKeyCode: k.vk, modifiers })
      for (const m of [...mods].reverse()) {
        const mk = keyInfo(m)
        await send('Input.dispatchKeyEvent', {
          type: 'keyUp',
          key: m,
          code: mk.code,
          windowsVirtualKeyCode: mk.vk,
          modifiers: 0,
        })
      }
      await sleep(60)
    },
    async type(text) {
      await send('Input.insertText', { text })
      await sleep(40)
    },
    async shot(path, clip) {
      const result = await send('Page.captureScreenshot', {
        format: 'png',
        ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
      })
      writeFileSync(path, Buffer.from(result.result.data, 'base64'))
    },
    async waitFor(expression, timeout = 4000) {
      const until = Date.now() + timeout
      while (Date.now() < until) {
        if (await api.eval(expression)) return true
        await sleep(50)
      }
      throw new Error(`timed out waiting for ${expression}`)
    },
  }
  return api
}
