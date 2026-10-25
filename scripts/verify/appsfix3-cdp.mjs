// CDP driver for the fidelity audit. Usage from a scenario script:
//   import { connect } from './lib.mjs'
//   const d = await connect(9322)
//   await d.clickSel('[data-desktop-item="app:mycomputer"]', { clickCount: 2 })
//   await d.shot('mycomputer')
//   await d.close()
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.env.W95_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/appsfix3'

const VK = {
  Enter: 13,
  Escape: 27,
  Tab: 9,
  Backspace: 8,
  Delete: 46,
  Space: 32,
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Home: 36,
  End: 35,
  PageUp: 33,
  PageDown: 34,
  Insert: 45,
  F1: 112,
  F2: 113,
  F3: 114,
  F4: 115,
  F5: 116,
  F6: 117,
  F7: 118,
  F8: 119,
  F9: 120,
  F10: 121,
  F11: 122,
  F12: 123,
}
const CODE = {
  Enter: 'Enter',
  Escape: 'Escape',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Space: 'Space',
  ArrowLeft: 'ArrowLeft',
  ArrowUp: 'ArrowUp',
  ArrowRight: 'ArrowRight',
  ArrowDown: 'ArrowDown',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
}

export async function connect(port = 9396) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  const page = targets.find((t) => t.type === 'page')
  if (!page) throw new Error('no page target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true })
    ws.addEventListener('error', reject, { once: true })
  })
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg)
      pending.delete(msg.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id
      pending.set(n, resolve)
      ws.send(JSON.stringify({ id: n, method, params }))
    })
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.result?.exceptionDetails) {
      const d = result.result.exceptionDetails
      throw new Error(`eval failed: ${d.exception?.description ?? d.text}`)
    }
    return result.result?.result?.value
  }

  const rect = async (selector, index = 0) => {
    const r = await evaluate(
      `(() => { const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height } })()`,
    )
    if (!r) throw new Error(`no element for ${selector}[${index}]`)
    return r
  }

  const mouse = async (type, x, y, extra = {}) => {
    await send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), ...extra })
  }
  const click = async (x, y, { button = 'left', clickCount = 1, modifiers = 0 } = {}) => {
    const buttons = button === 'left' ? 1 : button === 'right' ? 2 : 4
    await mouse('mouseMoved', x, y, { modifiers })
    for (let i = 1; i <= clickCount; i++) {
      await mouse('mousePressed', x, y, { button, clickCount: i, buttons, modifiers })
      await mouse('mouseReleased', x, y, { button, clickCount: i, buttons: 0, modifiers })
    }
    await wait(80)
  }
  const clickSel = async (selector, opts = {}) => {
    const r = await rect(selector, opts.index ?? 0)
    await click(r.x + r.width / 2, r.y + r.height / 2, opts)
    return r
  }
  const move = async (x, y) => mouse('mouseMoved', x, y)
  const moveSel = async (selector, index = 0) => {
    const r = await rect(selector, index)
    await move(r.x + r.width / 2, r.y + r.height / 2)
  }
  const drag = async (x1, y1, x2, y2, steps = 8) => {
    await mouse('mouseMoved', x1, y1)
    await mouse('mousePressed', x1, y1, { button: 'left', clickCount: 1, buttons: 1 })
    for (let i = 1; i <= steps; i++) {
      await mouse('mouseMoved', x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps, {
        buttons: 1,
        button: 'left',
      })
      await wait(15)
    }
    await mouse('mouseReleased', x2, y2, { button: 'left', clickCount: 1, buttons: 0 })
    await wait(80)
  }

  const modBits = ({ alt, ctrl, meta, shift } = {}) =>
    (alt ? 1 : 0) | (ctrl ? 2 : 0) | (meta ? 4 : 0) | (shift ? 8 : 0)
  const PUNCT = {
    '.': [190, 'Period', false],
    ',': [188, 'Comma', false],
    '-': [189, 'Minus', false],
    '=': [187, 'Equal', false],
    '/': [191, 'Slash', false],
    ';': [186, 'Semicolon', false],
    "'": [222, 'Quote', false],
    '[': [219, 'BracketLeft', false],
    ']': [221, 'BracketRight', false],
    '`': [192, 'Backquote', false],
    ' ': [32, 'Space', false],
    '?': [191, 'Slash', true],
    '*': [56, 'Digit8', true],
    '+': [187, 'Equal', true],
    '@': [50, 'Digit2', true],
    '%': [53, 'Digit5', true],
    ':': [186, 'Semicolon', true],
    '"': [222, 'Quote', true],
    '<': [188, 'Comma', true],
    '>': [190, 'Period', true],
    '|': [220, 'Backslash', true],
    '!': [49, 'Digit1', true],
    '(': [57, 'Digit9', true],
    ')': [48, 'Digit0', true],
    _: [189, 'Minus', true],
    '#': [51, 'Digit3', true],
    $: [52, 'Digit4', true],
    '&': [55, 'Digit7', true],
    '^': [54, 'Digit6', true],
    '~': [192, 'Backquote', true],
  }
  const key = async (name, mods = {}) => {
    const single = name.length === 1
    const punct = single ? PUNCT[name] : undefined
    if (punct?.[2]) mods = { ...mods, shift: true }
    if (single && /[A-Z]/.test(name)) mods = { ...mods, shift: true }
    const modifiers = modBits(mods)
    const vk = punct ? punct[0] : single ? name.toUpperCase().charCodeAt(0) : (VK[name] ?? 0)
    const code = punct
      ? punct[1]
      : single
        ? /[a-z]/i.test(name)
          ? `Key${name.toUpperCase()}`
          : /\d/.test(name)
            ? `Digit${name}`
            : ''
        : (CODE[name] ?? name)
    const text = single ? name : name === 'Enter' ? '\r' : name === 'Space' ? ' ' : undefined
    const printable = text !== undefined && !mods.ctrl && !mods.alt
    const base = {
      key: name === 'Space' ? ' ' : name,
      code,
      windowsVirtualKeyCode: vk,
      nativeVirtualKeyCode: vk,
      modifiers,
    }
    await send('Input.dispatchKeyEvent', {
      type: printable ? 'keyDown' : 'rawKeyDown',
      ...base,
      text: printable ? text : undefined,
      unmodifiedText: printable ? text : undefined,
    })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base })
    await wait(60)
  }
  const type = async (text) => {
    for (const ch of text) {
      if (ch === '\n') await key('Enter')
      else await key(ch)
    }
  }

  const shot = async (name, delay = 250) => {
    await wait(delay)
    const res = await send('Page.captureScreenshot', { format: 'png' })
    const file = join(OUT, `${name}.png`)
    writeFileSync(file, Buffer.from(res.result.data, 'base64'))
    console.log('shot', file)
    return file
  }
  const close = () => ws.close()

  return { send, evaluate, rect, click, clickSel, move, moveSel, drag, key, type, shot, wait, close }
}

