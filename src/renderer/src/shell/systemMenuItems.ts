import { createStore } from '../lib/store'
import type { MenuEntry } from '../ui/Menu'
import type { WindowId } from './types'

export const systemMenuItems = createStore(
  (_state: ReadonlyMap<WindowId, readonly MenuEntry[]>, next: ReadonlyMap<WindowId, readonly MenuEntry[]>) =>
    next,
  new Map<WindowId, readonly MenuEntry[]>(),
)

export function registerSystemMenuItems(id: WindowId, items: readonly MenuEntry[]) {
  systemMenuItems.dispatch(new Map(systemMenuItems.get()).set(id, items))
  return () => {
    if (systemMenuItems.get().get(id) !== items) return
    const next = new Map(systemMenuItems.get())
    next.delete(id)
    systemMenuItems.dispatch(next)
  }
}
