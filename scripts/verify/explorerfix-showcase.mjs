// Historical proof from an earlier rebuild round. See scripts/verify/README.md.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { clickText, connect, hoverMenuItem, menuItem, reset } from './explorerfix-driver.mjs'

const d = await connect(9380)
try {
  await reset(d)
  await clickText(d, 'button', 'Start')
  await hoverMenuItem(d, 'Programs')
  await menuItem(d, 'Windows Explorer')
  assert.equal(await d.evaluate('Boolean(document.querySelector(\'[role="tree"]\'))'), true)
  await d.wait(200)
  const result = await d.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(
    'D:/codes/worktrees/windows-95-web/proof/explorerfix/final-exploring.png',
    Buffer.from(result.result.data, 'base64'),
  )
  assert.deepEqual(d.diagnostics, [])
} finally {
  await d.close()
}
