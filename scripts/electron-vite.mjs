import { spawn } from 'node:child_process'

// Hosts that are themselves Electron apps (T3 Code, VS Code terminals) export
// ELECTRON_RUN_AS_NODE=1, which makes electron.exe start as plain Node.
delete process.env.ELECTRON_RUN_AS_NODE

const child = spawn('electron-vite', process.argv.slice(2), { stdio: 'inherit', shell: true })
child.on('exit', (code) => process.exit(code ?? 1))
