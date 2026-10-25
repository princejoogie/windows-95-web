// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [port = '9341', proofDir = 'D:/codes/worktrees/windows-95-web/proof/solfix'] = process.argv.slice(2)
mkdirSync(proofDir, { recursive: true })
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const page = targets.find((target) => target.type === 'page')
if (!page) throw new Error(`No Electron page on CDP port ${port}`)
export const productionUrl = page.url
export const socket = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let id = 0
const pending = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  const request = pending.get(message.id)
  if (!request) return
  pending.delete(message.id)
  if (message.error) request.reject(new Error(JSON.stringify(message.error)))
  else request.resolve(message.result)
})
export function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
export async function load(method, params = {}) {
  await send('Page.enable')
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.removeEventListener('message', listener)
      reject(new Error('Page load timed out'))
    }, 10000)
    function listener({ data }) {
      if (JSON.parse(data).method !== 'Page.loadEventFired') return
      clearTimeout(timeout)
      socket.removeEventListener('message', listener)
      resolve()
    }
    socket.addEventListener('message', listener)
  })
  await send(method, params)
  await loaded
}
export async function read(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
  return result.result?.value
}
export const wait = (milliseconds = 100) => new Promise((resolve) => setTimeout(resolve, milliseconds))
export async function point(expression) {
  const result = await read(
    `(()=>{const el=${expression}; if(!el) throw Error('Missing element'); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}})()`,
  )
  return { x: Math.round(result.x), y: Math.round(result.y) }
}
export async function mouse(type, position, extras = {}) {
  await send('Input.dispatchMouseEvent', { type, ...position, ...extras })
}
export async function click(expression) {
  const position = await point(expression)
  await mouse('mouseMoved', position)
  await mouse('mousePressed', position, { button: 'left', clickCount: 1 })
  await mouse('mouseReleased', position, { button: 'left', clickCount: 1 })
  await wait()
}
export const button = (name) =>
  `Array.from(document.querySelectorAll('button')).find(e=>e.textContent.trim()===${JSON.stringify(name)} || e.getAttribute('aria-label')===${JSON.stringify(name)})`
export async function menu(name, item) {
  await click(button(name))
  await click(
    `Array.from(document.querySelectorAll('[role=menuitem]')).find(e=>e.textContent.replaceAll('&','').trim().startsWith(${JSON.stringify(item)}))`,
  )
}
export async function key(key, modifiers = 0) {
  const code =
    {
      Enter: 13,
      Escape: 27,
      F2: 113,
      Tab: 9,
      ' ': 32,
      ArrowLeft: 37,
      ArrowUp: 38,
      ArrowRight: 39,
      ArrowDown: 40,
    }[key] ?? (key.length === 1 ? key.toUpperCase().charCodeAt(0) : undefined)
  await send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key,
    modifiers,
    windowsVirtualKeyCode: code,
    text: key === 'Enter' ? String.fromCharCode(13) : key === ' ' ? ' ' : undefined,
  })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key, modifiers, windowsVirtualKeyCode: code })
  await wait()
}
export async function drag(source, target) {
  const start = await read(
    `(()=>{const r=(${source}).getBoundingClientRect();return {x:Math.round(r.x+15),y:Math.round(r.y+5)}})()`,
  )
  const end = await point(target)
  await mouse('mouseMoved', start)
  await mouse('mousePressed', start, { button: 'left', buttons: 1, clickCount: 1 })
  for (let step = 1; step <= 8; step++) {
    await mouse(
      'mouseMoved',
      {
        x: Math.round(start.x + ((end.x - start.x) * step) / 8),
        y: Math.round(start.y + ((end.y - start.y) * step) / 8),
      },
      { button: 'left', buttons: 1 },
    )
  }
  await mouse('mouseReleased', end, { button: 'left', clickCount: 1 })
  await wait()
}
export async function shot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(proofDir, `${name}.png`), Buffer.from(result.data, 'base64'))
}
export async function check(expression, name) {
  const value = await read(expression)
  if (!value) throw new Error(`FAIL ${name}`)
  console.log(`PASS ${name}`)
}
