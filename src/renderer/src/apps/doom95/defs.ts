import type { ItemKind, KeyColor, MonsterKind } from './map'
import { type Rng, roll } from './rng'

export type SoundId =
  | 'punch'
  | 'pistol'
  | 'shotgun'
  | 'doorOpen'
  | 'doorClose'
  | 'locked'
  | 'item'
  | 'weaponUp'
  | 'switch'
  | 'trooperSight'
  | 'demonSight'
  | 'trooperPain'
  | 'demonPain'
  | 'trooperDeath'
  | 'demonDeath'
  | 'claw'
  | 'fireball'
  | 'fireballHit'
  | 'explode'
  | 'playerPain'
  | 'playerDeath'
  | 'secret'

export type WeaponId = 'fist' | 'pistol' | 'shotgun'
export type AmmoKind = 'bullets' | 'shells'

export const WEAPONS: readonly WeaponId[] = ['fist', 'pistol', 'shotgun']

export interface WeaponDef {
  readonly slot: 1 | 2 | 3
  readonly ammo: AmmoKind | null
  /** Seconds between shots. */
  readonly cooldown: number
  readonly pellets: number
  /** Widest pellet deviation in radians. */
  readonly spread: number
  /** Pistol shots fly true until the trigger is held. */
  readonly firstShotAccurate: boolean
  readonly range: number
  readonly damage: (rng: Rng) => number
  readonly sound: SoundId
  /** Seconds the muzzle flash lights the room. */
  readonly flash: number
}

/** Ranges are in cells. A cell is 64 Doom units, which sets the melee and hitscan reach. */
export const WEAPON_DEFS: Readonly<Record<WeaponId, WeaponDef>> = {
  fist: {
    slot: 1,
    ammo: null,
    cooldown: 0.45,
    pellets: 1,
    spread: 0,
    firstShotAccurate: true,
    range: 1.1,
    damage: (rng) => 2 * roll(rng, 1, 10),
    sound: 'punch',
    flash: 0,
  },
  pistol: {
    slot: 2,
    ammo: 'bullets',
    cooldown: 0.4,
    pellets: 1,
    spread: 0.098,
    firstShotAccurate: true,
    range: 32,
    damage: (rng) => 5 * roll(rng, 1, 3),
    sound: 'pistol',
    flash: 0.1,
  },
  shotgun: {
    slot: 3,
    ammo: 'shells',
    cooldown: 1.05,
    pellets: 7,
    spread: 0.098,
    firstShotAccurate: false,
    range: 32,
    damage: (rng) => 5 * roll(rng, 1, 3),
    sound: 'shotgun',
    flash: 0.12,
  },
}

export const MAX_AMMO: Readonly<Record<AmmoKind, number>> = { bullets: 200, shells: 50 }

export type Attack =
  | { readonly kind: 'none' }
  | { readonly kind: 'hitscan'; readonly damage: (rng: Rng) => number; readonly sound: SoundId }
  | { readonly kind: 'fireball'; readonly damage: (rng: Rng) => number; readonly speed: number }

export interface MonsterDef {
  readonly hp: number
  readonly radius: number
  /** Cells per second. */
  readonly speed: number
  /** Chance out of 1 that a hit staggers it. */
  readonly painChance: number
  readonly painTime: number
  /** Seconds from the attack pose to the shot, and from the shot back to the chase. */
  readonly windup: number
  readonly recover: number
  readonly ranged: Attack
  readonly melee: ((rng: Rng) => number) | null
  readonly sight: SoundId | null
  readonly pain: SoundId | null
  readonly death: SoundId | null
  readonly deathTime: number
  readonly countsKill: boolean
  readonly explodes: boolean
}

