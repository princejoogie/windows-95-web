import { describe, expect, it } from 'vitest'
import { KEY_ITEMS } from './defs'
import { LEVELS } from './levels'
import { type KeyColor, type Level, TEX } from './map'

/**
 * Floods the level from the start, opening a locked door only once its key has been reached, until
 * nothing new opens up. Returns every reachable cell.
 */
function reachable(level: Level): Set<number> {
  const keys = new Set<KeyColor>()
  const doorKey = new Map(level.doors.map((door) => [door.y * level.width + door.x, door.key]))
  const keyAt = new Map<number, KeyColor>()
  for (const thing of level.things) {
    const key = KEY_ITEMS[thing.kind as keyof typeof KEY_ITEMS]
    if (key) keyAt.set(Math.floor(thing.y) * level.width + Math.floor(thing.x), key)
  }
  let seen = new Set<number>()
  for (;;) {
    const start = Math.floor(level.start.y) * level.width + Math.floor(level.start.x)
    const next = new Set([start])
    const queue = [start]
    for (let cell = queue.shift(); cell !== undefined; cell = queue.shift()) {
      const key = keyAt.get(cell)
      if (key) keys.add(key)
      for (const n of [cell + 1, cell - 1, cell + level.width, cell - level.width]) {
        if (next.has(n) || (level.walls[n] ?? 1) > 0) continue
        const needs = doorKey.get(n)
        if (needs && !keys.has(needs)) continue
        next.add(n)
        queue.push(n)
      }
    }
    if (next.size === seen.size) return next
    seen = next
  }
}

describe('levels', () => {
  it('ships three levels', () => {
    expect(LEVELS).toHaveLength(3)
  })

  for (const level of LEVELS) {
    describe(level.name, () => {
      const cells = reachable(level)
      const cellOf = (x: number, y: number) => Math.floor(y) * level.width + Math.floor(x)

      it('can be finished: the exit switch has a reachable face', () => {
        const exits = [...level.walls.keys()].filter((cell) => level.walls[cell] === TEX.exit)
        expect(exits.length).toBeGreaterThan(0)
        const reachableExit = exits.some((cell) =>
          [cell + 1, cell - 1, cell + level.width, cell - level.width].some((n) => cells.has(n)),
        )
        expect(reachableExit).toBe(true)
      })

      it('puts every monster, item, and secret where the player can get to it', () => {
        for (const thing of level.things) expect(cells.has(cellOf(thing.x, thing.y)), thing.kind).toBe(true)
        for (const secret of level.secrets) expect(cells.has(secret)).toBe(true)
      })

      it('has a locked door, monsters of both kinds, and a secret', () => {
        expect(level.doors.some((door) => door.key !== null)).toBe(true)
        expect(level.things.some((thing) => thing.kind === 'trooper')).toBe(true)
        expect(level.things.some((thing) => thing.kind === 'demon')).toBe(true)
        expect(level.secrets.length).toBeGreaterThan(0)
      })
    })
  }
})
