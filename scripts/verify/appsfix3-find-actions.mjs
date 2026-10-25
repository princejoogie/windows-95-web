import assert from 'node:assert/strict'
import { clickText, connect, hoverMenuItem, menuItem, reset, run } from './appsfix3-cdp.mjs'

const d = await connect(9411)
const nodes = async () => {
  await d.wait(200)
  return d.evaluate('Object.values(JSON.parse(localStorage.getItem("w95.fs.v1")).nodes)')
}
const context = () => d.clickSel('.find-results tbody tr', { button: 'right' })
try {
  await reset(d)
  await run(d, 'find')
  await d.type('*.txt')
  await d.evaluate(`window.findAnimationProof = []; window.findObserver = new MutationObserver(() => {
    const glass = document.querySelector('.find-animation img');
    if (glass) window.findAnimationProof.push(getComputedStyle(glass).animationName);
  }); window.findObserver.observe(document.querySelector('.find-app'), {subtree:true, attributes:true, childList:true})`)
  await d.key('Enter')
  await d.wait(200)
  console.log('search animation:', await d.evaluate('window.findAnimationProof'))
  assert.ok(await d.evaluate('window.findAnimationProof.some(name => name !== "none")'))
  await d.evaluate('window.findObserver.disconnect()')
  await d.clickSel('.find-results tbody tr')
  await d.key('F10', { shift: true })
  await menuItem(d, 'Copy')
  await context()
  await menuItem(d, 'Open Containing Folder')
  await d.key('v', { ctrl: true })
  await d.wait(200)
  assert.ok((await nodes()).some((node) => node.name === 'Copy of Readme.txt'))
  await d.key('F4', { alt: true })
  await context()
  await menuItem(d, 'Rename')
  assert.equal(await d.evaluate(`document.querySelector('[aria-label="New name"]').value`), 'Readme')
  await d.key('a', { ctrl: true })
  await d.type('Notes')
  await d.key('Enter')
  await d.wait(200)
  const note = (await nodes()).find((node) => node.name === 'Notes.txt')
  assert.ok(note)
  assert.equal(
    await d.evaluate('document.querySelector(".find-results tbody td").textContent.trim()'),
    'Notes',
  )
  await context()
  await menuItem(d, 'Create Shortcut')
  assert.ok(
    (await nodes()).some(
      (node) => node.kind === 'shortcut' && node.target === note.id && node.parent === note.parent,
    ),
  )
  await context()
  await hoverMenuItem(d, 'Send To')
  await menuItem(d, 'Desktop (create shortcut)')
  assert.ok(
    (await nodes()).some(
      (node) => node.kind === 'shortcut' && node.target === note.id && node.parent !== note.parent,
    ),
  )
  await context()
  await menuItem(d, 'Delete')
  await d.shot('10-find-delete')
  await clickText(d, '[role=dialog] button', 'Yes')
  assert.equal(await d.evaluate('document.querySelectorAll(".find-results tbody tr").length'), 0)
  await run(d, 'explorer')
  await clickText(d, '[data-window]:has(.explorer-body) [role=menubar] button', 'Edit')
  await menuItem(d, 'Undo Delete')
  await d.wait(200)
  assert.equal((await nodes()).find((node) => node.id === note.id)?.parent, note.parent)
  await d.key('F4', { alt: true })
  assert.equal(await d.evaluate('document.querySelectorAll(".find-results tbody tr").length'), 1)
  await d.shot('10-find-actions-restored')
  console.log(
    'PASS findings 10/37: animation, Shift+F10, copy/paste, hidden-extension rename, shortcuts, delete and shell undo',
  )
} finally {
  await d.close()
}
