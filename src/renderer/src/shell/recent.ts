import { fsStore } from '../fs/store'
import type { NodeId } from '../fs/types'
import { createStore, useStore } from '../lib/store'

const KEY = 'w95.recent.v1'
function load(): readonly NodeId[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw
      .flatMap((id) => {
        const node = Object.values(fsStore.get().nodes).find((node) => node.id === id && node.kind === 'file')
        return node ? [node.id] : []
      })
      .slice(0, 15)
  } catch {
    return []
  }
}
const store = createStore(
  (state: readonly NodeId[], id: NodeId | null) =>
    id === null ? [] : [id, ...state.filter((entry) => entry !== id)].slice(0, 15),
  load(),
)
store.subscribe(() => localStorage.setItem(KEY, JSON.stringify(store.get())))
export const rememberDocument = (id: NodeId) => store.dispatch(id)
export const clearDocuments = () => store.dispatch(null)
export const useRecentDocuments = () => useStore(store, (state) => state)
