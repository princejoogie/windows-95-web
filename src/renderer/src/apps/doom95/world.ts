import { type AmmoKind, MONSTER_DEFS, type Skill, type SoundId, type WeaponId } from './defs'
import { createGrid, type Grid } from './grid'
import type { ItemKind, KeyColor, Level, MonsterKind } from './map'
import { createHit, type RayHit } from './raycast'
import { createRng, type Rng } from './rng'

export const PLAYER_RADIUS = 0.25

export interface Player {
  x: number
  y: number
  angle: number
  vx: number
  vy: number
  hp: number
  armor: number
  ammo: Record<AmmoKind, number>
  owned: Record<WeaponId, boolean>
  weapon: WeaponId
  /** The weapon being raised once the current one is lowered. */
  pending: WeaponId | null
  /** Seconds left in a lower-then-raise weapon switch. */
  switchTime: number
  cooldown: number
  /** Seconds of muzzle flash left. */
  flash: number
  /** Whether the trigger was already held last tick. */
  refire: boolean
  keys: Record<KeyColor, boolean>
  bobPhase: number
  /** 0 when standing, 1 at full run. */
  bob: number
  /** Red screen tint that fades, raised by damage. */
  damageTint: number
  /** Gold screen tint that fades, raised by pickups. */
  bonusTint: number
  dead: boolean
  deadTime: number
}

/** What a player carries from one level to the next. Keys stay behind. */
export interface Loadout {
  readonly hp: number
  readonly armor: number
  readonly ammo: Readonly<Record<AmmoKind, number>>
  readonly owned: Readonly<Record<WeaponId, boolean>>
  readonly weapon: WeaponId
}

export const PISTOL_START: Loadout = {
  hp: 100,
  armor: 0,
  ammo: { bullets: 50, shells: 0 },
  owned: { fist: true, pistol: true, shotgun: false },
  weapon: 'pistol',
}

export const loadoutOf = (player: Player): Loadout => ({
  hp: player.hp,
  armor: player.armor,
  ammo: { ...player.ammo },
  owned: { ...player.owned },
  weapon: player.weapon,
})

export type ActorState = 'idle' | 'chase' | 'attack' | 'pain' | 'dying' | 'dead'

export interface Actor {
  readonly id: number
  readonly kind: MonsterKind
  x: number
  y: number
  angle: number
  hp: number
  state: ActorState
  /** Seconds since entering `state`. */
  time: number
  attack: 'melee' | 'ranged'
  /** Whether this attack pose has already fired. */
  fired: boolean
  /** Seconds before the next attack may start. */
  cooldown: number
  dirX: number
  dirY: number
  /** Seconds before picking a new chase direction. */
  moveTime: number
  /** A barrel's blast has gone off. */
  blasted: boolean
}

export interface Item {
  readonly kind: ItemKind
  readonly x: number
  readonly y: number
  taken: boolean
}

export interface Projectile {
  x: number
  y: number
  vx: number
  vy: number
  readonly owner: number
  readonly damage: number
  alive: boolean
}

export type EffectKind = 'puff' | 'blood' | 'blast'

export interface Effect {
  readonly kind: EffectKind
  readonly x: number
  readonly y: number
  time: number
}

export const EFFECT_TIME: Readonly<Record<EffectKind, number>> = { puff: 0.3, blood: 0.35, blast: 0.45 }

export interface Stats {
  kills: number
  readonly totalKills: number
  items: number
  readonly totalItems: number
  secrets: number
  readonly totalSecrets: number
  /** Seconds played on this level. */
  time: number
}

export type Outcome = 'playing' | 'exited' | 'dead'

export interface SoundEvent {
  readonly sound: SoundId
  readonly x: number
  readonly y: number
}

/** The status bar face. It glances around, winces when hit, and grins at new weapons. */
export interface Face {
  look: -1 | 0 | 1
  lookTime: number
  ouch: number
  grin: number
}

export interface World {
  readonly level: Level
  readonly grid: Grid
  readonly skill: Skill
  readonly rng: Rng
  readonly player: Player
  readonly actors: Actor[]
  readonly items: Item[]
  readonly projectiles: Projectile[]
  readonly effects: Effect[]
  /** One flag per entry in `level.secrets`. */
  readonly secretFound: Uint8Array
  /** One flag per cell the 3D view has drawn, which is what the automap shows. */
  readonly seen: Uint8Array
  readonly stats: Stats
  readonly face: Face
  time: number
  /** When the exit switch was thrown, the level ends a beat later. */
  exitAt: number | null
  outcome: Outcome
  message: { text: string; time: number } | null
  /** Sounds since the last drain. The component plays them and clears the list. */
  readonly events: SoundEvent[]
  /** Scratch ray for sight and use checks. */
  readonly ray: RayHit
}

const FACINGS = [0, Math.PI / 2, Math.PI, -Math.PI / 2]

export function createWorld(
  level: Level,
  skill: Skill,
  seed: number,
  loadout: Loadout = PISTOL_START,
): World {
  const rng = createRng(seed)
  const actors: Actor[] = []
  const items: Item[] = []
  for (const thing of level.things) {
    if (thing.kind in MONSTER_DEFS) {
      const kind = thing.kind as MonsterKind
      actors.push({
        id: actors.length + 1,
        kind,
        x: thing.x,
        y: thing.y,
        angle: FACINGS[Math.floor(rng() * 4)] ?? 0,
        hp: MONSTER_DEFS[kind].hp,
        state: 'idle',
        time: 0,
        attack: 'ranged',
        fired: false,
        cooldown: 0,
        dirX: 0,
        dirY: 0,
        moveTime: 0,
        blasted: false,
      })
    } else {
      items.push({ kind: thing.kind as ItemKind, x: thing.x, y: thing.y, taken: false })
    }
  }
  return {
    level,
    grid: createGrid(level),
    skill,
    rng,
    player: {
      x: level.start.x,
      y: level.start.y,
      angle: level.start.angle,
      vx: 0,
      vy: 0,
      hp: loadout.hp,
      armor: loadout.armor,
      ammo: { ...loadout.ammo },
      owned: { ...loadout.owned },
      weapon: loadout.weapon,
      pending: null,
      switchTime: 0,
      cooldown: 0,
      flash: 0,
      refire: false,
      keys: { red: false, blue: false, yellow: false },
      bobPhase: 0,
      bob: 0,
      damageTint: 0,
      bonusTint: 0,
      dead: false,
      deadTime: 0,
    },
    actors,
    items,
    projectiles: [],
    effects: [],
    secretFound: new Uint8Array(level.secrets.length),
    seen: new Uint8Array(level.width * level.height),
    stats: {
      kills: 0,
      totalKills: actors.filter((actor) => MONSTER_DEFS[actor.kind].countsKill).length,
      items: 0,
      totalItems: items.length,
      secrets: 0,
      totalSecrets: level.secrets.length,
      time: 0,
    },
    face: { look: 0, lookTime: 1, ouch: 0, grin: 0 },
    time: 0,
    exitAt: null,
    outcome: 'playing',
    message: null,
    events: [],
    ray: createHit(),
  }
}

export const emit = (world: World, sound: SoundId, x: number, y: number): void => {
  world.events.push({ sound, x, y })
}

export const say = (world: World, text: string): void => {
  world.message = { text, time: world.time }
}

/** Actors that can be shot and that block movement. Corpses and blasts are neither. */
export const isSolidActor = (actor: Actor): boolean => actor.state !== 'dying' && actor.state !== 'dead'
