import type { MenuEntry } from '../ui/Menu'
import { accelKey, plainLabel } from '../ui/text'

export type MenuState =
  | { kind: 'closed' }
  | { kind: 'bar-armed'; title: number }
  | { kind: 'open' | 'tracking'; title: number; path: readonly number[] }

export function menuItems(
  roots: readonly (readonly MenuEntry[])[],
  state: MenuState,
  depth: number,
): readonly MenuEntry[] {
  if (state.kind === 'closed') return []
  let items = roots[state.title] ?? []
  if (state.kind === 'bar-armed') return items
  for (let level = 0; level < depth; level++) {
    const item = items[state.path[level] ?? -1]
    items = item && item !== 'separator' ? (item.items ?? []) : []
  }
  return items
}

function step(items: readonly MenuEntry[], from: number, direction: number): number {
  for (let offset = 1; offset <= items.length; offset++) {
    const index = (from + direction * offset + items.length) % items.length
    if (items[index] !== 'separator') return index
  }
  return -1
}

export function menuKey(
  state: MenuState,
  key: string,
  roots: readonly (readonly MenuEntry[])[],
  bar: boolean,
  titles: readonly string[] = [],
): { state: MenuState; command?: Exclude<MenuEntry, 'separator'> } {
  if (state.kind === 'closed') return { state }
  if (state.kind === 'bar-armed') {
    const title = titles.findIndex((label) => accelKey(label) === key.toLowerCase())
    if (key.length === 1 && title >= 0)
      return { state: { kind: 'open', title, path: [step(roots[title] ?? [], -1, 1)] } }
    if (key === 'Escape' || key === 'Alt' || key === 'F10') return { state: { kind: 'closed' } }
    if (key === 'ArrowLeft' || key === 'ArrowRight')
      return {
        state: {
          ...state,
          title: (state.title + (key === 'ArrowRight' ? 1 : roots.length - 1)) % roots.length,
        },
      }
    if (key === 'Enter' || key === 'ArrowDown' || key === 'ArrowUp')
      return {
        state: {
          kind: 'open',
          title: state.title,
          path: [step(roots[state.title] ?? [], key === 'ArrowUp' ? 0 : -1, key === 'ArrowUp' ? -1 : 1)],
        },
      }
    return { state }
  }
  const depth = state.path.length - 1
  const items = menuItems(roots, state, depth)
  const selected = state.path[depth] ?? -1
  const entry = items[selected]
  const select = (index: number) => ({ ...state, path: [...state.path.slice(0, depth), index] })
  if (key === 'ArrowUp' || key === 'ArrowDown')
    return {
      state: select(
        step(items, selected < 0 && key === 'ArrowUp' ? 0 : selected, key === 'ArrowDown' ? 1 : -1),
      ),
    }
  if (key === 'Home' || key === 'End')
    return { state: select(step(items, key === 'Home' ? -1 : 0, key === 'Home' ? 1 : -1)) }
  if (key === 'Escape' || key === 'ArrowLeft') {
    if (depth > 0) return { state: { ...state, path: state.path.slice(0, -1) } }
    if (key === 'Escape')
      return { state: bar ? { kind: 'bar-armed', title: state.title } : { kind: 'closed' } }
  }
  const activate = (item: MenuEntry | undefined, next: MenuState) => {
    if (!item || item === 'separator' || item.disabled) return { state: next }
    if (item.items && next.kind !== 'closed' && next.kind !== 'bar-armed')
      return { state: { ...next, path: [...next.path, step(item.items, -1, 1)] } }
    return { state: { kind: 'closed' } satisfies MenuState, command: item }
  }
  if (key === 'Enter' || (key === 'ArrowRight' && entry && entry !== 'separator' && entry.items))
    return activate(entry, state)
  if ((key === 'ArrowRight' || key === 'ArrowLeft') && bar) {
    const title = (state.title + (key === 'ArrowRight' ? 1 : roots.length - 1)) % roots.length
    return { state: { kind: 'open', title, path: [step(roots[title] ?? [], -1, 1)] } }
  }
  if (key.length === 1) {
    const index = items.findIndex(
      (item) =>
        item !== 'separator' &&
        (accelKey(item.label) ?? plainLabel(item.label)[0]?.toLowerCase()) === key.toLowerCase(),
    )
    if (index >= 0) return activate(items[index], select(index))
  }
  return { state }
}
