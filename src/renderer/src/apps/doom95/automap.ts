import { type Bitmap, rgb } from './art'
import { drawText } from './font'
import type { KeyColor } from './map'
import { SCREEN_W } from './render'
import type { World } from './world'

/** The Tab map. `x` and `y` are the cell it centers on when follow mode is off. */
export interface AutomapView {
  readonly open: boolean
  readonly follow: boolean
  readonly x: number
  readonly y: number
  /** Pixels per cell. */
  readonly zoom: number
}

const ZOOMS = [4, 6, 8, 12, 16, 24] as const

export const createAutomap = (): AutomapView => ({ open: false, follow: true, x: 0, y: 0, zoom: 8 })

export const followOff = (
  view: AutomapView,
  at: { readonly x: number; readonly y: number },
): AutomapView => ({
  ...view,
  follow: false,
  x: at.x,
  y: at.y,
})

export function zoomed(view: AutomapView, direction: 1 | -1): AutomapView {
  const index = ZOOMS.findIndex((zoom) => zoom >= view.zoom)
  const next = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (index < 0 ? 2 : index) + direction))] ?? 8
  return { ...view, zoom: next }
}

export type LineKind = 'wall' | 'door' | KeyColor

/** One segment in cell coordinates. */
export interface MapLine {
  readonly x0: number
  readonly y0: number
  readonly x1: number
  readonly y1: number
  readonly kind: LineKind
}

const SIDES = [
  [1, 0, 1, 0, 1, 1],
  [-1, 0, 0, 0, 0, 1],
  [0, 1, 0, 1, 1, 1],
  [0, -1, 0, 0, 1, 0],
] as const

/**
 * The lines the player has mapped. A wall face shows once the 3D view has drawn that wall, as Doom maps
 * a line when it renders it. A door shows once its slab or either jamb has been drawn.
 */
export function automapLines(world: World): MapLine[] {
  const { grid, seen } = world
  const { width, height, walls } = grid
  const open = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && (walls[y * width + x] ?? 1) === 0
  const lines: MapLine[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cell = y * width + x
      if (!seen[cell] || !walls[cell]) continue
      for (const [dx, dy, ax, ay, bx, by] of SIDES)
        if (open(x + dx, y + dy)) lines.push({ x0: x + ax, y0: y + ay, x1: x + bx, y1: y + by, kind: 'wall' })
    }
  }
  for (const door of grid.doors) {
    const along = door.axis === 'x'
    const jambA = along ? door.y * width + door.x - 1 : (door.y - 1) * width + door.x
    const jambB = along ? door.y * width + door.x + 1 : (door.y + 1) * width + door.x
    if (!seen[door.y * width + door.x] && !seen[jambA] && !seen[jambB]) continue
    const kind = door.key ?? 'door'
    if (along) lines.push({ x0: door.x, y0: door.y + 0.5, x1: door.x + 1, y1: door.y + 0.5, kind })
    else lines.push({ x0: door.x + 0.5, y0: door.y, x1: door.x + 0.5, y1: door.y + 1, kind })
  }
  return lines
}

const COLORS: Readonly<Record<LineKind | 'player' | 'text', number>> = {
  wall: rgb(208, 20, 20),
  door: rgb(188, 132, 72),
  red: rgb(255, 96, 96),
  blue: rgb(80, 120, 255),
  yellow: rgb(252, 236, 60),
  player: rgb(255, 255, 255),
  text: rgb(208, 20, 20),
}

/** Doom's player arrow, in units of the arrow's half length, pointing east. */
const ARROW = [
  [-0.875, 0, 1, 0],
  [1, 0, 0.5, 0.25],
  [1, 0, 0.5, -0.25],
  [-0.875, 0, -1.125, 0.25],
  [-0.875, 0, -1.125, -0.25],
  [-0.625, 0, -0.875, 0.25],
  [-0.625, 0, -0.875, -0.25],
] as const

function line(
  frame: Bitmap,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: number,
  maxY: number,
): void {
  let x = Math.round(x0)
  let y = Math.round(y0)
  const ex = Math.round(x1)
  const ey = Math.round(y1)
  const dx = Math.abs(ex - x)
  const dy = -Math.abs(ey - y)
  const sx = x < ex ? 1 : -1
  const sy = y < ey ? 1 : -1
  let err = dx + dy
  for (;;) {
    if (x >= 0 && x < frame.width && y >= 0 && y < maxY) frame.pixels[y * frame.width + x] = color
    if (x === ex && y === ey) return
    const e2 = 2 * err
    if (e2 >= dy) {
      err += dy
      x += sx
    }
    if (e2 <= dx) {
      err += dx
      y += sy
    }
  }
}

/** Draws the map over the top `viewH` rows: mapped walls, doors in their key colors, and the player. */
export function drawAutomap(frame: Bitmap, world: World, view: AutomapView, viewH: number): void {
  frame.pixels.fill(0xff000000, 0, viewH * SCREEN_W)
  const { player } = world
  const cx = view.follow ? player.x : view.x
  const cy = view.follow ? player.y : view.y
  const zoom = view.zoom
  const sx = (x: number) => SCREEN_W / 2 + (x - cx) * zoom
  const sy = (y: number) => viewH / 2 + (y - cy) * zoom
  for (const l of automapLines(world)) {
    const color = COLORS[l.kind]
    line(frame, sx(l.x0), sy(l.y0), sx(l.x1), sy(l.y1), color, viewH)
    if (l.kind !== 'wall' && l.kind !== 'door') {
      const vertical = l.x0 === l.x1
      line(
        frame,
        sx(l.x0) + (vertical ? 1 : 0),
        sy(l.y0) + (vertical ? 0 : 1),
        sx(l.x1) + (vertical ? 1 : 0),
        sy(l.y1) + (vertical ? 0 : 1),
        color,
        viewH,
      )
    }
  }
  const size = Math.max(6, zoom * 0.75)
  const cos = Math.cos(player.angle)
  const sin = Math.sin(player.angle)
  const px = sx(player.x)
  const py = sy(player.y)
  for (const [ax, ay, bx, by] of ARROW)
    line(
      frame,
      px + (ax * cos - ay * sin) * size,
      py + (ax * sin + ay * cos) * size,
      px + (bx * cos - by * sin) * size,
      py + (bx * sin + by * cos) * size,
      COLORS.player,
      viewH,
    )
  drawText(frame, world.level.name, 2, viewH - 9, { color: COLORS.text })
}
