import { children } from '../fs/fs'
import { DESKTOP_DIR, type FsNode, type FsState, type NodeId, ROOT } from '../fs/types'
import { driveName } from '../shell/naming'
import { DOCUMENTS, type FileTypeFilter, isPickable, matchesFileType, type Pickable } from './fileChoice'
import { isHidden } from './properties'

/** Where the dialog is looking. Desktop and My Computer are shell places, not folders. */
export type Place =
  | { readonly kind: 'desktop' }
  | { readonly kind: 'computer' }
  | { readonly kind: 'folder'; readonly id: NodeId }

/** One row of the Look in drop-down: the tree from Desktop down to the current folder. */
export interface PlaceRow {
  readonly key: string
  readonly place: Place
  readonly label: string
  readonly indent: number
  readonly kind: 'desktop' | 'computer' | 'drive' | 'folder'
}

/** One entry in the file list: a place to enter, or a file to pick. */
export type ListEntry =
  | {
      readonly kind: 'place'
      readonly key: string
      readonly label: string
      readonly place: Place
      readonly node?: FsNode
    }
  | { readonly kind: 'file'; readonly key: string; readonly label: string; readonly node: FsNode }

export const placeKey = (place: Place): string => (place.kind === 'folder' ? place.id : place.kind)

export const samePlace = (a: Place, b: Place): boolean => placeKey(a) === placeKey(b)

/** The dialog opens on Desktop when asked for the Desktop folder, as Windows shows it. */
export const placeOf = (id: NodeId): Place =>
  id === DESKTOP_DIR ? { kind: 'desktop' } : { kind: 'folder', id }

/** The folder a typed name is relative to. */
export function folderOf(place: Place): NodeId {
  if (place.kind === 'desktop') return DESKTOP_DIR
  if (place.kind === 'computer') return ROOT
  return place.id
}

/** A drive shows as `(C:)`, the way Windows labels a drive without a volume name. */
export const placeLabel = (node: FsNode): string => (node.kind === 'drive' ? driveName(node) : node.name)

export function parentPlace(state: FsState, place: Place): Place | null {
  if (place.kind === 'desktop') return null
  if (place.kind === 'computer') return { kind: 'desktop' }
  const node = state.nodes[place.id]
  if (!node?.parent) return { kind: 'computer' }
  return { kind: 'folder', id: node.parent }
}

/** Desktop, My Computer, the drives, and the folders between C: and the current folder, indented. */
export function lookInRows(state: FsState, current: Place): PlaceRow[] {
  const rows: PlaceRow[] = [
    { key: 'desktop', place: { kind: 'desktop' }, label: 'Desktop', indent: 0, kind: 'desktop' },
    { key: 'computer', place: { kind: 'computer' }, label: 'My Computer', indent: 1, kind: 'computer' },
  ]
  const chain: FsNode[] = []
  if (current.kind === 'folder') {
    for (
      let node = state.nodes[current.id];
      node;
      node = node.parent ? state.nodes[node.parent] : undefined
    ) {
      chain.unshift(node)
    }
  }
  const drives = Object.values(state.nodes).filter((node) => node.kind === 'drive')
  for (const drive of drives) {
    rows.push({
      key: drive.id,
      place: { kind: 'folder', id: drive.id },
      label: placeLabel(drive),
      indent: 2,
      kind: 'drive',
    })
    if (chain[0]?.id !== drive.id) continue
    chain.slice(1).forEach((node, depth) => {
      rows.push({
        key: node.id,
        place: { kind: 'folder', id: node.id },
        label: node.name,
        indent: 3 + depth,
        kind: 'folder',
      })
    })
  }
  return rows
}

/** What the file list shows in a place: folders first, then files the filter matches. Hidden items stay out. */
export function listEntries(
  state: FsState,
  place: Place,
  filter: FileTypeFilter,
  pickable: readonly Pickable[] = DOCUMENTS,
): ListEntry[] {
  if (place.kind === 'computer') {
    return Object.values(state.nodes)
      .filter((node) => node.kind === 'drive')
      .map((node) => ({
        kind: 'place',
        key: node.id,
        label: placeLabel(node),
        place: { kind: 'folder', id: node.id },
        node,
      }))
  }
  const shell: ListEntry[] =
    place.kind === 'desktop'
      ? [{ kind: 'place', key: 'computer', label: 'My Computer', place: { kind: 'computer' } }]
      : []
  const nodes = children(state, folderOf(place)).filter((node) => !isHidden(node))
  const entries: ListEntry[] = nodes.flatMap((node): ListEntry[] => {
    if (node.kind === 'folder')
      return [{ kind: 'place', key: node.id, label: node.name, place: { kind: 'folder', id: node.id }, node }]
    if (isPickable(node, pickable) && matchesFileType(node.name, filter))
      return [{ kind: 'file', key: node.id, label: node.name, node }]
    return []
  })
  return [...shell, ...entries]
}
