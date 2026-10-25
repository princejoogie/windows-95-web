import { fsStore } from '../fs/store'
import type { FsNode } from '../fs/types'
import { icons } from '../icons'
import { resolveShortcut } from './clipboard'
import { getApp } from './registry'

export interface NodeIcon {
  readonly icon: string
  /** Drawn over the bottom-left corner, as Windows marks shortcuts. */
  readonly overlay?: string
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
      const icon = !target
        ? icons.program
        : target.kind === 'app'
          ? (getApp(target.app)?.icon ?? icons.program)
          : nodeIcon(target.node).icon
      return { icon, overlay: icons.shortcutArrow }
    }
    case 'file':
      return { icon: icons.document }
  }
}
