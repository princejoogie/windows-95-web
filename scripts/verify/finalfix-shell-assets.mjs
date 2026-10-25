import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { connect, sleep } from './cdp.mjs'

const proof = 'D:/codes/worktrees/windows-95-web/proof/finalfix-shell'
const targets = await (await fetch('http://127.0.0.1:9440/json/list')).json()
const target = targets.find((target) => target.type === 'page')
const socket = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }))
let sequence = 0
const failures = []
const requests = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  if (message.method === 'Network.requestWillBeSent')
    requests.set(message.params.requestId, message.params.request.url)
  if (message.method === 'Network.loadingFailed')
    failures.push({ ...message.params, url: requests.get(message.params.requestId) })
})
socket.send(JSON.stringify({ id: ++sequence, method: 'Network.enable' }))
const app = await connect(9440)
try {
  await app.send('Page.reload')
  await sleep(200)
  await app.waitFor(`!!document.querySelector('[data-desktop]')`)
  await app.key('Escape', ['Control'])
  await app.key('r')
  await app.type('notepad')
  await app.key('Enter')
  const cursors = await app.eval(
    `[...document.querySelectorAll('[data-window] > div,[data-taskbar-resize]')].map(e=>({cursor:getComputedStyle(e).cursor,rect:e.getBoundingClientRect().toJSON()})).filter(e=>/size[1-4]_r/.test(e.cursor))`,
  )
  for (const { rect } of cursors)
    await app.move(rect.x + Math.min(2, rect.width / 2), rect.y + Math.min(2, rect.height / 2))
  const urls = [...new Set(cursors.map((e) => e.cursor.match(/url\("([^"]+)"\)/)?.[1]).filter(Boolean))]
  const assets = await app.eval(
    `Promise.all(${JSON.stringify(urls)}.map(async url=>({url,bytes:(await (await fetch(url)).arrayBuffer()).byteLength})))`,
  )
  await sleep(200)
  const receipt = { renderer: target.url, cursors, assets, failures }
  writeFileSync(`${proof}/cursor-assets.json`, JSON.stringify(receipt, null, 2))
  assert.equal(assets.length, 4)
  assert(assets.every((a) => a.bytes > 0 && a.url.includes('/assets/')))
  assert.equal(failures.length, 0, JSON.stringify(failures))
  console.log('PASS 11 Four packaged resize cursor assets loaded; no failed asset requests.')
} finally {
  app.close()
  socket.close()
}
