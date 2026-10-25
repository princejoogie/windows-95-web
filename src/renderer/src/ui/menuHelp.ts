import type { MenuState } from '../shell/menuMachine'
import type { MenuEntry } from './Menu'

/**
 * The status bar text for the highlighted menu item: its `help`, or blank while a menu is open on an item
 * without help, as Windows 95 clears the bar. `null` once the menus close, so the app shows its own text.
 */
export function highlightedHelp(roots: readonly (readonly MenuEntry[])[], state: MenuState): string | null {
  if (state.kind === 'closed') return null
  if (state.kind === 'bar-armed') return ''
  let items = roots[state.title] ?? []
  let help = ''
  for (const index of state.path) {
    const entry = items[index]
    if (!entry || entry === 'separator') break
    help = entry.help ?? ''
    items = entry.items ?? []
  }
  return help
}
