import type { Point, Size } from './types'

export const CELL = { width: 75, height: 75 }
export const ORIGIN = { x: 2, y: 4 }

export type Positions = Readonly<Record<string, Point>>

export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type Direction = 'up' | 'down' | 'left' | 'right'

export const cellAt = (point: Point) => ({
  column: Math.round((point.x - ORIGIN.x) / CELL.width),
  row: Math.round((point.y - ORIGIN.y) / CELL.height),
})

export const pointOf = (column: number, row: number): Point => ({
  x: ORIGIN.x + column * CELL.width,
  y: ORIGIN.y + row * CELL.height,
})

export const snap = (point: Point): Point => {
  const cell = cellAt(point)
  return pointOf(Math.max(0, cell.column), Math.max(0, cell.row))
}

const rowsOn = (desktop: Size) => Math.max(1, Math.floor((desktop.height - ORIGIN.y) / CELL.height))

/** Saved spots first; everything else fills free cells top to bottom, then left to right. */
export function layout(keys: readonly string[], saved: Positions, desktop: Size): Map<string, Point> {
  const rows = rowsOn(desktop)
  const placed = new Map<string, Point>()
  const taken = new Set<string>()
  for (const key of keys) {
    const point = saved[key]
    if (!point) continue
    placed.set(key, point)
    const cell = cellAt(point)
    taken.add(`${cell.column}:${cell.row}`)
  }
  let slot = 0
  for (const key of keys) {
    if (placed.has(key)) continue
    while (taken.has(`${Math.floor(slot / rows)}:${slot % rows}`)) slot++
    placed.set(key, pointOf(Math.floor(slot / rows), slot % rows))
    slot++
  }
  return placed
}

/** Positions for `keys` in order, down the first column, then the next: what Arrange Icons writes. */
export function arranged(keys: readonly string[], desktop: Size): Positions {
  const rows = rowsOn(desktop)
  return Object.fromEntries(keys.map((key, index) => [key, pointOf(Math.floor(index / rows), index % rows)]))
}

/** Reading order on the desktop: down each column, columns left to right. */
export function gridOrder(positions: ReadonlyMap<string, Point>): string[] {
  return [...positions].sort(([, a], [, b]) => a.x - b.x || a.y - b.y).map(([key]) => key)
}

/**
 * The icon an arrow key moves to: the nearest one lying in that direction, preferring the same column or
 * row. With nothing focused, the first icon.
 */
export function neighbor(
  positions: ReadonlyMap<string, Point>,
  from: string | null,
  direction: Direction,
): string | null {
  const origin = from ? positions.get(from) : undefined
  if (!origin) return gridOrder(positions)[0] ?? null
  let best: string | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const [key, point] of positions) {
    if (key === from) continue
    const dx = point.x - origin.x
    const dy = point.y - origin.y
    const ahead = { up: -dy, down: dy, left: -dx, right: dx }[direction]
    const aside = direction === 'up' || direction === 'down' ? dx : dy
    if (ahead <= 0) continue
    const score = ahead * ahead + 4 * aside * aside
    if (score < bestScore) {
      best = key
      bestScore = score
    }
  }
  return best ?? from
}

/**
 * Incremental search over labels in display order. A buffer of one repeated letter cycles through the
 * labels starting with it; a longer prefix stays on the current item while it still matches.
 */
export function typeAhead(
  items: readonly { readonly key: string; readonly label: string }[],
  current: string | null,
  buffer: string,
): string | null {
  const typed = buffer.toLowerCase()
  if (!typed) return null
  const repeated = [...typed].every((char) => char === typed[0])
  const prefix = repeated ? (typed[0] as string) : typed
  const start = Math.max(
    0,
    items.findIndex((item) => item.key === current),
  )
  const skipCurrent = repeated && current !== null
  for (let step = skipCurrent ? 1 : 0; step <= items.length; step++) {
    const item = items[(start + step) % items.length]
    if (item?.label.toLowerCase().startsWith(prefix)) return item.key
  }
  return null
}

export const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

/** The rectangle two drag corners span. */
export const spanned = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
})

/** Keys whose icon or label touches the rubber band. Each item may have several rects. */
export function touched(band: Rect, items: ReadonlyMap<string, readonly Rect[]>): string[] {
  return [...items].filter(([, rects]) => rects.some((rect) => intersects(band, rect))).map(([key]) => key)
}
