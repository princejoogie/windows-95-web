import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const [port = '9310', proofDir = 'D:/codes/worktrees/windows-95-web/proof/assets'] = process.argv.slice(2)
const proof = resolve(proofDir)
mkdirSync(proof, { recursive: true })
const source = resolve(root, 'src/renderer/src/assets/system')
const backupRoot = mkdtempSync(join(proof, 'import-backup-'))
const backup = join(backupRoot, 'system')
assert(source.startsWith(resolve(root, 'src/renderer/src/assets') + sep))
assert(backup.startsWith(proof + sep))
const pnpm = process.platform === 'win32' ? 'pnpm.exe' : 'pnpm'
const missing = join(backupRoot, 'absent-windows')
const env = { ...process.env, W95_SYSTEM_ROOT: missing }
delete env.ELECTRON_RUN_AS_NODE
delete env.ELECTRON_RENDERER_URL
const run = (args, name, options = {}) => {
  const output = execFileSync(pnpm, args, { cwd: root, env, encoding: 'utf8', ...options })
  writeFileSync(join(proof, name), output)
  return output
}
let electron
let moved = false
try {
  assert(existsSync(source), 'Run the importer before the fallback check')
  renameSync(source, backup)
  moved = true
  run(['build'], 'fallback-build.log')
  run(['lint'], 'fallback-lint.log')
  const manifest = JSON.parse(readFileSync(join(source, 'manifest.cache'), 'utf8'))
  assert.equal(
    manifest.fonts.length + manifest.sounds.length + Object.keys(manifest.cursors).length,
    0,
    'Fallback imports no Windows assets',
  )
  run(
    ['exec', 'vite', 'build', '--config', 'scripts/verify/assets.sound.config.mjs'],
    'fallback-sound-build.log',
  )
  const stdout = openSync(join(proof, 'fallback-electron.stdout.log'), 'w')
  const stderr = openSync(join(proof, 'fallback-electron.stderr.log'), 'w')
  try {
    electron = spawn(join(root, 'node_modules/electron/dist/electron.exe'), ['.'], {
      cwd: root,
      env: {
        ...env,
        W95_CDP_PORT: port,
        W95_DATA_DIR: mkdtempSync(join(tmpdir(), 'win95-assets-fallback-')),
      },
      windowsHide: true,
      stdio: ['ignore', stdout, stderr],
    })
  } finally {
    closeSync(stdout)
    closeSync(stderr)
  }
  let ready = false
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      if (targets.some((target) => target.type === 'page' && target.url.startsWith('file:'))) {
        ready = true
        break
      }
    } catch {
      /* Electron has not opened its CDP endpoint yet. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  assert(ready, 'Fallback Electron starts within ten seconds')
  await new Promise((resolve) => setTimeout(resolve, 1200))
  for (const mode of ['fallback', 'sound-missing']) {
    const output = execFileSync(process.execPath, ['scripts/verify/assets.mjs', port, proof, mode], {
      cwd: root,
      encoding: 'utf8',
    })
    writeFileSync(join(proof, `${mode}-check.log`), output)
  }
  console.log('Fallback build, Electron desktop, and missing sound checks passed.')
} finally {
  if (electron && electron.exitCode === null) {
    const exited = new Promise((resolve) => electron.once('exit', resolve))
    electron.kill()
    await exited
  }
  if (moved) {
    assert.equal(source, resolve(root, 'src/renderer/src/assets/system'))
    rmSync(source, { recursive: true, force: true })
    renameSync(backup, source)
  }
  rmSync(backupRoot, { recursive: true })
  run(['build'], 'restored-build.log', {
    env: { ...process.env, W95_SYSTEM_ROOT: process.env.WINDIR ?? 'C:/Windows' },
  })
}
