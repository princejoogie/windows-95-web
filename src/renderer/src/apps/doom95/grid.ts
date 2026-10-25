import { createDoor, type Door, doorBlocks } from './doors'
import type { Level } from './map'

/** The live cell grid: static walls plus doors that move. */
export interface Grid {
  readonly width: number
  readonly height: number
  readonly walls: Uint8Array
  /** Door index per cell, or -1. */
  readonly doorAt: Int16Array
  readonly doors: readonly Door[]
}

export function createGrid(level: Level): Grid {
  const doorAt = new Int16Array(level.width * level.height).fill(-1)
  level.doors.forEach((door, index) => {
    doorAt[door.y * level.width + door.x] = index
  })
  return {
    width: level.width,
    height: level.height,
    walls: level.walls.slice(),
    doorAt,
    doors: level.doors.map(createDoor),
  }
}

export function doorAtCell(grid: Grid, cx: number, cy: number): Door | null {
  if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) return null
  return grid.doors[grid.doorAt[cy * grid.width + cx] ?? -1] ?? null
}

/** Whether a cell stops movement. Outside the grid counts as solid. */
export function isSolid(grid: Grid, cx: number, cy: number): boolean {
  if (cx < 0 || cy < 0 || cx >= grid.width || cy >= grid.height) return true
  const cell = cy * grid.width + cx
  if ((grid.walls[cell] ?? 1) > 0) return true
  const door = grid.doors[grid.doorAt[cell] ?? -1]
  return door ? doorBlocks(door) : false
}
