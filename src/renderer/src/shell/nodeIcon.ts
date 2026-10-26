import { shellFolder } from '../apps/explorer/shellFolders'
import { extension } from '../fs/fs'
import { fsStore } from '../fs/store'
import type { FsNode } from '../fs/types'
import { icons } from '../icons'
import { resolveShortcut } from './clipboard'
import { fileTypeIcons } from './fileTypeIcons'
import { getApp } from './registry'
import { shellShortcutApp } from './shellShortcut'

export interface NodeIcon {
  readonly icon: string
  /** Drawn over the bottom-left corner, as Windows marks shortcuts. */
  readonly overlay?: string
}

/** The picture a Change Icon choice names: an app's icon for `app:<id>`, else one of the shell's 32x32 icons. */
export function iconChoice(key: string): string | undefined {
  if (key.startsWith('app:')) return getApp(key.slice(4))?.icon
  const icon: unknown = (icons as Record<string, unknown>)[key]
  return typeof icon === 'string' ? icon : undefined
}

/** The 32x32 picture Explorer and the desktop show for a node. */
export function nodeIcon(node: FsNode): NodeIcon {
  switch (node.kind) {
    case 'drive':
      return { icon: icons.drive }
    case 'folder':
      return { icon: icons.folderClosed }
    case 'program':
      return { icon: getApp(node.app)?.icon ?? icons.program }
    case 'shortcut': {
      const target = resolveShortcut(fsStore.get(), node)
      const shell = target?.kind === 'shell' ? target.target : null
      const chosen = node.icon ? iconChoice(node.icon) : undefined
      const icon = chosen
        ? chosen
        : !target
          ? icons.program
          : target.kind === 'app'
            ? (getApp(target.app)?.icon ?? icons.program)
            : target.kind === 'shell'
              ? ((shell?.kind === 'item'
                  ? shellFolder(shell.folder)?.items.find((item) => item.key === shell.item)?.icon
                  : undefined) ??
                getApp(shellShortcutApp(target.target))?.icon ??
                icons.folderClosed)
              : nodeIcon(target.node).icon
      return { icon, overlay: icons.shortcutArrow }
    }
    case 'file':
      return { icon: fileTypeIcons[extension(node.name)] ?? icons.document }
  }
}
