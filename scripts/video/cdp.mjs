import { writeFileSync } from 'node:fs'
import { setTimeout as wait } from 'node:timers/promises'

export { wait }

const codes = {
  Enter: 13,
  Escape: 27,
  Tab: 9,
  ' ': 32,
  Pause: 19,
  Control: 17,
  ArrowUp: 38,
  ArrowDown: 40,
  ArrowLeft: 37,
  ArrowRight: 39,
  F2: 113,
}

export async function connect(port) {
  let target
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      target = targets.find((item) => item.type === 'page' && item.url !== 'about:blank')
      if (target) break
    } catch {}
    await wait(100)
  }
  if (!target) throw new Error(`No Electron page on port ${port}`)
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let nextId = 0
  const pending = new Map()
  const listeners = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id) {
      const request = pending.get(message.id)
      if (!request) return
      clearTimeout(request.timeout)
      pending.delete(message.id)
      if (message.error) request.reject(new Error(JSON.stringify(message.error)))
      else request.resolve(message.result)
    } else {
      for (const listener of listeners.get(message.method) ?? []) listener(message.params)
    }
  })
  socket.addEventListener('close', () => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout)
      request.reject(new Error('Electron CDP connection closed'))
    }
    pending.clear()
  })
  const c = {
    url: target.url,
    cue: () => {},
    pos: [512, 384],
    smooth: false,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++nextId
        const timeout = setTimeout(() => {
          pending.delete(id)
          reject(new Error(`CDP timeout: ${method}`))
        }, 15000)
        pending.set(id, { resolve, reject, timeout })
        socket.send(JSON.stringify({ id, method, params }))
      })
    },
    on(method, listener) {
      if (!listeners.has(method)) listeners.set(method, new Set())
      listeners.get(method).add(listener)
      return () => listeners.get(method).delete(listener)
    },
    close() {
      socket.close()
    },
    async reload() {
      const loaded = new Promise((resolve, reject) => {
        const remove = c.on('Page.loadEventFired', () => {
          clearTimeout(timeout)
          remove()
          resolve()
        })
        const timeout = setTimeout(() => {
          remove()
          reject(new Error('Production page reload timed out'))
        }, 10000)
      })
      await c.send('Page.reload')
      await loaded
    },
    async eval(expression) {
      const result = await c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails)
        throw new Error(result.exceptionDetails.exception?.description ?? expression)
      return result.result?.value
    },
    async check(expression, name) {
      if (!(await c.eval(expression))) throw new Error(`Scene check failed: ${name}`)
      console.log(`  PASS ${name}`)
    },
    async until(expression, timeout = 8000) {
      const end = performance.now() + timeout
      while (performance.now() < end) {
        if (await c.eval(expression)) return
        await wait(50)
      }
      throw new Error(`Timed out: ${expression}`)
    },
    async point(expression, offset) {
      const result = await c.eval(`(() => {
        const e = ${expression}; if (!e) throw Error('Missing element: ' + ${JSON.stringify(expression)});
        const r = e.getBoundingClientRect();
        return [Math.round(r.x + ${offset ? offset[0] : 'r.width / 2'}), Math.round(r.y + ${offset ? offset[1] : 'r.height / 2'})];
      })()`)
      return result
    },
    async mouse(type, x, y, { button = 'left', buttons = 0, count = 1 } = {}) {
      c.pos = [Math.round(x), Math.round(y)]
      await c.send('Input.dispatchMouseEvent', {
        type,
        x: Math.round(x),
        y: Math.round(y),
        button: type === 'mouseMoved' && !buttons ? 'none' : button,
        buttons,
        clickCount: count,
      })
    },
    async move(x, y) {
      await c.mouse('mouseMoved', x, y)
    },
    async glide(x, y, { buttons = 0 } = {}) {
      const [fromX, fromY] = c.pos
      const distance = Math.hypot(x - fromX, y - fromY)
      if (!c.smooth || distance < 3) return c.mouse('mouseMoved', x, y, { buttons })
      const ms = Math.min(380, 110 + distance * 0.45)
      const steps = Math.max(4, Math.round(ms / 16))
      const begin = performance.now()
      for (let step = 1; step <= steps; step++) {
        const t = step / steps
        const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
        await c.mouse('mouseMoved', fromX + (x - fromX) * eased, fromY + (y - fromY) * eased, { buttons })
        await wait(Math.max(0, begin + ms * t - performance.now()))
      }
    },
    async click(expression, { count = 1, button = 'left', offset } = {}) {
      const [x, y] = Array.isArray(expression) ? expression : await c.point(expression, offset)
      await c.glide(x, y)
      for (let n = 1; n <= count; n++) {
        await c.mouse('mousePressed', x, y, { button, buttons: button === 'left' ? 1 : 2, count: n })
        await c.mouse('mouseReleased', x, y, { button, count: n })
      }
      c.cue('click')
      await wait(90)
    },
    async hover(expression, settle = 380) {
      await c.glide(...(await c.point(expression)))
      await wait(settle)
    },
    async keyDown(key, modifiers = 0) {
      await c.send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key,
        code: key === 'Control' ? 'ControlLeft' : key.length === 1 ? `Key${key.toUpperCase()}` : key,
        windowsVirtualKeyCode: codes[key] ?? key.toUpperCase().charCodeAt(0),
        modifiers,
      })
    },
    async keyUp(key, modifiers = 0) {
      await c.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key,
        code: key === 'Control' ? 'ControlLeft' : key.length === 1 ? `Key${key.toUpperCase()}` : key,
        windowsVirtualKeyCode: codes[key] ?? key.toUpperCase().charCodeAt(0),
        modifiers,
      })
    },
    async key(key, modifiers = 0) {
      await c.keyDown(key, modifiers)
      if (key === 'Enter')
        await c.send('Input.dispatchKeyEvent', {
          type: 'char',
          text: '\r',
          key: 'Enter',
          windowsVirtualKeyCode: 13,
        })
      await c.keyUp(key, modifiers)
      await wait(80)
    },
    async type(text, delay = 0) {
      for (const char of delay ? [...text] : [text]) {
        await c.send('Input.insertText', { text: char })
        if (delay) {
          c.cue('key')
          await wait(delay)
        }
      }
    },
    async drag(points, ms = 350) {
      await c.glide(...points[0])
      await c.mouse('mousePressed', ...points[0], { buttons: 1 })
      const path = c.smooth
        ? points.flatMap((point, index) => {
            if (!index) return [point]
            const [fromX, fromY] = points[index - 1]
            const steps = Math.max(1, Math.round(Math.hypot(point[0] - fromX, point[1] - fromY) / 6))
            return Array.from({ length: steps }, (_, step) => [
              fromX + ((point[0] - fromX) * (step + 1)) / steps,
              fromY + ((point[1] - fromY) * (step + 1)) / steps,
            ])
          })
        : points
      const begin = performance.now()
      for (let index = 1; index < path.length; index++) {
        await c.mouse('mouseMoved', ...path[index], { buttons: 1 })
        await wait(Math.max(0, begin + (ms * index) / (path.length - 1) - performance.now()))
      }
      await c.mouse('mouseReleased', ...points.at(-1))
    },
    async shot(file) {
      const result = await c.send('Page.captureScreenshot', { format: 'png' })
      writeFileSync(file, Buffer.from(result.data, 'base64'))
    },
  }
  return c
}

export const element = (selector) => `document.querySelector(${JSON.stringify(selector)})`
export const textElement = (text, selector = 'button, [role=menuitem]') =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].reverse().find(e => e.getClientRects().length && (e.textContent.trim() === ${JSON.stringify(text)} || e.getAttribute('aria-label') === ${JSON.stringify(text)} || (e.getAttribute('role') === 'menuitem' && e.children[1]?.textContent.trim() === ${JSON.stringify(text)})))`