/** Centre of the first element matching a JS predicate over a selector's matches. */
export async function centerOf(d, selector, text) {
  const p = await d.evaluate(
    `(() => { const el = Array.from(document.querySelectorAll(${JSON.stringify(selector)})).find(e => { const t = e.textContent.trim().replace(/^Checked/, ''); return t === ${JSON.stringify(text)} || t.startsWith(${JSON.stringify(text)}) }); if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } })()`,
  )
  if (!p) throw new Error(`no ${selector} with text ${text}`)
  return p
}
export const clickText = async (d, selector, text, opts) => {
  const p = await centerOf(d, selector, text)
  await d.click(p.x, p.y, opts)
}
export const menuItem = (d, text, opts) => clickText(d, '[role="menu"] [role="menuitem"]', text, opts)
export const hoverMenuItem = async (d, text) => {
  const p = await centerOf(d, '[role="menu"] [role="menuitem"]', text)
  await d.move(p.x, p.y)
  await d.wait(450)
}

/** Fresh boot: clears the virtual drive and reloads the renderer. */
export async function reset(d) {
  await d.evaluate('localStorage.clear()')
  await d.send('Page.reload')
  await d.wait(1500)
  for (let i = 0; i < 20; i++) {
    const ready = await d
      .evaluate(`document.querySelector('[data-desktop-item="app:mycomputer"]') !== null`)
      .catch(() => false)
    if (ready) break
    await d.wait(250)
  }
  await d.wait(300)
}

/** Closes every window through its Close caption button, answering save prompts with No. */
export async function closeAll(d) {
  for (let i = 0; i < 30; i++) {
    const n = await d.evaluate(`document.querySelectorAll('[data-window]').length`)
    if (!n) return
    await d.evaluate(`(() => {
      const open = Array.from(document.querySelectorAll('[role="dialog"]'))
      for (const dlg of open) {
        const no = Array.from(dlg.querySelectorAll('button')).find(b => b.textContent.trim() === 'No' || b.textContent.trim() === 'Cancel' || b.textContent.trim() === 'OK')
        if (no) { no.click(); return }
        dlg.querySelector('button[aria-label="Close"]')?.click()
        return
      }
      const wins = Array.from(document.querySelectorAll('[data-window]'))
      wins.sort((a, b) => Number(b.style.zIndex) - Number(a.style.zIndex))
      wins[0]?.querySelector('button[aria-label="Close"]')?.click()
    })()`)
    await d.wait(200)
  }
}

// Common probes.
export const probes = {
  windows: `Array.from(document.querySelectorAll('[data-window]')).map(w => ({ id: w.dataset.window, title: w.getAttribute('aria-label'), rect: (({x,y,width,height}) => ({x,y,width,height}))(w.getBoundingClientRect()) }))`,
  menuItems: `Array.from(document.querySelectorAll('[role="menu"] [role="menuitem"]')).map(b => ({ text: b.textContent, disabled: b.getAttribute('aria-disabled') === 'true' }))`,
  menubar: `Array.from(document.querySelectorAll('[role="menubar"] > div > button')).map(b => b.textContent)`,
  dialogs: `Array.from(document.querySelectorAll('[role="dialog"]')).map(d => ({ title: d.getAttribute('aria-label'), text: d.innerText, rect: (({x,y,width,height}) => ({x,y,width,height}))(d.getBoundingClientRect()) }))`,
  focused: `(() => { const a = document.activeElement; return a ? { tag: a.tagName, label: a.getAttribute('aria-label'), text: a.textContent?.slice(0, 60), cls: a.className?.toString().slice(0,80) } : null })()`,
}
