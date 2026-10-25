import { children, extension, pathOf } from '../../fs/fs'
import { type FsNode, type FsState, type NodeId, RECYCLED_DIR } from '../../fs/types'

export type View = 'large' | 'small' | 'list' | 'details'
export type Location = { kind: 'folder'; id: NodeId } | { kind: 'computer' } | { kind: 'recycle' }
export type Column = 'name' | 'size' | 'type' | 'modified' | 'original' | 'deleted'
export interface Sort {
  column: Column
  direction: 'ascending' | 'descending'
}
export interface Selection {
  ids: ReadonlySet<NodeId>
  anchor: NodeId | null
}
export const emptySelection: Selection = { ids: new Set(), anchor: null }
export const columns: readonly { id: Column; label: string; width: number }[] = [
  { id: 'name', label: 'Name', width: 170 },
  { id: 'size', label: 'Size', width: 65 },
  { id: 'type', label: 'Type', width: 120 },
  { id: 'modified', label: 'Modified', width: 140 },
  { id: 'original', label: 'Original Location', width: 180 },
  { id: 'deleted', label: 'Date Deleted', width: 140 },
]

export function typeOf(node: FsNode): string {
  switch (node.kind) {
    case 'drive':
      return 'Local Disk'
    case 'folder':
      return 'File Folder'
    case 'program':
      return 'Application'
    case 'shortcut':
      return 'Shortcut'
    case 'file': {
      const ext = extension(node.name)
      if (ext === 'txt') return 'Text Document'
      if (ext === 'bat') return 'MS-DOS Batch File'
      return ext ? `${ext.toUpperCase()} File` : 'File'
    }
  }
}

export const sizeOf = (node: FsNode): number =>
  node.kind === 'file' ? new TextEncoder().encode(node.content).length : 0
export const formatDate = (at: number): string => new Date(at).toLocaleString('en-US')

export function cellValue(state: FsState, node: FsNode, column: Column): string {
  switch (column) {
    case 'name':
      return node.name
    case 'size':
      return node.kind === 'file' ? `${Math.ceil(sizeOf(node) / 1024)} KB` : ''
    case 'type':
      return typeOf(node)
    case 'modified':
      return formatDate(node.modified)
    case 'original': {
      const record = state.recycled[node.id]
      return record ? pathOf(state, record.from) : ''
    }
    case 'deleted': {
      const record = state.recycled[node.id]
      return record ? formatDate(record.at) : ''
    }
  }
}

export function visibleNodes(state: FsState, location: Location, sort: Sort): FsNode[] {
  const nodes =
    location.kind === 'computer'
      ? Object.values(state.nodes).filter((node) => node.kind === 'drive')
      : children(state, location.kind === 'recycle' ? RECYCLED_DIR : location.id).filter(
          (node) => node.id !== RECYCLED_DIR,
        )
  const rank = (node: FsNode) => (node.kind === 'folder' || node.kind === 'drive' ? 0 : 1)
  const value = (node: FsNode): number | string => {
    switch (sort.column) {
      case 'size':
        return sizeOf(node)
      case 'modified':
        return node.modified
      case 'deleted':
        return state.recycled[node.id]?.at ?? 0
      default:
        return cellValue(state, node, sort.column)
    }
  }
  return nodes.sort((a, b) => {
    const av = value(a)
    const bv = value(b)
    const comparison =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv), 'en', { sensitivity: 'base' })
    return (
      rank(a) - rank(b) ||
      (sort.direction === 'ascending' ? 1 : -1) *
        (comparison ||
          a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
          a.id.localeCompare(b.id))
    )
  })
}

export function selectNode({
  selection,
  order,
  id,
  ctrl,
  shift,
}: {
  selection: Selection
  order: readonly NodeId[]
  id: NodeId
  ctrl: boolean
  shift: boolean
}): Selection {
  if (!order.includes(id)) return selection
  const retained = new Set(order.filter((key) => selection.ids.has(key)))
  const anchorIndex = selection.anchor === null ? -1 : order.indexOf(selection.anchor)
  if (shift && anchorIndex >= 0) {
    const index = order.indexOf(id)
    const range = order.slice(Math.min(anchorIndex, index), Math.max(anchorIndex, index) + 1)
    return { ids: new Set(ctrl ? [...retained, ...range] : range), anchor: selection.anchor }
  }
  if (ctrl) {
    if (retained.has(id)) retained.delete(id)
    else retained.add(id)
    return { ids: retained, anchor: id }
  }
  return { ids: new Set([id]), anchor: id }
}
