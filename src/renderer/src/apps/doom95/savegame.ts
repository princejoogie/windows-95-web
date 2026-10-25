import type { Skill } from './defs'
import type { DoorPhase } from './doors'
import { LEVELS } from './levels'
import {
  type Actor,
  createWorld,
  type Effect,
  type Face,
  type Loadout,
  type Outcome,
  type Player,
  type Projectile,
  type Stats,
  type World,
} from './world'

export const SAVE_SLOTS = 6
export const SAVE_NAME_LENGTH = 16
export const SAVES_KEY = 'w95.doom95.saves.v1'

/** Everything about a level in progress that differs from a fresh `createWorld` of the same map. */
interface WorldSnapshot {
  readonly rng: number
  readonly walls: readonly number[]
  readonly doors: readonly { readonly phase: DoorPhase; readonly open: number; readonly wait: number }[]
  readonly player: Player
  readonly actors: readonly Actor[]
  /** One flag per item, in spawn order. */
  readonly taken: readonly boolean[]
  readonly projectiles: readonly Projectile[]
  readonly effects: readonly Effect[]
  readonly secretFound: readonly number[]
  readonly seen: readonly number[]
  readonly stats: Stats
  readonly face: Face
  readonly time: number
  readonly exitAt: number | null
  readonly outcome: Outcome
  readonly message: { readonly text: string; readonly time: number } | null
}

export interface SaveGame {
  readonly version: 1
  readonly name: string
  /** Milliseconds since the epoch, so Load can open on the newest save. */
  readonly savedAt: number
  readonly level: number
  readonly skill: Skill
  readonly seed: number
  /** What the player carried into this level, for a restart after death. */
  readonly loadout: Loadout
  /** The finished levels' tallies, for the end of the episode. */
  readonly episode: Stats
  readonly world: WorldSnapshot
}

export type SaveSlots = readonly (SaveGame | null)[]

export const EMPTY_SLOTS: SaveSlots = Array.from({ length: SAVE_SLOTS }, () => null)

/** A deep, JSON-safe copy, so a save never aliases live game state. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export interface SaveSource {
  readonly level: number
  readonly skill: Skill
  readonly seed: number
  readonly loadout: Loadout
  readonly episode: Stats
  readonly world: World
}

export function snapshot(name: string, source: SaveSource, savedAt = Date.now()): SaveGame {
  const { world } = source
  return {
    version: 1,
    name,
    savedAt,
    level: source.level,
    skill: source.skill,
    seed: source.seed,
    loadout: copy(source.loadout),
    episode: copy(source.episode),
    world: copy({
      rng: world.rng.state,
      walls: Array.from(world.grid.walls),
      doors: world.grid.doors.map(({ phase, open, wait }) => ({ phase, open, wait })),
      player: world.player,
      actors: world.actors,
      taken: world.items.map((item) => item.taken),
      projectiles: world.projectiles,
      effects: world.effects,
      secretFound: Array.from(world.secretFound),
      seen: Array.from(world.seen),
      stats: world.stats,
      face: world.face,
      time: world.time,
      exitAt: world.exitAt,
      outcome: world.outcome,
      message: world.message,
    }),
  }
}

/** Rebuilds the level a save describes, or returns null when the save no longer fits its map. */
export function restoreWorld(save: SaveGame): World | null {
  const level = LEVELS[save.level]
  if (!level) return null
  const world = createWorld(level, save.skill, 0, save.loadout)
  const s = copy(save.world)
  const { grid } = world
  if (
    s.walls.length !== grid.walls.length ||
    s.doors.length !== grid.doors.length ||
    s.taken.length !== world.items.length ||
    s.secretFound.length !== world.secretFound.length ||
    s.seen.length !== world.seen.length
  )
    return null
  world.rng.state = s.rng >>> 0
  grid.walls.set(s.walls)
  s.doors.forEach((door, i) => {
    Object.assign(grid.doors[i] ?? {}, door)
  })
  Object.assign(world.player, s.player)
  world.actors.splice(0, world.actors.length, ...s.actors)
  s.taken.forEach((taken, i) => {
    const item = world.items[i]
    if (item) item.taken = taken
  })
  world.projectiles.push(...s.projectiles)
  world.effects.push(...s.effects)
  world.secretFound.set(s.secretFound)
  world.seen.set(s.seen)
  Object.assign(world.stats, s.stats)
  Object.assign(world.face, s.face)
  world.time = s.time
  world.exitAt = s.exitAt
  world.outcome = s.outcome
  world.message = s.message
  return world
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Accepts stored data only when it restores into a playable level. */
export function parseSave(value: unknown): SaveGame | null {
  if (!isRecord(value) || value.version !== 1 || typeof value.name !== 'string') return null
  const { level, skill, world } = value
  if (!Number.isInteger(level) || !Number.isInteger(skill) || (skill as number) < 0 || (skill as number) > 4)
    return null
  if (!isRecord(world) || !isRecord(world.player) || !isRecord(value.loadout) || !isRecord(value.episode))
    return null
  const lists = ['walls', 'doors', 'actors', 'taken', 'projectiles', 'effects', 'secretFound', 'seen']
  if (!lists.every((key) => Array.isArray(world[key]))) return null
  try {
    const restored = restoreWorld(value as unknown as SaveGame)
    if (!restored || !Number.isFinite(restored.player.x) || !Number.isFinite(restored.player.y)) return null
  } catch {
    return null
  }
  const savedAt = typeof value.savedAt === 'number' ? value.savedAt : 0
  return { ...(value as unknown as SaveGame), name: value.name.slice(0, SAVE_NAME_LENGTH), savedAt }
}

/** The slot holding the newest save, or the first slot when all are empty. */
export function latestSlot(slots: SaveSlots): number {
  let best = 0
  slots.forEach((save, i) => {
    if (save && save.savedAt > (slots[best]?.savedAt ?? -1)) best = i
  })
  return best
}

export function loadSlots(storage: Pick<Storage, 'getItem'> = localStorage): SaveSlots {
  let raw: unknown = null
  try {
    raw = JSON.parse(storage.getItem(SAVES_KEY) ?? 'null')
  } catch {}
  const list = Array.isArray(raw) ? raw : []
  return EMPTY_SLOTS.map((_, i) => parseSave(list[i]))
}

/** Returns false when storage refused the write, such as a full quota. */
export function storeSlots(slots: SaveSlots, storage: Pick<Storage, 'setItem'> = localStorage): boolean {
  try {
    storage.setItem(SAVES_KEY, JSON.stringify(slots))
    return true
  } catch {
    return false
  }
}
