import { BLAST_DAMAGE, BLAST_RADIUS, MONSTER_DEFS, SKILLS } from './defs'
import { castRay, lineOfSight } from './raycast'
import {
  type Actor,
  EFFECT_TIME,
  type EffectKind,
  emit,
  isSolidActor,
  PLAYER_RADIUS,
  type World,
} from './world'

/** Who fired. Monsters can hit the player, each other, and barrels. The player hits everything else. */
export type Shooter = Actor | 'player'

export type TraceResult =
  | { readonly kind: 'actor'; readonly actor: Actor; readonly t: number }
  | { readonly kind: 'player'; readonly t: number }
  | { readonly kind: 'wall'; readonly x: number; readonly y: number; readonly t: number }
  | { readonly kind: 'none' }

/** Distance along a unit ray to where it enters a circle, or Infinity on a miss. */
function rayCircle(
  ox: number,
  oy: number,
  dx: number,
  dy: number,
  cx: number,
  cy: number,
  r: number,
): number {
  const rx = cx - ox
  const ry = cy - oy
  const along = rx * dx + ry * dy
  if (along <= 0) return Number.POSITIVE_INFINITY
  const perp = rx * dy - ry * dx
  const inside = r * r - perp * perp
  if (inside < 0) return Number.POSITIVE_INFINITY
  return Math.max(0, along - Math.sqrt(inside))
}

/** A single hitscan line: the first actor, player, or wall it reaches within `range`. */
export function traceAttack(
  world: World,
  ox: number,
  oy: number,
  angle: number,
  range: number,
  shooter: Shooter,
): TraceResult {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const wall = castRay(world.grid, ox, oy, dx, dy, world.ray, range)
  const wallT = wall ? world.ray.t : range
  const puffT = wallT - 0.04
  let best: TraceResult = wall
    ? { kind: 'wall', x: ox + dx * puffT, y: oy + dy * puffT, t: wallT }
    : { kind: 'none' }
  let bestT = wallT
  for (const actor of world.actors) {
    if (actor === shooter || !isSolidActor(actor)) continue
    const t = rayCircle(ox, oy, dx, dy, actor.x, actor.y, MONSTER_DEFS[actor.kind].radius)
    if (t < bestT) {
      bestT = t
      best = { kind: 'actor', actor, t }
    }
  }
  if (shooter !== 'player' && !world.player.dead) {
    const t = rayCircle(ox, oy, dx, dy, world.player.x, world.player.y, PLAYER_RADIUS)
    if (t < bestT) best = { kind: 'player', t }
  }
  return best
}

export function spawnEffect(world: World, kind: EffectKind, x: number, y: number): void {
  world.effects.push({ kind, x, y, time: 0 })
}

export function ageEffects(world: World, dt: number): void {
  for (const effect of world.effects) effect.time += dt
  for (let i = world.effects.length - 1; i >= 0; i--) {
    const effect = world.effects[i]
    if (effect && effect.time >= EFFECT_TIME[effect.kind]) world.effects.splice(i, 1)
  }
}

export function wake(world: World, actor: Actor): void {
  if (actor.state !== 'idle') return
  const def = MONSTER_DEFS[actor.kind]
  if (def.speed === 0) return
  actor.state = 'chase'
  actor.time = 0
  actor.cooldown = 0.2 + world.rng() * 0.5
  actor.moveTime = 0
  if (def.sight) emit(world, def.sight, actor.x, actor.y)
}

export function damageActor(world: World, actor: Actor, amount: number): void {
  if (!isSolidActor(actor)) return
  const def = MONSTER_DEFS[actor.kind]
  actor.hp -= amount
  if (!def.explodes) spawnEffect(world, 'blood', actor.x, actor.y)
  if (actor.hp <= 0) {
    actor.state = 'dying'
    actor.time = 0
    if (def.death) emit(world, def.death, actor.x, actor.y)
    if (def.countsKill) world.stats.kills++
    return
  }
  wake(world, actor)
  if (world.rng() < def.painChance) {
    actor.state = 'pain'
    actor.time = 0
    if (def.pain) emit(world, def.pain, actor.x, actor.y)
  }
}

/** Green armor soaks a third of each hit until it runs out. */
export function damagePlayer(world: World, amount: number): void {
  const player = world.player
  if (player.dead) return
  const taken = Math.max(1, Math.round(amount * (SKILLS[world.skill]?.damageTaken ?? 1)))
  const saved = Math.min(player.armor, Math.floor(taken / 3))
  player.armor -= saved
  player.hp -= taken - saved
  player.damageTint = Math.min(1, player.damageTint + taken / 40)
  world.face.ouch = 0.6
  if (player.hp <= 0) {
    player.hp = 0
    player.dead = true
    player.deadTime = 0
    world.outcome = 'dead'
    emit(world, 'playerDeath', player.x, player.y)
  } else {
    emit(world, 'playerPain', player.x, player.y)
  }
}

export function applyHit(world: World, result: TraceResult, damage: number): void {
  if (result.kind === 'actor') damageActor(world, result.actor, damage)
  else if (result.kind === 'player') damagePlayer(world, damage)
  else if (result.kind === 'wall') spawnEffect(world, 'puff', result.x, result.y)
}

/** Damage that falls off linearly to nothing at `BLAST_RADIUS`, blocked by walls. */
export function blast(world: World, x: number, y: number, source: Actor | null): void {
  const reach = (tx: number, ty: number, r: number) => {
    const d = Math.max(0, Math.hypot(tx - x, ty - y) - r)
    if (d >= BLAST_RADIUS || !lineOfSight(world.grid, x, y, tx, ty, world.ray)) return 0
    return Math.floor(BLAST_DAMAGE * (1 - d / BLAST_RADIUS))
  }
  for (const actor of world.actors) {
    if (actor === source || !isSolidActor(actor)) continue
    const amount = reach(actor.x, actor.y, MONSTER_DEFS[actor.kind].radius)
    if (amount > 0) damageActor(world, actor, amount)
  }
  const amount = reach(world.player.x, world.player.y, PLAYER_RADIUS)
  if (amount > 0) damagePlayer(world, amount)
}
