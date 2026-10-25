// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clickText, connect, reset } from './explorerfix-driver.mjs'

const out = 'D:/codes/worktrees/windows-95-web/proof/explorerfix'
const d = await connect(9380)
const results = []
const check = async (finding, name, expression) => {
  const actual = await d.evaluate(expression)
  results.push({ finding, name, actual })
  assert.equal(actual, true, name)
}
const shot = async (name) => {
  await d.wait(100)
  const result = await d.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(out, `${name}.png`), Buffer.from(result.result.data, 'base64'))
}
const point = async (selector) => {
  const r = await d.rect(selector)
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
}
const drop = async (source, end, ctrl = false, name) => {
  const start = await point(source)
  const modifiers = ctrl ? 2 : 0
  await d.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start, modifiers })
  await d.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...start,
    button: 'left',
    buttons: 1,
    clickCount: 1,
    modifiers,
  })
  for (let i = 1; i <= 8; i++) {
    await d.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: start.x + ((end.x - start.x) * i) / 8,
      y: start.y + ((end.y - start.y) * i) / 8,
      button: 'left',
      buttons: 1,
      modifiers,
    })
    await d.wait(15)
  }
  if (name) await shot(name)
  await d.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...end,
    button: 'left',
    buttons: 0,
    clickCount: 1,
    modifiers,
  })
  await d.wait(150)
}
try {
  await reset(d)
  await d.clickSel('[data-desktop-item="app:mycomputer"]', { clickCount: 2 })
  await d.clickSel('[data-node-id="c"]', { clickCount: 2 })
  await d.clickSel('[data-window][aria-label="My Computer"] button[aria-label="Close"]')
  const root = '[data-location="(C:)"]'
  await drop(
    `${root} [data-node-id="autoexec"]`,
    await point(`${root} [data-node-id="documents"]`),
    false,
    'drag-onto-folder',
  )
  await check(
    13,
    'Drop onto folder moves item',
    `!document.querySelector('${root} [data-node-id="autoexec"]')`,
  )
  await d.clickSel(`${root} [data-node-id="documents"]`, { clickCount: 2 })
  const docWindow = '[data-window][aria-label="My Documents"]'
  const r = await d.rect(docWindow)
  await d.drag(r.x + 100, r.y + 10, 620, 50)
  const docs = '[data-location="My Documents"]'
  const docsList = await d.rect(`${docs} .explorer-items`)
  await drop(
    `${root} [data-node-id="config"]`,
    { x: docsList.x + 220, y: docsList.y + 170 },
    true,
    'ctrl-drag-copy',
  )
  await check(
    13,
    'Ctrl drag copies between folder windows',
    `Boolean(document.querySelector('${root} [data-node-id="config"]')) && Boolean(document.querySelector('${docs} [aria-label="CONFIG.SYS"]'))`,
  )
  const rootList = await d.rect(`${root} .explorer-items`)
  await drop(`${docs} [aria-label="Readme.txt"]`, { x: rootList.x + 210, y: rootList.y + 170 })
  await check(
    13,
    'Drag between folder windows moves item',
    `Boolean(document.querySelector('${root} [aria-label="Readme.txt"]')) && !document.querySelector('${docs} [aria-label="Readme.txt"]')`,
  )
  await drop(`${root} [aria-label="Readme.txt"]`, { x: 920, y: 650 })
  await check(
    13,
    'Folder to desktop moves item',
    `Boolean(document.querySelector('[data-desktop-item="readme"]')) && !document.querySelector('${root} [aria-label="Readme.txt"]')`,
  )
  await shot('folder-to-desktop')
  await drop('[data-desktop-item="readme"]', { x: docsList.x + 220, y: docsList.y + 170 })
  await check(
    13,
    'Desktop to folder moves item',
    `!document.querySelector('[data-desktop-item="readme"]') && Boolean(document.querySelector('${docs} [aria-label="Readme.txt"]'))`,
  )
  await drop(`${docs} [aria-label="CONFIG.SYS"]`, await point('[data-desktop-item="app:recyclebin"]'))
  await check(
    13,
    'Drag to Recycle Bin asks for confirmation',
    `Boolean(document.querySelector('[role="dialog"]')) && document.querySelector('[role="dialog"]').innerText.includes("'CONFIG.SYS'")`,
  )
  await clickText(d, '[role="dialog"] button', 'Yes')
  await check(
    13,
    'Confirmed drop recycles item',
    `!document.querySelector('${docs} [aria-label="CONFIG.SYS"]') && Boolean(document.querySelector('${root} [data-node-id="config"]'))`,
  )
  const start = { x: rootList.x + rootList.width - 8, y: rootList.y + 120 }
  const end = { x: rootList.x + 2, y: rootList.y + 2 }
  await d.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...start })
  await d.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...start,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  })
  await d.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...end, button: 'left', buttons: 1 })
  await check(
    27,
    'Rubber band appears and selects several items',
    `Boolean(document.querySelector('[data-rubber-band]')) && document.querySelectorAll('${root} .explorer-item[aria-selected="true"]').length>=3`,
  )
  await shot('rubber-band')
  await d.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...end,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  })
  await check(
    27,
    'Rubber band clears after release and retains selection',
    `!document.querySelector('[data-rubber-band]') && document.querySelectorAll('${root} .explorer-item[aria-selected="true"]').length>=3`,
  )
  await shot('drag-results')
  console.log(`${results.length} pointer assertions passed`)
} finally {
  writeFileSync(join(out, 'drag-runtime-errors.json'), `${JSON.stringify(d.diagnostics, null, 2)}\n`)
  writeFileSync(join(out, 'drag-assertions.json'), `${JSON.stringify(results, null, 2)}\n`)
  await d.close()
}
