import { type FsAction, fsReducer, isInside, validateName } from '../fs/fs'
import { type FsNode, type FsState, RECYCLED_DIR } from '../fs/types'
import { createStore } from '../lib/store'

interface Change {
  readonly before: FsNode
  readonly after: FsNode
}
export interface UndoEntry {
  readonly label: string
  readonly changes: readonly Change[]
  /** Top-level nodes the operation made, such as a copy's new files. Undo deletes them. */
  readonly created?: readonly FsNode[]
}
export const history = createStore<readonly UndoEntry[], readonly UndoEntry[]>((_state, next) => next, [])

export function undoEntry(before: FsState, after: FsState, label: string): UndoEntry | null {
  const changes: Change[] = []
  for (const node of Object.values(before.nodes)) {
    const next = after.nodes[node.id]
    if (next && (node.name !== next.name || node.parent !== next.parent))
      changes.push({ before: node, after: next })
  }
  const created = Object.values(after.nodes).filter(
    (node) =>
      !before.nodes[node.id] && !(node.parent && after.nodes[node.parent] && !before.nodes[node.parent]),
  )
  if (!changes.length && !created.length) return null
  return created.length ? { label, changes, created } : { label, changes }
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
  for (const node of entry.created ?? []) {
    const current = working.nodes[node.id]
    if (!current || current.name !== node.name || current.parent !== node.parent)
      return { ok: false, message: 'The item has changed since the last operation and cannot be undone.' }
    add({ type: 'purge', id: node.id })
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

/** Undoes the newest entry. Returns the message Windows shows when it can't, or `null` when it worked. */
export function undoLast(
  state: FsState,
  dispatch: (action: FsAction) => void,
  at = Date.now(),
): string | null {
  const entry = history.get().at(-1)
  if (!entry) return null
  const plan = planUndo(state, entry, at)
  if (!plan.ok) return plan.message
  for (const action of plan.actions) dispatch(action)
  history.dispatch(history.get().slice(0, -1))
  return null
}

/** `&Undo Delete`, as the Edit and context menus name the newest entry. */
export const undoLabel = (entries: readonly UndoEntry[]): string =>
  `&Undo${entries.at(-1) ? ` ${entries.at(-1)?.label}` : ''}`
