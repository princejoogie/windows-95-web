import type { WindowId } from './types'
import type { WindowState } from './windows'

export function switcherOrder(windows: readonly WindowState[]): readonly WindowId[] {
  return [...windows].reverse().map((window) => window.id)
}
export function cycleTask(
  order: readonly WindowId[],
  selected: WindowId | undefined,
  reverse: boolean,
): WindowId | undefined {
  if (!order.length) return undefined
  const index = selected === undefined ? 0 : order.indexOf(selected)
  return order[(index + (reverse ? order.length - 1 : 1)) % order.length]
}
