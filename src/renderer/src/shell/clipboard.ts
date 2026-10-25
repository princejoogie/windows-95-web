import { type FsAction, findChild, fsReducer, isInside } from '../fs/fs'
import { type FsNode, type FsState, type NodeId, RECYCLED_DIR } from '../fs/types'
import { createStore } from '../lib/store'

/** What Cut or Copy put on the shell clipboard. Paste reads it; a pasted Cut empties it. */
export type Clip = { readonly op: 'cut' | 'copy'; readonly ids: readonly NodeId[] } | null

export const clipboard = createStore<Clip, Clip>((_state, next) => next, null)

/** What a new shortcut points at: an installed app, such as My Computer, or a node. */
export type ShortcutTarget =
  | { readonly kind: 'app'; readonly app: string; readonly label: string }
  | { readonly kind: 'node'; readonly id: NodeId }

export type Plan =
  | { readonly ok: true; readonly actions: readonly FsAction[]; readonly created: readonly NodeId[] }
  | { readonly ok: false; readonly title: string; readonly message: string }

const MAX_HOPS = 8

export type Resolved =
  | { readonly kind: 'app'; readonly app: string }
  | { readonly kind: 'node'; readonly node: FsNode }

/** Follows a shortcut to the app or node it opens. `null` when the target is gone or in the Recycle Bin. */
export function resolveShortcut(state: FsState, node: FsNode): Resolved | null {
  let current: FsNode | undefined = node
  for (let hop = 0; hop < MAX_HOPS && current; hop++) {
    if (current.kind !== 'shortcut') return { kind: 'node', node: current }
    if (current.target === undefined) return { kind: 'app', app: current.app }
    current = state.nodes[current.target]
    if (current && isInside(state, current.id, RECYCLED_DIR)) return null
  }
  return null
}

/** Explorer's numbering for copies: `Copy of X`, then `Copy (2) of X`. */
export function copyName(state: FsState, parent: NodeId, name: string): string {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `Copy of ${name}` : `Copy (${n}) of ${name}`
    if (!findChild(state, parent, candidate)) return candidate
  }
}

/** `Shortcut to X`, then `Shortcut (2) to X`. */
export function shortcutName(state: FsState, parent: NodeId, label: string): string {
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? `Shortcut to ${label}` : `Shortcut (${n}) to ${label}`
    if (!findChild(state, parent, candidate)) return candidate
  }
}

/** Every node under `id`, parents before children. */
function subtree(state: FsState, id: NodeId): FsNode[] {
  const root = state.nodes[id]
  if (!root) return []
  const nodes = [root]
  for (let i = 0; i < nodes.length; i++) {
    const parent = nodes[i]?.id
    for (const node of Object.values(state.nodes)) if (node.parent === parent) nodes.push(node)
  }
  return nodes
}

/**
 * The file system actions a Paste into `dest` performs, or the message Windows shows when it can't. Copies
 * get fresh ids from `makeId`; a copy into the item's own folder is named `Copy of X`.
 */
export function planPaste(state: FsState, clip: Clip, dest: NodeId, at: number, makeId: () => NodeId): Plan {
  const folder = state.nodes[dest]
  if (!clip || !folder || (folder.kind !== 'folder' && folder.kind !== 'drive')) {
    return { ok: true, actions: [], created: [] }
  }
  const verb = clip.op === 'cut' ? 'move' : 'copy'
  const fail = (node: FsNode, reason: string): Plan => ({
    ok: false,
    title: clip.op === 'cut' ? 'Error Moving File' : 'Error Copying File',
    message: `Cannot ${verb} ${node.name}: ${reason}`,
  })
  let working = state
  const actions: FsAction[] = []
  const created: NodeId[] = []
  const apply = (action: FsAction) => {
    actions.push(action)
    working = fsReducer(working, action)
  }
  for (const id of clip.ids) {
    const node = working.nodes[id]
    if (!node || node.kind === 'drive' || isInside(working, id, RECYCLED_DIR)) continue
    if (isInside(working, dest, id)) {
      return fail(node, 'The destination folder is a subfolder of the source folder.')
    }
    if (clip.op === 'cut') {
      if (node.parent === dest) return fail(node, 'The source and destination file names are the same.')
      if (findChild(working, dest, node.name)) {
        return fail(node, 'A file with the name you specified already exists. Specify a different filename.')
      }
      apply({ type: 'move', id, parent: dest, at })
      created.push(id)
      continue
    }
    const name = node.parent === dest ? copyName(working, dest, node.name) : node.name
    if (findChild(working, dest, name)) {
      return fail(node, 'A file with the name you specified already exists. Specify a different filename.')
    }
    const ids = new Map<NodeId, NodeId>()
    for (const original of subtree(working, id)) {
      const copy = makeId()
      ids.set(original.id, copy)
      const isRoot = original.id === id
      const parent = isRoot ? dest : (ids.get(original.parent as NodeId) as NodeId)
      apply({
        type: 'create',
        node: { ...original, id: copy, parent, name: isRoot ? name : original.name, created: at },
      })
      if (isRoot) created.push(copy)
    }
  }
  return { ok: true, actions, created }
}

/** Creates one `Shortcut to X` in `dest` for each target. */
export function planShortcuts(
  state: FsState,
  targets: readonly ShortcutTarget[],
  dest: NodeId,
  at: number,
  makeId: () => NodeId,
): Plan {
  let working = state
  const actions: FsAction[] = []
  const created: NodeId[] = []
  for (const target of targets) {
    const node = target.kind === 'node' ? working.nodes[target.id] : undefined
    if (target.kind === 'node' && !node) continue
    const label = target.kind === 'app' ? target.label : (node?.name ?? '')
    const base = {
      id: makeId(),
      name: shortcutName(working, dest, label),
      parent: dest,
      modified: at,
      created: at,
    }
    const action: FsAction = {
      type: 'create',
      node:
        target.kind === 'app'
          ? { ...base, kind: 'shortcut', app: target.app }
          : { ...base, kind: 'shortcut', target: target.id },
    }
    actions.push(action)
    working = fsReducer(working, action)
    created.push(base.id)
  }
  return { ok: true, actions, created }
}
