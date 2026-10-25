import { createStore, useStore } from '../lib/store'
import { emptyDrive, fsReducer, validateName } from './fs'
import type { FsNode, FsState, NodeId, ProgramSpec } from './types'

const KEY = 'w95.fs.v1'
const SAVE_DELAY_MS = 250

function load(): FsState | null {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as FsState) : null
    return parsed?.version === 1 && parsed.nodes && parsed.recycled ? parsed : null
  } catch {
    return null
  }
}

const saved = load()
export const fsStore = createStore(fsReducer, saved ?? emptyDrive(Date.now()))

let timer: ReturnType<typeof setTimeout> | undefined
const save = () => {
  timer = undefined
  localStorage.setItem(KEY, JSON.stringify(fsStore.get()))
}
fsStore.subscribe(() => {
  timer ??= setTimeout(save, SAVE_DELAY_MS)
})
addEventListener('beforeunload', () => {
  if (timer !== undefined) save()
})

/** Installs every app's executable. Desktop shortcuts are created only on the first boot. */
export function installPrograms(programs: readonly ProgramSpec[]): void {
  fsStore.dispatch({ type: 'installPrograms', programs, shortcuts: saved === null, at: Date.now() })
}

export function useFs<T>(select: (state: FsState) => T): T {
  return useStore(fsStore, select)
}

export const newNodeId = (): NodeId => crypto.randomUUID() as NodeId

type NewNode = { kind: 'folder' } | { kind: 'file'; content: string } | { kind: 'shortcut'; app: string }

/** Creates a node and returns its id, or returns the error message Windows would show. */
export function createNode(parent: NodeId, name: string, spec: NewNode): { id: NodeId } | { error: string } {
  const error = validateName(fsStore.get(), parent, name)
  if (error) return { error }
  const id = newNodeId()
  const node = { ...spec, id, name, parent, modified: Date.now() } as FsNode
  fsStore.dispatch({ type: 'create', node })
  return { id }
}

export const fs = {
  get: fsStore.get,
  write: (id: NodeId, content: string) => fsStore.dispatch({ type: 'write', id, content, at: Date.now() }),
  rename(id: NodeId, name: string): string | null {
    const node = fsStore.get().nodes[id]
    if (!node?.parent) return 'This item cannot be renamed.'
    const error = validateName(fsStore.get(), node.parent, name, id)
    if (!error) fsStore.dispatch({ type: 'rename', id, name, at: Date.now() })
    return error
  },
  move: (id: NodeId, parent: NodeId) => fsStore.dispatch({ type: 'move', id, parent, at: Date.now() }),
  recycle: (id: NodeId) => fsStore.dispatch({ type: 'recycle', id, at: Date.now() }),
  restore: (id: NodeId) => fsStore.dispatch({ type: 'restore', id, at: Date.now() }),
  purge: (id: NodeId) => fsStore.dispatch({ type: 'purge', id }),
  emptyRecycleBin: () => fsStore.dispatch({ type: 'emptyRecycleBin' }),
}
