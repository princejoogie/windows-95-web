// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import assert from 'node:assert/strict'
import { appMenu, clickText, connect, menuItem, reset, run } from './appsfix3-cdp.mjs'

const d = await connect(9411)
try {
  await reset(d)
  await run(d, 'find')
  await d.type('*.txt')
  await d.key('Enter')
  await d.wait(200)
  assert.equal(
    await d.evaluate(
      'document.querySelector(".find-app").closest("[data-window]").getAttribute("aria-label")',
    ),
    'Find: Files named *.txt',
  )
  assert.equal(
    await d.evaluate('document.querySelector(".find-results tbody tr td").textContent.trim()'),
    'Readme',
  )
  await d.clickSel('.find-results tbody tr', { button: 'right' })
  const labels = await d.evaluate(
    'Array.from(document.querySelectorAll("[role=menuitem]")).map(e => e.textContent)',
  )
  for (const label of [
    'Open',
    'Open Containing Folder',
    'Send To',
    'Cut',
    'Copy',
    'Create Shortcut',
    'Delete',
    'Rename',
    'Properties',
  ])
    assert.ok(labels.includes(label), label)
  await d.shot('10-find-context')
  await menuItem(d, 'Properties')
  assert.ok(await d.evaluate('document.querySelector("[role=dialog]").textContent.includes("Attributes:")'))
  await clickText(d, '[role=dialog] button', 'Cancel')
  await d.clickSel('.find-results tbody tr', { button: 'right' })
  await menuItem(d, 'Open Containing Folder')
  assert.ok(
    await d.evaluate(
      'Array.from(document.querySelectorAll("[data-window]")).some(e => e.getAttribute("aria-label") === "My Documents")',
    ),
  )
  await d.shot('37-find-containing-folder')
  await d.key('F4', { alt: true })
  await d.clickSel('[aria-label="Look in"]')
  const locations = await d.evaluate(
    'Array.from(document.querySelectorAll("[role=option]")).map(e=>e.textContent)',
  )
  for (const label of ['Document Folders', 'My Computer', '3½ Floppy (A:)', '(C:)', 'Desktop'])
    assert.ok(locations.includes(label), label)
  await d.shot('03-find-look-in')
  await d.key('Escape')
  await appMenu(d, 'Options')
  await menuItem(d, 'Save Results')
  await appMenu(d, 'File')
  await menuItem(d, 'Save Search')
  await d.wait(400)
  const saved = await d.evaluate(
    'Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes).find(n=>n.name==="Saved Search.fnd")',
  )
  assert.equal(JSON.parse(saved.content).criteria.name, '*.txt')
  assert.ok(JSON.parse(saved.content).results.length > 0)
  await clickText(d, '.find-app button', 'New Search')
  assert.ok(
    await d.evaluate(
      'document.querySelector("[role=dialog]").textContent.includes("This will clear your current search.")',
    ),
  )
  await d.shot('37-find-new-search')
  await clickText(d, '[role=dialog] button', 'Cancel')
  assert.equal(await d.evaluate('document.querySelector("[name=named]").value'), '*.txt')
  await d.key('F4', { alt: true })
  await clickText(d, '[data-desktop-item]', 'Saved Search', { clickCount: 2 })
  await d.wait(250)
  assert.equal(await d.evaluate('document.querySelector("[name=named]").value'), '*.txt')
  assert.ok(await d.evaluate('document.querySelectorAll(".find-results tbody tr").length > 0'))
  await d.shot('37-find-saved-search')
  console.log(
    'PASS findings 3 Find, 10, 37: context menu, properties, folder window, classic locations, confirmation, saved search and saved results',
  )
} finally {
  await d.close()
}
