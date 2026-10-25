import type { Grid } from './grid'
import { doorTexture, TEX } from './map'

/** Where a ray stopped. The renderer reuses one of these per frame instead of allocating per column. */
export interface RayHit {
  /** The hit point is `origin + t * dir`. With a unit `dir`, `t` is the distance. */
  t: number
  cell: number
  /** 0 when the ray crossed a vertical grid line (an east or west face), 1 for a north or south face. */
  side: 0 | 1
  /** Position across the face in [0, 1), oriented so textures never read mirrored. */
  u: number
  tex: number
}

export const createHit = (): RayHit => ({ t: 0, cell: 0, side: 0, u: 0, tex: 0 })

/**
 * Walks the grid with DDA from `(ox, oy)` along `(dx, dy)` and fills `hit` with the first wall or door
 * slab it meets. Doors are thin slabs on their cell's midline that slide aside as they open, and the
 * walls beside a door show the jamb texture. Returns false when nothing is hit within `maxT`.
 */
export function castRay(
  grid: Grid,
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  hit: RayHit,
  maxT = Number.POSITIVE_INFINITY,
): boolean {
  const { width, height, walls, doorAt, doors } = grid
  let mapX = Math.floor(ox)
  let mapY = Math.floor(oy)
  const deltaX = dx === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dx)
  const deltaY = dy === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dy)
  const stepX = dx < 0 ? -1 : 1
  const stepY = dy < 0 ? -1 : 1
  let sideX = dx < 0 ? (ox - mapX) * deltaX : (mapX + 1 - ox) * deltaX
  let sideY = dy < 0 ? (oy - mapY) * deltaY : (mapY + 1 - oy) * deltaY
  let fromDoor = false

  for (;;) {
    let t: number
    let side: 0 | 1
    if (sideX < sideY) {
      t = sideX
      sideX += deltaX
      mapX += stepX
      side = 0
    } else {
      t = sideY
      sideY += deltaY
      mapY += stepY
      side = 1
    }
    if (t > maxT || mapX < 0 || mapY < 0 || mapX >= width || mapY >= height) return false
    const cell = mapY * width + mapX
    const door = doors[doorAt[cell] ?? -1]
    if (door) {
      const exit = Math.min(sideX, sideY)
      if (door.axis === 'x' ? dy !== 0 : dx !== 0) {
        const tm = door.axis === 'x' ? (mapY + 0.5 - oy) / dy : (mapX + 0.5 - ox) / dx
        if (tm >= t && tm <= exit && tm <= maxT) {
          const along = door.axis === 'x' ? ox + tm * dx - mapX : oy + tm * dy - mapY
          if (along >= door.open) {
            hit.t = tm
            hit.cell = cell
            hit.side = door.axis === 'x' ? 1 : 0
            hit.u = along - door.open
            hit.tex = doorTexture(door.key)
            return true
          }
        }
      }
      fromDoor = true
      continue
    }
    const wall = walls[cell] ?? 0
    if (wall > 0) {
      let u: number
      if (side === 0) {
        u = oy + t * dy
        u -= Math.floor(u)
        if (dx < 0) u = 1 - u
      } else {
        u = ox + t * dx
        u -= Math.floor(u)
        if (dy > 0) u = 1 - u
      }
      hit.t = t
      hit.cell = cell
      hit.side = side
      hit.u = u >= 1 ? 0 : u
      hit.tex = fromDoor ? TEX.jamb : wall
      return true
    }
    fromDoor = false
  }
}

/** Whether nothing solid lies between two points, for monster sight and explosion reach. */
export function lineOfSight(
  grid: Grid,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  scratch: RayHit,
): boolean {
  const dx = bx - ax
  const dy = by - ay
  const dist = Math.hypot(dx, dy)
  if (dist < 1e-9) return true
  return !castRay(grid, ax, ay, dx / dist, dy / dist, scratch, dist)
}
