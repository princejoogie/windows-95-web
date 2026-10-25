import { children } from '../../fs/fs'
import { DESKTOP_DIR, type FsState, RECYCLED_DIR, ROOT } from '../../fs/types'
import type { Location } from './model'

export const TREE_DESKTOP = 'shell:desktop'

export interface TreeEntry {
  readonly key: string
  readonly label: string
  readonly location: Location | null
  readonly children: readonly TreeEntry[]
}
export interface TreeRow extends TreeEntry {
  readonly depth: number
  readonly lines: readonly boolean[]
  readonly last: boolean
}

export function folderTree(state: FsState): TreeEntry {
  const folder = (id: keyof FsState['nodes']): TreeEntry => ({
    key: id,
    label: state.nodes[id]?.kind === 'drive' ? '(C:)' : (state.nodes[id]?.name ?? ''),
    location: { kind: 'folder', id },
    children: children(state, id)
      .filter((node) => node.kind === 'folder' && node.id !== RECYCLED_DIR && !node.attributes?.hidden)
      .map((node) => folder(node.id)),
  })
  return {
    key: TREE_DESKTOP,
    label: 'Desktop',
    location: { kind: 'folder', id: DESKTOP_DIR },
    children: [
      {
        key: 'computer',
        label: 'My Computer',
        location: { kind: 'computer' },
        children: [
          { key: 'floppy', label: '3½ Floppy (A:)', location: null, children: [] },
          folder(ROOT),
          {
            key: 'controlpanel',
            label: 'Control Panel',
            location: { kind: 'shell', id: 'controlpanel' },
            children: [],
          },
          { key: 'printers', label: 'Printers', location: { kind: 'shell', id: 'printers' }, children: [] },
        ],
      },
      {
        key: 'network',
        label: 'Network Neighborhood',
        location: { kind: 'shell', id: 'network' },
        children: [],
      },
      { key: 'recycle', label: 'Recycle Bin', location: { kind: 'recycle' }, children: [] },
    ],
  }
}

export function treeRows(root: TreeEntry, expanded: ReadonlySet<string>): TreeRow[] {
  const rows: TreeRow[] = []
  const visit = (entry: TreeEntry, depth: number, lines: readonly boolean[], last: boolean) => {
    rows.push({ ...entry, depth, lines, last })
    if (!expanded.has(entry.key)) return
    entry.children.forEach((child, index) => {
      visit(child, depth + 1, [...lines, !last], index === entry.children.length - 1)
    })
  }
  visit(root, 0, [], true)
  return rows
}

export function expandTo(root: TreeEntry, key: string, expanded: ReadonlySet<string>): ReadonlySet<string> {
  const path = (entry: TreeEntry): string[] | null => {
    if (entry.key === key) return [entry.key]
    for (const child of entry.children) {
      const found = path(child)
      if (found) return [entry.key, ...found]
    }
    return null
  }
  return new Set([...expanded, ...(path(root) ?? []).slice(0, -1)])
}
