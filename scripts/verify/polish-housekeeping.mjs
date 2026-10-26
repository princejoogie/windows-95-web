import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const directory = join(root, 'scripts/verify')
const active = new Set([
  'README.md',
  'cdp.mjs',
  'polish.mjs',
  'polish.config.mjs',
  'polish-housekeeping.mjs',
  'doomfix-episode.mjs',
  'finalfix-shell.mjs',
  'finalfix-shell-assets.mjs',
  'finalfix-apps-documents.mjs',
  'finalfix-apps-controlpanel.mjs',
])
const scripts = readdirSync(directory)
let historical = 0
let syntax = 0
for (const name of scripts) {
  const path = join(directory, name)
  if (!active.has(name)) {
    assert.match(
      readFileSync(path, 'utf8').slice(0, 512),
      /Historical proof/,
      `${name} needs a historical marker or a current live check`,
    )
    historical++
  }
  if (name.endsWith('.mjs')) {
    const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8', windowsHide: true })
    assert.equal(result.status, 0, `${name}: ${result.stderr}`)
    syntax++
  }
}

function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? files(path) : [relative(root, path).replaceAll('\\', '/')]
  })
}
const source = files(join(root, 'src'))
const clutter = source.filter((path) =>
  /(?:^|\/)(?:reports?|scratch|proof|\.audit|tmp|temp)(?:[./_-]|$)|\.(?:log|tmp|bak|jsonl)$|(?:REPORT|FINDINGS)\.md$/i.test(
    path,
  ),
)
assert.deepEqual(clutter, [], 'Reports and scratch files belong outside src')
console.log(
  JSON.stringify(
    {
      sourceFiles: source.length,
      sourceClutter: clutter.length,
      verificationFiles: scripts.length,
      historical,
      active: [...active],
      syntaxChecks: syntax,
    },
    null,
    2,
  ),
)
