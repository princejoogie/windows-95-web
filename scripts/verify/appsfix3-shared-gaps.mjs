import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clickText, connect, reset, run } from './appsfix3-cdp.mjs'

const d = await connect(9411)
const out = process.env.W95_PROOF_DIR ?? 'D:/codes/worktrees/windows-95-web/proof/appsfix3'
const gaps = {}
try {
  await reset(d)
  await run(d, 'notepad')
  await d.type('hello')
  await d.key('s', { ctrl: true })
  gaps.saveAs = await d.evaluate('document.querySelector("[role=dialog]").innerText')
  await d.key('a', { ctrl: true })
  await d.type('Readme.txt')
  await d.key('Enter')
  gaps.overwrite = await d.evaluate(
    'Array.from(document.querySelectorAll("[role=dialog]")).map(e=>e.innerText)',
  )
  await d.shot('30-shared-overwrite-gap')
  await clickText(d, '[role=dialog] button', 'No')
  await clickText(d, '[role=dialog] button', 'Cancel')
  await d.key('o', { ctrl: true })
  await clickText(d, '[role=dialog] button', 'No')
  await d.type('missing.txt')
  await d.key('Enter')
  gaps.missingFile = await d.evaluate(
    'Array.from(document.querySelectorAll("[role=dialog]")).map(e=>e.innerText)',
  )
  await d.shot('30-shared-missing-file-gap')
  await reset(d)
  await run(d, 'command')
  await d.key('Space', { alt: true })
  gaps.dosSystemMenu = await d.evaluate(
    'Array.from(document.querySelectorAll("[role=menuitem]")).map(e=>e.textContent)',
  )
  await d.shot('34-shared-system-menu-gap')
  await reset(d)
  await run(d, 'winhlp32')
  gaps.helpCaption = await d.evaluate(
    'Array.from(document.querySelectorAll("[data-window] button[aria-label]")).map(e=>({label:e.getAttribute("aria-label"),disabled:e.disabled}))',
  )
  await d.shot('35-shared-caption-gap')
  writeFileSync(join(out, 'shared-gaps.json'), `${JSON.stringify(gaps, null, 2)}\n`)
  console.log(
    'RECORDED shared-owner gaps: file dialog labels/prompts, DOS system-menu extensions, Help caption buttons',
  )
} finally {
  await d.close()
}
