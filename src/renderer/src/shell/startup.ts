import { children } from '../fs/fs'
import { createNode, fs } from '../fs/store'
import { WINDOWS_DIR } from '../fs/types'
import type { AppManifest } from './types'

export function startMenuFolder(path: readonly string[] = ['Start Menu', 'Programs', 'StartUp']) {
  let parent = WINDOWS_DIR
  for (const name of path) {
    const folder = children(fs.get(), parent).find((node) => node.name === name && node.kind === 'folder')
    if (folder) parent = folder.id
    else {
      const created = createNode(parent, name, { kind: 'folder' })
      if ('error' in created) return null
      parent = created.id
    }
  }
  return parent
}

export function installStartMenu(apps: readonly AppManifest[]): void {
  const marker = children(fs.get(), WINDOWS_DIR).find(
    (node) => node.kind === 'file' && node.name === 'WIN95SM.INI',
  )
  let installed: string[] = []
  try {
    const saved: unknown = JSON.parse(marker?.kind === 'file' ? marker.content : '[]')
    if (Array.isArray(saved)) installed = saved.filter((id): id is string => typeof id === 'string')
  } catch {}
  for (const app of apps) {
    if (!app.startMenu || installed.includes(app.id)) continue
    const folder = startMenuFolder(['Start Menu', 'Programs', ...app.startMenu])
    if (!folder) continue
    if (!children(fs.get(), folder).some((node) => node.kind === 'shortcut' && node.app === app.id)) {
      const created = createNode(folder, app.title, { kind: 'shortcut', app: app.id })
      if ('error' in created) continue
    }
    installed.push(app.id)
  }
  startMenuFolder()
  const content = JSON.stringify(installed)
  if (marker?.kind === 'file') {
    if (marker.content !== content) {
      const written = fs.write(marker.id, content)
      if (!written.ok) console.error(written.error)
    }
  } else {
    const created = createNode(WINDOWS_DIR, 'WIN95SM.INI', { kind: 'file', content })
    if ('id' in created) fs.setAttributes(created.id, { hidden: true, system: true })
  }
}
