import { describe, expect, it } from 'vitest'
import { slideMove } from './collision'
import { traceAttack } from './combat'
import { DOOR_SPEED, DOOR_WAIT, doorBlocks, operateDoor, stepDoor } from './doors'
import { createGrid, isSolid } from './grid'
import { MapError, parseLevel, TEX } from './map'
import { castRay, createHit } from './raycast'
import { createWorld } from './world'

const level = (...rows: string[]) => parseLevel({ name: 'test', par: 30, rows })
const noKeys = { red: false, blue: false, yellow: false }

/** A 10x10 room: open from 1 to 9 on both axes. */
const ROOM = level(
  '##########',
  '#........#',
  '#........#',
  '#........#',
  '#...>....#',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '##########',
)

const ray = (grid: ReturnType<typeof createGrid>, ox: number, oy: number, angle: number) => {
  const hit = createHit()
  const found = castRay(grid, ox, oy, Math.cos(angle), Math.sin(angle), hit)
  return found ? hit : null
}

describe('map parsing', () => {
  it('reads walls, the start, things, doors, and secrets from ASCII', () => {
    const map = level('#######', '#>.t.S#', '###D###', '#.r.%.#', '#######')
    expect(map.width).toBe(7)
    expect(map.height).toBe(5)
    expect(map.start).toEqual({ x: 1.5, y: 1.5, angle: 0 })
    expect(map.walls[0]).toBe(TEX.tech)
    expect(map.walls[3 * 7 + 4]).toBe(TEX.brick)
    expect(map.walls[1 * 7 + 2]).toBe(0)
    expect(map.things).toEqual([
      { kind: 'trooper', x: 3.5, y: 1.5 },
      { kind: 'redKey', x: 2.5, y: 3.5 },
    ])
    expect(map.doors).toEqual([{ x: 3, y: 2, axis: 'x', key: null }])
    expect(map.secrets).toEqual([1 * 7 + 5])
  })

  it('orients a door by the walls beside it and reads its key color', () => {
    const map = level('#####', '#>#.#', '#.R.#', '#.#.#', '#####')
    expect(map.doors).toEqual([{ x: 2, y: 2, axis: 'y', key: 'red' }])
  })

  it('rejects a level a ray could escape, one without a start, and unknown cells', () => {
    expect(() => level('###', '#>.', '###')).toThrow(MapError)
    expect(() => level('###', '#.#', '###')).toThrow(/no player start/)
    expect(() => level('####', '#>?#', '####')).toThrow(/unknown cell/)
    expect(() => level('#####', '#>D.#', '#####')).not.toThrow()
    expect(() => level('#####', '#>..#', '#.D.#', '#...#', '#####')).toThrow(/door/)
  })
})

describe('raycasting', () => {
  const grid = createGrid(ROOM)

  it('measures exact distances to the walls of a known room', () => {
    expect(ray(grid, 4.5, 4.5, 0)?.t).toBeCloseTo(4.5)
    expect(ray(grid, 4.5, 4.5, Math.PI)?.t).toBeCloseTo(3.5)
    expect(ray(grid, 4.5, 4.5, Math.PI / 2)?.t).toBeCloseTo(4.5)
    expect(ray(grid, 4.5, 4.5, -Math.PI / 2)?.t).toBeCloseTo(3.5)
  })

  it('measures a diagonal ray to the corner it reaches', () => {
    const hit = ray(grid, 5, 5, Math.PI / 4)
    expect(hit?.t).toBeCloseTo(4 * Math.SQRT2)
  })

  it('reports which face it hit and where along it', () => {
    const east = ray(grid, 4.5, 4.25, 0)
    expect(east?.side).toBe(0)
    expect(east?.u).toBeCloseTo(0.25)
    expect(east?.tex).toBe(TEX.tech)
    const south = ray(grid, 2.75, 4.5, Math.PI / 2)
    expect(south?.side).toBe(1)
    expect(south?.u).toBeCloseTo(0.25)
  })

  it('stops at a closed door slab on its midline and passes an open one', () => {
    const map = level('#######', '#>.D..#', '#######')
    const doors = createGrid(map)
    const closed = ray(doors, 1.5, 1.5, 0)
    expect(closed?.t).toBeCloseTo(2)
    expect(closed?.tex).toBe(TEX.door)
    const door = doors.doors[0]
    if (!door) throw new Error('no door')
    door.open = 1
    const open = ray(doors, 1.5, 1.5, 0)
    expect(open?.t).toBeCloseTo(4.5)
  })

  it('lets a ray through the part of a door that has slid aside', () => {
    const map = level('#####', '#>..#', '##D##', '#...#', '#####')
    const doors = createGrid(map)
    const door = doors.doors[0]
    if (!door) throw new Error('no door')
    door.open = 0.5
    expect(ray(doors, 2.25, 1.5, Math.PI / 2)?.t).toBeCloseTo(2.5)
    expect(ray(doors, 2.75, 1.5, Math.PI / 2)?.t).toBeCloseTo(1)
  })
})

