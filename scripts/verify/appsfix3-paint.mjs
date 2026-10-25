import assert from 'node:assert/strict'
import { appMenu, clickText, connect, menuItem, reset, run } from './appsfix3-cdp.mjs'

const d = await connect(9411)
try {
  await reset(d)
  await run(d, 'mspaint')
  await appMenu(d, 'File')
  assert.equal(
    await d.evaluate(
      'Array.from(document.querySelectorAll("[role=menuitem]")).filter(e=>e.textContent.startsWith("Set As Wallpaper")).every(e=>e.getAttribute("aria-disabled")==="true")',
    ),
    true,
  )
  await d.key('Escape')
  await d.key('Escape')
  const canvas = await d.rect('[aria-label="Paint canvas"]')
  await d.drag(canvas.x + 10, canvas.y + 10, canvas.x + 80, canvas.y + 60)
  await d.key('s', { ctrl: true })
  await d.key('a', { ctrl: true })
  await d.type('wallpaper.bmp')
  await d.key('Enter')
  await d.wait(400)
  await appMenu(d, 'File')
  assert.equal(
    await d.evaluate(
      'Array.from(document.querySelectorAll("[role=menuitem]")).filter(e=>e.textContent.startsWith("Set As Wallpaper")).every(e=>e.getAttribute("aria-disabled")!=="true")',
    ),
    true,
  )
  await menuItem(d, 'Set As Wallpaper (Centered)')
  await d.wait(400)
  let settings = await d.evaluate('JSON.parse(localStorage.getItem("win95.settings.v1"))')
  assert.equal(settings.wallpaperMode, 'center')
  assert.ok(settings.wallpaper)
  await d.shot('13-paint-wallpaper-centered')
  await appMenu(d, 'File')
  await menuItem(d, 'Set As Wallpaper (Tiled)')
  await d.wait(400)
  settings = await d.evaluate('JSON.parse(localStorage.getItem("win95.settings.v1"))')
  assert.equal(settings.wallpaperMode, 'tile')
  assert.ok(
    await d.evaluate(
      'JSON.parse(localStorage.getItem("w95.recent.v1")).some(id=>JSON.parse(localStorage.getItem("w95.fs.v1")).nodes[id]?.name==="wallpaper.bmp")',
    ),
  )
  await d.clickSel('[data-window] button[aria-label=Minimize]')
  await d.shot('13-paint-wallpaper-tiled')
  await clickText(d, '[data-taskbar] button', 'wallpaper')
  await d.wait(350)
  await d.clickSel('button[aria-label=Text]')
  await d.clickSel('[role=combobox][aria-label=Font]')
  await d.shot('03-paint-font-combo')
  assert.equal(await d.evaluate('document.querySelectorAll("[data-window] select").length'), 0)
  console.log(
    'PASS findings 13, 3 Paint and 39 Paint: wallpaper guard, centered/tiled settings and desktop, recent save, classic font combo',
  )
} finally {
  await d.close()
}
