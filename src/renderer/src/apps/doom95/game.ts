import { moveProjectiles, noiseAlert, thinkActor } from './ai'
import { slideMove } from './collision'
import { ageEffects, applyHit, traceAttack } from './combat'
import {
  ITEM_DEFS,
  KEY_ITEMS,
  MAX_AMMO,
  MONSTER_DEFS,
  SKILLS,
  WEAPON_DEFS,
  WEAPONS,
  type WeaponId,
} from './defs'
import { operateDoor, stepDoor } from './doors'
import { doorAtCell } from './grid'
import { type ItemKind, TEX } from './map'
import { castRay } from './raycast'
import { spread } from './rng'
import { emit, type Item, isSolidActor, PLAYER_RADIUS, type Player, say, type World } from './world'

/** One fixed simulation step's worth of controls. */
export interface TickInput {
  /** -1 back to 1 forward. */
  readonly forward: number
  /** -1 left to 1 right. */
  readonly strafe: number
  /** Keyboard turning, -1 left to 1 right. */
  readonly turn: number
  /** Mouse turning in radians, positive to the right. */
  readonly mouseTurn: number
  readonly run: boolean
  readonly fire: boolean
  /** Use was pressed since the last tick. */
  readonly use: boolean
  readonly weapon: WeaponId | null
}

export const IDLE: TickInput = {
  forward: 0,
  strafe: 0,
  turn: 0,
  mouseTurn: 0,
  run: false,
  fire: false,
  use: false,
  weapon: null,
}

export const TICK = 1 / 60
export const WALK_SPEED = 3.6
export const RUN_SPEED = 6.6
const TURN_SPEED = 2.6
const RUN_TURN_SPEED = 4.2
const USE_RANGE = 1.25
const SWITCH_TIME = 0.36
const EXIT_DELAY = 0.6
const MESSAGE_TIME = 3

function movePlayer(world: World, input: TickInput, dt: number): void {
  const { player } = world
  const turned = player.angle + input.turn * (input.run ? RUN_TURN_SPEED : TURN_SPEED) * dt + input.mouseTurn
  player.angle = Math.atan2(Math.sin(turned), Math.cos(turned))
  const cos = Math.cos(player.angle)
  const sin = Math.sin(player.angle)
  let mx = input.forward * cos - input.strafe * sin
  let my = input.forward * sin + input.strafe * cos
  const len = Math.hypot(mx, my)
  if (len > 1) {
    mx /= len
    my /= len
  }
  const speed = input.run ? RUN_SPEED : WALK_SPEED
  const ease = 1 - Math.exp(-dt * 12)
  player.vx += (mx * speed - player.vx) * ease
  player.vy += (my * speed - player.vy) * ease
  const x = player.x
  const y = player.y
  slideMove(world.grid, player, PLAYER_RADIUS, player.vx * dt, player.vy * dt, (px, py) =>
    world.actors.some(
      (actor) =>
        isSolidActor(actor) &&
        Math.hypot(actor.x - px, actor.y - py) < MONSTER_DEFS[actor.kind].radius + PLAYER_RADIUS,
    ),
  )
  player.vx = (player.x - x) / dt
  player.vy = (player.y - y) / dt
  const moving = Math.min(1, Math.hypot(player.vx, player.vy) / RUN_SPEED)
  player.bob += (moving - player.bob) * ease
  player.bobPhase += dt * (6 + 6 * player.bob)
}

const hasAmmo = (player: Player, weapon: WeaponId): boolean => {
  const ammo = WEAPON_DEFS[weapon].ammo
  return ammo === null || player.ammo[ammo] > 0
}

function bestWeapon(player: Player): WeaponId {
  for (let i = WEAPONS.length - 1; i >= 0; i--) {
    const weapon = WEAPONS[i]
    if (weapon && player.owned[weapon] && hasAmmo(player, weapon)) return weapon
  }
  return 'fist'
}

function switchTo(player: Player, weapon: WeaponId): void {
  if (weapon === (player.pending ?? player.weapon)) return
  player.pending = weapon
  player.switchTime = SWITCH_TIME
}

function stepWeapon(world: World, input: TickInput, dt: number): void {
  const { player } = world
  player.cooldown = Math.max(0, player.cooldown - dt)
  player.flash = Math.max(0, player.flash - dt)
  if (input.weapon && player.owned[input.weapon]) switchTo(player, input.weapon)
  if (player.switchTime > 0) {
    player.switchTime = Math.max(0, player.switchTime - dt)
    if (player.pending && player.switchTime <= SWITCH_TIME / 2) {
      player.weapon = player.pending
      player.pending = null
    }
    return
  }
  if (!input.fire) {
    player.refire = false
    return
  }
  if (player.cooldown > 0) return
  const def = WEAPON_DEFS[player.weapon]
  if (!hasAmmo(player, player.weapon)) {
    switchTo(player, bestWeapon(player))
    return
  }
  if (def.ammo) player.ammo[def.ammo]--
  for (let i = 0; i < def.pellets; i++) {
    const wobble = def.firstShotAccurate && !player.refire ? 0 : spread(world.rng) * def.spread
    const result = traceAttack(world, player.x, player.y, player.angle + wobble, def.range, 'player')
    applyHit(world, result, def.damage(world.rng))
  }
  emit(world, def.sound, player.x, player.y)
  player.cooldown = def.cooldown
  player.flash = def.flash
  player.refire = true
  noiseAlert(world)
}

