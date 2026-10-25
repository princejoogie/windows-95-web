import { children } from '../fs/fs'
import { createNode, fs } from '../fs/store'
import { WINDOWS_DIR } from '../fs/types'

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