export const MONSTER_DEFS: Readonly<Record<MonsterKind, MonsterDef>> = {
  trooper: {
    hp: 20,
    radius: 0.3,
    speed: 2.2,
    painChance: 200 / 256,
    painTime: 0.25,
    windup: 0.35,
    recover: 0.3,
    ranged: { kind: 'hitscan', damage: (rng) => 3 * roll(rng, 1, 5), sound: 'pistol' },
    melee: null,
    sight: 'trooperSight',
    pain: 'trooperPain',
    death: 'trooperDeath',
    deathTime: 0.6,
    countsKill: true,
    explodes: false,
  },
  demon: {
    hp: 60,
    radius: 0.32,
    speed: 2.4,
    painChance: 200 / 256,
    painTime: 0.3,
    windup: 0.45,
    recover: 0.35,
    ranged: { kind: 'fireball', damage: (rng) => 3 * roll(rng, 1, 8), speed: 5.5 },
    melee: (rng) => 3 * roll(rng, 1, 8),
    sight: 'demonSight',
    pain: 'demonPain',
    death: 'demonDeath',
    deathTime: 0.7,
    countsKill: true,
    explodes: false,
  },
  barrel: {
    hp: 20,
    radius: 0.25,
    speed: 0,
    painChance: 0,
    painTime: 0,
    windup: 0,
    recover: 0,
    ranged: { kind: 'none' },
    melee: null,
    sight: null,
    pain: null,
    death: 'explode',
    deathTime: 0.5,
    countsKill: false,
    explodes: true,
  },
}

/** Seconds into a barrel's death when the blast goes off, so chains ripple instead of firing at once. */
export const BARREL_BLAST_AT = 0.15
/** Blast damage falls off over two cells, like Doom's 128 units. */
export const BLAST_RADIUS = 2
export const BLAST_DAMAGE = 128

export const MELEE_RANGE = 1

export interface ItemDef {
  readonly radius: number
  readonly message: string
  readonly sound: SoundId
}

export const ITEM_DEFS: Readonly<Record<ItemKind, ItemDef>> = {
  health: { radius: 0.4, message: 'Picked up a medkit.', sound: 'item' },
  armor: { radius: 0.4, message: 'Picked up the armor.', sound: 'item' },
  clip: { radius: 0.4, message: 'Picked up a clip.', sound: 'item' },
  shells: { radius: 0.4, message: 'Picked up 4 shells.', sound: 'item' },
  shotgun: { radius: 0.4, message: 'You got the shotgun!', sound: 'weaponUp' },
  redKey: { radius: 0.4, message: 'Picked up a red keycard.', sound: 'weaponUp' },
  blueKey: { radius: 0.4, message: 'Picked up a blue keycard.', sound: 'weaponUp' },
  yellowKey: { radius: 0.4, message: 'Picked up a yellow keycard.', sound: 'weaponUp' },
}

export const KEY_ITEMS: Readonly<Partial<Record<ItemKind, KeyColor>>> = {
  redKey: 'red',
  blueKey: 'blue',
  yellowKey: 'yellow',
}

export type Skill = 0 | 1 | 2 | 3 | 4

export interface SkillDef {
  readonly name: string
  /** Multiplies damage the player takes. */
  readonly damageTaken: number
  /** Multiplies ammo from pickups. */
  readonly ammoGiven: number
  /** Multiplies the pause between monster attacks. */
  readonly aggression: number
}

export const SKILLS: readonly SkillDef[] = [
  { name: 'Training Wheels', damageTaken: 0.5, ammoGiven: 2, aggression: 1.4 },
  { name: 'Shore Leave', damageTaken: 1, ammoGiven: 1, aggression: 1.2 },
  { name: 'Standard Issue', damageTaken: 1, ammoGiven: 1, aggression: 1 },
  { name: 'Hard Contact', damageTaken: 1, ammoGiven: 1, aggression: 0.75 },
  { name: 'No Mercy', damageTaken: 1.5, ammoGiven: 2, aggression: 0.45 },
]

export const DEFAULT_SKILL: Skill = 2