describe('collision', () => {
  const grid = createGrid(ROOM)

  it('slides along a wall instead of stopping dead', () => {
    const pos = { x: 8.5, y: 4.5 }
    slideMove(grid, pos, 0.25, 0.4, 0.3)
    expect(pos.x).toBeCloseTo(9 - 0.25)
    expect(pos.y).toBeCloseTo(4.8)
  })

  it('stops flush in a corner', () => {
    const pos = { x: 8.5, y: 8.5 }
    slideMove(grid, pos, 0.25, 0.5, 0.5)
    expect(pos).toEqual({ x: 8.75, y: 8.75 })
  })

  it('moves freely in open space', () => {
    const pos = { x: 4.5, y: 4.5 }
    slideMove(grid, pos, 0.25, 0.3, -0.2)
    expect(pos.x).toBeCloseTo(4.8)
    expect(pos.y).toBeCloseTo(4.3)
  })

  it('cancels only the axis a thing blocks', () => {
    const pos = { x: 4.5, y: 4.5 }
    slideMove(grid, pos, 0.25, 0.3, 0.3, (x) => x > 4.6)
    expect(pos.x).toBe(4.5)
    expect(pos.y).toBeCloseTo(4.8)
  })
})

describe('doors', () => {
  const map = level('#######', '#>.D..#', '#######')
  const fresh = () => {
    const grid = createGrid(map)
    const door = grid.doors[0]
    if (!door) throw new Error('no door')
    return { grid, door }
  }
  const run = (door: ReturnType<typeof fresh>['door'], seconds: number, occupied = false) => {
    for (let t = 0; t < seconds; t += 1 / 60) stepDoor(door, 1 / 60, occupied)
  }

  it('blocks until fully open, then lets things through', () => {
    const { grid, door } = fresh()
    expect(isSolid(grid, 3, 1)).toBe(true)
    expect(operateDoor(door, noKeys)).toBe('opening')
    run(door, 0.25)
    expect(door.open).toBeGreaterThan(0.3)
    expect(isSolid(grid, 3, 1)).toBe(true)
    run(door, 1 / DOOR_SPEED)
    expect(door.phase).toBe('open')
    expect(isSolid(grid, 3, 1)).toBe(false)
  })

  it('closes by itself after waiting, and reopens rather than closing on someone', () => {
    const { door } = fresh()
    operateDoor(door, noKeys)
    run(door, 1 / DOOR_SPEED + 0.05)
    run(door, DOOR_WAIT + 0.1, true)
    expect(door.phase).toBe('open')
    run(door, 0.1)
    expect(door.phase).toBe('closing')
    expect(stepDoor(door, 1 / 60, true)).toBe('doorOpen')
    expect(door.phase).toBe('opening')
    run(door, 1 / DOOR_SPEED + DOOR_WAIT + 1 / DOOR_SPEED + 0.5)
    expect(door.phase).toBe('closed')
    expect(doorBlocks(door)).toBe(true)
  })

  it('refuses without its key and opens with it', () => {
    const grid = createGrid(level('#######', '#>.R..#', '#######'))
    const door = grid.doors[0]
    if (!door) throw new Error('no door')
    expect(operateDoor(door, noKeys)).toBe('locked')
    expect(operateDoor(door, { ...noKeys, blue: true })).toBe('locked')
    expect(door.phase).toBe('closed')
    expect(operateDoor(door, { ...noKeys, red: true })).toBe('opening')
  })
})

describe('hitscan', () => {
  const arena = level(
    '############',
    '#..........#',
    '#>...t..t..#',
    '#..........#',
    '#.....#....#',
    '#....t#t...#',
    '############',
  )

  it('hits the nearest monster on the line', () => {
    const world = createWorld(arena, 2, 1)
    const result = traceAttack(world, 1.5, 2.5, 0, 32, 'player')
    expect(result.kind).toBe('actor')
    if (result.kind === 'actor') {
      expect(result.actor.x).toBe(5.5)
      expect(result.t).toBeCloseTo(4 - 0.3)
    }
  })

  it('misses a monster off to the side and hits the wall behind', () => {
    const world = createWorld(arena, 2, 1)
    const result = traceAttack(world, 1.5, 3.5, 0, 32, 'player')
    expect(result.kind).toBe('wall')
    if (result.kind === 'wall') expect(result.t).toBeCloseTo(9.5)
  })

  it('does not hit a monster behind a wall', () => {
    const world = createWorld(arena, 2, 1)
    const result = traceAttack(world, 5.5, 5.5, 0, 32, 'player')
    expect(result.kind).toBe('wall')
  })

  it('stops at its range, which is how a punch misses a far monster', () => {
    const world = createWorld(arena, 2, 1)
    expect(traceAttack(world, 1.5, 2.5, 0, 1.1, 'player').kind).toBe('none')
  })

  it('lets a monster hit the player', () => {
    const world = createWorld(arena, 2, 1)
    const trooper = world.actors[0]
    if (!trooper) throw new Error('no trooper')
    expect(traceAttack(world, trooper.x, trooper.y, Math.PI, 32, trooper).kind).toBe('player')
  })
})
