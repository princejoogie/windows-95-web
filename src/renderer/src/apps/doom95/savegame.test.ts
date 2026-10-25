import { describe, expect, it } from 'vitest'
import { IDLE, step, TICK, type TickInput } from './game'
import { LEVELS } from './levels'
import { EMPTY_SLOTS, loadSlots, parseSave, restoreWorld, SAVES_KEY, snapshot, storeSlots } from './savegame'
import { command, createSession, menuKey, type Session, typeChar } from './session'
import { createWorld, PISTOL_START, type World } from './world'

const memory = () => {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  }
}

const play = (world: World, input: Partial<TickInput>, seconds: number) => {
  for (let t = 0; t < seconds; t += TICK) step(world, { ...IDLE, ...input }, TICK)
}

const fingerprint = (world: World) =>
  JSON.stringify({
    player: world.player,
    actors: world.actors,
    doors: world.grid.doors,
    items: world.items.map((item) => item.taken),
    stats: world.stats,
    rng: world.rng.state,
  })

const source = (world: World) => ({
  level: 0,
  skill: 2 as const,
  seed: 7,
  loadout: PISTOL_START,
  episode: { kills: 0, totalKills: 0, items: 0, totalItems: 0, secrets: 0, totalSecrets: 0, time: 0 },
  world,
})

const midGame = () => {
  const level = LEVELS[0]
  if (!level) throw new Error('no level')
  const world = createWorld(level, 2, 7)
  play(world, { forward: 1, turn: 0.3, fire: true }, 1.5)
  play(world, { use: true }, TICK)
  return world
}

describe('save games', () => {
  it('restores a level in progress so it plays on exactly as the original would', () => {
    const world = midGame()
    const save = JSON.parse(JSON.stringify(snapshot('Outpost', source(world))))
    const restored = restoreWorld(save)
    if (!restored) throw new Error('did not restore')
    expect(fingerprint(restored)).toBe(fingerprint(world))
    play(world, { forward: 1, turn: -0.5, fire: true }, 2)
    play(restored, { forward: 1, turn: -0.5, fire: true }, 2)
    expect(fingerprint(restored)).toBe(fingerprint(world))
  })

  it('keeps the automap knowledge and the exit switch state', () => {
    const world = midGame()
    world.seen[40] = 1
    world.grid.walls[world.level.width] = 7
    const restored = restoreWorld(snapshot('x', source(world)))
    expect(restored?.seen[40]).toBe(1)
    expect(restored?.grid.walls[world.level.width]).toBe(7)
  })

  it('rejects stored data that is not a save or no longer fits its map', () => {
    expect(parseSave(null)).toBeNull()
    expect(parseSave({ version: 1, name: 'x' })).toBeNull()
    const save = JSON.parse(JSON.stringify(snapshot('x', source(midGame()))))
    expect(parseSave(save)?.name).toBe('x')
    expect(parseSave({ ...save, level: 9 })).toBeNull()
    expect(parseSave({ ...save, world: { ...save.world, walls: [1, 2, 3] } })).toBeNull()
  })

  it('stores six slots and reads back only the valid ones', () => {
    const storage = memory()
    const save = snapshot('One', source(midGame()))
    expect(storeSlots([save, null, null, null, null, null], storage)).toBe(true)
    storage.data.set(SAVES_KEY, JSON.stringify([save, 'junk', null]))
    const slots = loadSlots(storage)
    expect(slots).toHaveLength(6)
    expect(slots[0]?.name).toBe('One')
    expect(slots.slice(1)).toEqual(EMPTY_SLOTS.slice(1))
  })
})

describe('save and load menus', () => {
  const playing = (): Session => {
    const s = createSession(5)
    command(s, 'any')
    command(s, 'confirm')
    command(s, 'confirm')
    return s
  }

  it('names a slot with F2, saves on Enter, and loads it back with F3', () => {
    const s = playing()
    const world = s.world
    if (!world) throw new Error('no world')
    world.player.x = 4.5
    menuKey(s, 'save')
    expect(s.menu?.page).toBe('save')
    command(s, 'down')
    command(s, 'confirm')
    expect(s.menu?.typing).toBe('')
    for (const ch of 'Before door') typeChar(s, ch)
    command(s, 'erase')
    expect(s.menu?.typing).toBe('BEFORE DOO')
    expect(command(s, 'confirm')).toContain('storeSlots')
    expect(s.menu).toBeNull()
    expect(s.slots[1]?.name).toBe('BEFORE DOO')
    expect(world.message?.text).toBe('Game saved.')

    world.player.x = 9.5
    menuKey(s, 'load')
    expect(s.menu).toMatchObject({ page: 'load', cursor: 1 })
    command(s, 'confirm')
    expect(s.menu).toBeNull()
    expect(s.world).not.toBe(world)
    expect(s.world?.player.x).toBe(4.5)
  })

  it('leaves an empty slot alone on load, and cancels naming on Esc', () => {
    const s = playing()
    menuKey(s, 'load')
    command(s, 'confirm')
    expect(s.menu?.page).toBe('load')
    command(s, 'back')
    menuKey(s, 'save')
    command(s, 'confirm')
    command(s, 'back')
    expect(s.menu).toMatchObject({ page: 'save', typing: null })
    expect(s.slots.every((slot) => slot === null)).toBe(true)
  })

  it('opens Load on the newest save in a new window', () => {
    const world = midGame()
    const older = snapshot('Older', source(world), 1000)
    const newer = snapshot('Newer', source(world), 2000)
    const s = createSession(6, undefined, [older, null, null, newer, null, null])
    menuKey(s, 'load')
    expect(s.menu?.cursor).toBe(3)
  })

  it("says you can't save from the title", () => {
    const s = createSession(5)
    menuKey(s, 'save')
    expect(s.menu?.page).toBe('notice')
    command(s, 'any')
    expect(s.menu).toBeNull()
  })

  it('loads a saved game from the title screen', () => {
    const s = playing()
    menuKey(s, 'save')
    command(s, 'confirm')
    command(s, 'confirm')
    const fresh = createSession(6, undefined, s.slots)
    menuKey(fresh, 'load')
    command(fresh, 'confirm')
    expect(fresh.screen.kind).toBe('playing')
    expect(fresh.slots[0]?.name).toBe('SAVE 1')
  })
})