function use(world: World): void {
  const { player, grid, ray } = world
  if (!castRay(grid, player.x, player.y, Math.cos(player.angle), Math.sin(player.angle), ray, USE_RANGE))
    return
  const cx = ray.cell % grid.width
  const cy = (ray.cell - cx) / grid.width
  const door = doorAtCell(grid, cx, cy)
  if (door) {
    const result = operateDoor(door, player.keys)
    if (result === 'locked') {
      say(world, `You need the ${door.key} keycard to open this door.`)
      emit(world, 'locked', player.x, player.y)
    } else if (result === 'opening') emit(world, 'doorOpen', cx + 0.5, cy + 0.5)
    else if (result === 'closing') emit(world, 'doorClose', cx + 0.5, cy + 0.5)
    return
  }
  if (grid.walls[ray.cell] === TEX.exit && world.exitAt === null) {
    grid.walls[ray.cell] = TEX.exitOn
    world.exitAt = world.time + EXIT_DELAY
    emit(world, 'switch', player.x, player.y)
    return
  }
  emit(world, 'locked', player.x, player.y)
}

/** Applies a pickup. Returns false when the player has no use for it, so it stays on the floor. */
function give(world: World, kind: ItemKind): boolean {
  const { player } = world
  const ammoGiven = SKILLS[world.skill]?.ammoGiven ?? 1
  const addAmmo = (ammo: 'bullets' | 'shells', amount: number) => {
    if (player.ammo[ammo] >= MAX_AMMO[ammo]) return false
    player.ammo[ammo] = Math.min(MAX_AMMO[ammo], player.ammo[ammo] + amount * ammoGiven)
    return true
  }
  const key = KEY_ITEMS[kind]
  if (key) {
    player.keys[key] = true
    return true
  }
  switch (kind) {
    case 'health':
      if (player.hp >= 100) return false
      player.hp = Math.min(100, player.hp + 25)
      return true
    case 'armor':
      if (player.armor >= 100) return false
      player.armor = 100
      return true
    case 'clip':
      return addAmmo('bullets', 10)
    case 'shells':
      return addAmmo('shells', 4)
    case 'shotgun': {
      const fresh = !player.owned.shotgun
      if (!addAmmo('shells', 8) && !fresh) return false
      player.owned.shotgun = true
      if (fresh) {
        switchTo(player, 'shotgun')
        world.face.grin = 1.2
      }
      return true
    }
    default:
      return false
  }
}

function pickUp(world: World): void {
  const { player } = world
  for (const item of world.items) {
    if (item.taken || !touches(player, item)) continue
    if (!give(world, item.kind)) continue
    item.taken = true
    world.stats.items++
    const def = ITEM_DEFS[item.kind]
    say(world, def.message)
    emit(world, def.sound, item.x, item.y)
    player.bonusTint = Math.min(0.6, player.bonusTint + 0.35)
  }
}

const touches = (player: Player, item: Item) =>
  Math.hypot(player.x - item.x, player.y - item.y) < ITEM_DEFS[item.kind].radius + PLAYER_RADIUS

function findSecrets(world: World): void {
  const { player, level } = world
  const cell = Math.floor(player.y) * level.width + Math.floor(player.x)
  const index = level.secrets.indexOf(cell)
  if (index === -1 || world.secretFound[index]) return
  world.secretFound[index] = 1
  world.stats.secrets++
  say(world, 'You found a secret area!')
  emit(world, 'secret', player.x, player.y)
}

function occupied(world: World, cx: number, cy: number): boolean {
  const inCell = (x: number, y: number, r: number) =>
    x + r > cx && x - r < cx + 1 && y + r > cy && y - r < cy + 1
  if (!world.player.dead && inCell(world.player.x, world.player.y, PLAYER_RADIUS)) return true
  return world.actors.some(
    (actor) => isSolidActor(actor) && inCell(actor.x, actor.y, MONSTER_DEFS[actor.kind].radius),
  )
}

function stepDoors(world: World, dt: number): void {
  for (const door of world.grid.doors) {
    const sound = stepDoor(door, dt, occupied(world, door.x, door.y))
    if (sound) emit(world, sound, door.x + 0.5, door.y + 0.5)
  }
}

function stepFace(world: World, dt: number): void {
  const { face } = world
  face.ouch = Math.max(0, face.ouch - dt)
  face.grin = Math.max(0, face.grin - dt)
  face.lookTime -= dt
  if (face.lookTime <= 0) {
    face.look = (Math.floor(world.rng() * 3) - 1) as -1 | 0 | 1
    face.lookTime = 0.5 + world.rng() * 1.5
  }
}

export function step(world: World, input: TickInput, dt = TICK): void {
  const { player } = world
  world.time += dt
  if (world.outcome === 'playing') world.stats.time += dt
  if (player.dead) {
    player.deadTime += dt
    player.vx = 0
    player.vy = 0
  } else {
    movePlayer(world, input, dt)
    stepWeapon(world, input, dt)
    if (input.use) use(world)
    pickUp(world)
    findSecrets(world)
  }
  stepDoors(world, dt)
  for (const actor of world.actors) thinkActor(world, actor, dt)
  moveProjectiles(world, dt)
  ageEffects(world, dt)
  player.damageTint = Math.max(0, player.damageTint - dt * 1.5)
  player.bonusTint = Math.max(0, player.bonusTint - dt * 2)
  stepFace(world, dt)
  if (world.message && world.time - world.message.time > MESSAGE_TIME) world.message = null
  if (world.exitAt !== null && world.time >= world.exitAt && world.outcome === 'playing')
    world.outcome = 'exited'
}
