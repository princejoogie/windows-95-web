import { useSyncExternalStore } from 'react'

export interface Store<S, A> {
  get(): S
  dispatch(action: A): void
  subscribe(listener: () => void): () => void
}

export function createStore<S, A>(reduce: (state: S, action: A) => S, initial: S): Store<S, A> {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    dispatch(action) {
      const next = reduce(state, action)
      if (next === state) return
      state = next
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** `select` must return a value that is stable while the state is unchanged, such as a slice of it. */
export function useStore<S, T>(store: Store<S, never>, select: (state: S) => T): T {
  return useSyncExternalStore(store.subscribe, () => select(store.get()))
}
