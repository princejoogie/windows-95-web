import { type Grid, isSolid } from './grid'

const EPSILON = 1e-6

export interface Position {
  x: number
  y: number
}

/** Whether a circle of radius `r` at `(x, y)` overlaps a solid cell. */
function overlapsSolid(grid: Grid, x: number, y: number, r: number): boolean {
  const x0 = Math.floor(x - r)
  const x1 = Math.floor(x + r - EPSILON)
  const y0 = Math.floor(y - r)
  const y1 = Math.floor(y + r - EPSILON)
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (isSolid(grid, cx, cy)) return true
  return false
}

/**
 * Moves a circle by `(dx, dy)`, one axis at a time, so a move into a wall keeps the part that runs
 * along it. A blocked axis stops flush against the wall. `blocked` adds things such as monsters and
 * barrels, which cancel the axis instead. Keep each step under one cell.
 */
export function slideMove(
  grid: Grid,
  pos: Position,
  r: number,
  dx: number,
  dy: number,
  blocked?: (x: number, y: number) => boolean,
): void {
  if (dx !== 0) {
    let x = pos.x + dx
    if (overlapsSolid(grid, x, pos.y, r)) x = dx > 0 ? Math.floor(x + r) - r : Math.floor(x - r) + 1 + r
    if (overlapsSolid(grid, x, pos.y, r) || blocked?.(x, pos.y)) x = pos.x
    pos.x = x
  }
  if (dy !== 0) {
    let y = pos.y + dy
    if (overlapsSolid(grid, pos.x, y, r)) y = dy > 0 ? Math.floor(y + r) - r : Math.floor(y - r) + 1 + r
    if (overlapsSolid(grid, pos.x, y, r) || blocked?.(pos.x, y)) y = pos.y
    pos.y = y
  }
}
