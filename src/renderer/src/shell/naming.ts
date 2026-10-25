import { extension } from '../fs/fs'
import type { FsNode } from '../fs/types'

/** The name a folder window shows: registered extensions hidden when the option is on. */
export function displayName(node: FsNode, hideExtensions: boolean, known: ReadonlySet<string>): string {
  if (node.kind === 'drive') return '(C:)'
  const ext = extension(node.name)
  return hideExtensions && node.kind !== 'folder' && node.kind !== 'shortcut' && known.has(ext)
    ? node.name.slice(0, -(ext.length + 1))
    : node.name
}

/** The full name for a rename typed against a display name, so a hidden extension survives it. */
export function renamedName(
  node: FsNode,
  name: string,
  hideExtensions: boolean,
  known: ReadonlySet<string>,
): string {
  return (
    name +
    (displayName(node, hideExtensions, known) !== node.name && node.kind !== 'drive'
      ? node.name.slice(node.name.lastIndexOf('.'))
      : '')
  )
}
