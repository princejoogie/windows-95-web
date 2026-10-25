import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Packaging requires Windows x64.')

const root = fileURLToPath(new URL('..', import.meta.url))
const release = resolve(root, 'release')
const output = join(release, 'Windows 95-win32-x64')
const archive = `${output}.zip`
const executable = join(output, 'Windows 95.exe')
const require = createRequire(import.meta.url)
const electron = dirname(require('electron'))
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
if (dirname(output) !== release) throw new Error('Package output must be inside release.')

rmSync(output, { recursive: true, force: true })
mkdirSync(release, { recursive: true })
cpSync(electron, output, { recursive: true })
renameSync(join(output, 'electron.exe'), executable)
rmSync(join(output, 'resources/default_app.asar'), { force: true })
const app = join(output, 'resources/app')
mkdirSync(app, { recursive: true })
writeFileSync(
  join(app, 'package.json'),
  JSON.stringify(
    {
      name: manifest.name,
      productName: manifest.productName,
      version: manifest.version,
      main: 'out/main/index.js',
      type: 'module',
    },
    null,
    2,
  ),
)
cpSync(join(root, 'out'), join(app, 'out'), { recursive: true })
execFileSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    join(root, 'scripts/set-icon.ps1'),
    '-Executable',
    executable,
    '-Icon',
    join(root, 'src/renderer/public/icon.ico'),
  ],
  { stdio: 'inherit' },
)
execFileSync(
  'powershell.exe',
  ['-NoProfile', '-File', join(root, 'scripts/archive.ps1'), '-Folder', output, '-Destination', archive],
  { stdio: 'inherit' },
)
process.stdout.write(`Portable app: ${executable}\nArchive: ${archive}\n`)
