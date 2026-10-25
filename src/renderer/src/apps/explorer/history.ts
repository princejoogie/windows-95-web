import { type FsAction, fsReducer, isInside, validateName } from '../../fs/fs'
import { type FsNode, type FsState, RECYCLED_DIR } from '../../fs/types'
import { createStore } from '../../lib/store'

interface Change {
  readonly before: FsNode
  readonly after: FsNode
}
export interface UndoEntry {
  readonly label: string
  readonly changes: readonly Change[]
}
export const history = createStore<readonly UndoEntry[], readonly UndoEntry[]>((_state, next) => next, [])

export function undoEntry(before: FsState, after: FsState, label: string): UndoEntry | null {
  const changes: Change[] = []
  for (const node of Object.values(before.nodes)) {
    const next = after.nodes[node.id]
    if (next && (node.name !== next.name || node.parent !== next.parent))
      changes.push({ before: node, after: next })
  }
  return changes.length ? { label, changes } : null
}

export function planUndo(
  state: FsState,
  entry: UndoEntry,
  at: number,
): { ok: true; actions: readonly FsAction[] } | { ok: false; message: string } {
  let working = state
  const actions: FsAction[] = []
  const add = (action: FsAction) => {
    actions.push(action)
    working = fsReducer(working, action)
  }
  for (const { before, after } of [...entry.changes].reverse()) {
    const current = working.nodes[before.id]
    if (!current || current.name !== after.name || current.parent !== after.parent || !before.parent) {
      return { ok: false, message: 'The item has changed since the last operation and cannot be undone.' }
    }
    const parent = working.nodes[before.parent]
    const error = validateName(working, before.parent, before.name, before.id)
    if (!parent || isInside(working, parent.id, RECYCLED_DIR) || error) {
      return { ok: false, message: error ?? 'The original folder is no longer available.' }
    }
    if (working.recycled[before.id]) add({ type: 'restore', id: before.id, at })
    if (working.nodes[before.id]?.parent !== before.parent)
      add({ type: 'move', id: before.id, parent: before.parent, at })
    if (working.nodes[before.id]?.name !== before.name)
      add({ type: 'rename', id: before.id, name: before.name, at })
  }
  return { ok: true, actions }
}

export function remember(before: FsState, after: FsState, label: string): void {
  const entry = undoEntry(before, after, label)
  if (entry) history.dispatch([...history.get(), entry].slice(-20))
}
