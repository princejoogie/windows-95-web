import { isInside } from '../fs/fs'
import { shortcutKey } from '../fs/shortcutKey'
import { type FsState, type NodeId, RECYCLED_DIR } from '../fs/types'
import { resolveShortcut } from './clipboard'

export function shortcutForKey(state: FsState, key: string): NodeId | undefined {
  const letter = shortcutKey(key)
  if (!letter) return
  return Object.values(state.nodes).find(
    (node) =>
      node.kind === 'shortcut' &&
      node.shortcutKey === letter &&
      !isInside(state, node.id, RECYCLED_DIR) &&
      resolveShortcut(state, node) !== null,
  )?.id
}
