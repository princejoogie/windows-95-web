import { slideMove } from './collision'
import { applyHit, blast, damageActor, damagePlayer, spawnEffect, traceAttack, wake } from './combat'
import { BARREL_BLAST_AT, MELEE_RANGE, MONSTER_DEFS, SKILLS } from './defs'
import { doorAtCell, isSolid } from './grid'
import { lineOfSight } from './raycast'
import { spread } from './rng'
import { type Actor, emit, isSolidActor, PLAYER_RADIUS, type World } from './world'

/** Doom's hitscan monsters miss by up to about 22 degrees either way. */
const MONSTER_AIM_SPREAD = 0.39
const FIREBALL_RADIUS = 0.1
const DIRECTIONS = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4)

/** Monsters see in a half circle ahead of them, and always notice a player close enough to touch. */
function canSeePlayer(world: World, actor: Actor): boolean {
  const { player } = world
  if (player.dead) return false
  const dx = player.x - actor.x
  const dy = player.y - actor.y
  const dist = Math.hypot(dx, dy)
  const ahead = dx * Math.cos(actor.angle) + dy * Math.sin(actor.angle) >= 0
  if (!ahead && dist > MELEE_RANGE * 1.5) return false
  return lineOfSight(world.grid, actor.x, actor.y, player.x, player.y, world.ray)
}

/**
 * Wakes every idle monster that can hear the player: sound floods through open cells and open doors,
 * and a closed door stops it.
 */
export function noiseAlert(world: World, maxSteps = 24): void {
  const { grid, player } = world
  const seen = new Int16Array(grid.width * grid.height).fill(-1)
  const start = Math.floor(player.y) * grid.width + Math.floor(player.x)
  const queue = [start]
  seen[start] = 0
  for (let head = 0; head < queue.length; head++) {
    const cell = queue[head] ?? 0
    const steps = seen[cell] ?? 0
    if (steps >= maxSteps) continue
    const cx = cell % grid.width
    const cy = (cell - cx) / grid.width
    for (const [nx, ny] of [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ] as const) {
      const next = ny * grid.width + nx
      if (isSolid(grid, nx, ny) || seen[next] !== -1) continue
      seen[next] = steps + 1
      queue.push(next)
    }
  }
  for (const actor of world.actors) {
    if (actor.state === 'idle' && seen[Math.floor(actor.y) * grid.width + Math.floor(actor.x)] !== -1)
      wake(world, actor)
  }
}

function blockedFor(world: World, actor: Actor, r: number) {
  return (x: number, y: number): boolean => {
    const { player } = world
    if (!player.dead && Math.hypot(player.x - x, player.y - y) < r + PLAYER_RADIUS) return true
    for (const other of world.actors) {
      if (other === actor || !isSolidActor(other)) continue
      if (Math.hypot(other.x - x, other.y - y) < r + MONSTER_DEFS[other.kind].radius) return true
    }
    return false
  }
}

/** Monsters walk through unlocked doors, opening them as they bump into them. */
const passable = (world: World, cx: number, cy: number): boolean =>
  !isSolid(world.grid, cx, cy) || doorAtCell(world.grid, cx, cy)?.key === null

function openDoorAhead(world: World, actor: Actor): boolean {
  const reach = MONSTER_DEFS[actor.kind].radius + 0.2
  const cx = Math.floor(actor.x + actor.dirX * reach)
  const cy = Math.floor(actor.y + actor.dirY * reach)
  const door = doorAtCell(world.grid, cx, cy)
  if (!door || door.key !== null || (door.phase !== 'closed' && door.phase !== 'closing')) return false
  door.phase = 'opening'
  emit(world, 'doorOpen', cx + 0.5, cy + 0.5)
  return true
}

/** Heads for the open direction closest to the player, with some wobble so packs spread out. */
function pickDirection(world: World, actor: Actor): void {
  const toPlayer = Math.atan2(world.player.y - actor.y, world.player.x - actor.x)
  const probe = MONSTER_DEFS[actor.kind].radius + 0.35
  let best = -1
  let bestScore = Number.POSITIVE_INFINITY
  for (const dir of DIRECTIONS) {
    const px = actor.x + Math.cos(dir) * probe
    const py = actor.y + Math.sin(dir) * probe
    if (!passable(world, Math.floor(px), Math.floor(py))) continue
    const diff = Math.abs(Math.atan2(Math.sin(dir - toPlayer), Math.cos(dir - toPlayer)))
    const score = diff + world.rng() * 0.9
    if (score < bestScore) {
      bestScore = score
      best = dir
    }
  }
  actor.dirX = best === -1 ? 0 : Math.cos(best)
  actor.dirY = best === -1 ? 0 : Math.sin(best)
  actor.moveTime = 0.3 + world.rng() * 0.6
}

function startAttack(actor: Actor, attack: Actor['attack']): void {
  actor.state = 'attack'
  actor.attack = attack
  actor.time = 0
  actor.fired = false
}

/** Doom's missile range check: the farther the player, the less likely a monster fires this time. */
function wantsToShoot(world: World, actor: Actor, dist: number): boolean {
  const def = MONSTER_DEFS[actor.kind]
  const units = dist * 64 - 64 - (def.melee ? 0 : 128)
  return world.rng() >= Math.min(200, Math.max(0, units)) / 256
}

function chase(world: World, actor: Actor, dt: number): void {
  const def = MONSTER_DEFS[actor.kind]
  const { player } = world
  if (player.dead) {
    actor.state = 'idle'
    return
  }
  const dx = player.x - actor.x
  const dy = player.y - actor.y
  const dist = Math.hypot(dx, dy)
  actor.cooldown -= dt
  if (actor.cooldown <= 0) {
    const sees = lineOfSight(world.grid, actor.x, actor.y, player.x, player.y, world.ray)
    if (sees) actor.angle = Math.atan2(dy, dx)
    if (sees && def.melee && dist <= MELEE_RANGE + PLAYER_RADIUS) {
      startAttack(actor, 'melee')
      return
    }
    if (sees && def.ranged.kind !== 'none' && wantsToShoot(world, actor, dist)) {
      startAttack(actor, 'ranged')
      return
    }
    actor.cooldown = 0.12
  }
  actor.moveTime -= dt
  if (actor.moveTime <= 0) pickDirection(world, actor)
  if (dist <= def.radius + PLAYER_RADIUS + 0.1) return
  const step = def.speed * dt
  const before = { x: actor.x, y: actor.y }
  slideMove(
    world.grid,
    actor,
    def.radius,
    actor.dirX * step,
    actor.dirY * step,
    blockedFor(world, actor, def.radius),
  )
  if (Math.hypot(actor.x - before.x, actor.y - before.y) < step * 0.3) {
    if (!openDoorAhead(world, actor)) pickDirection(world, actor)
  } else if (!(dist < 4 && actor.cooldown > 0)) actor.angle = Math.atan2(actor.dirY, actor.dirX)
}

function fire(world: World, actor: Actor): void {
  const def = MONSTER_DEFS[actor.kind]
  const { player } = world
  const aim = Math.atan2(player.y - actor.y, player.x - actor.x)
  actor.angle = aim
  if (actor.attack === 'melee') {
    emit(world, 'claw', actor.x, actor.y)
    if (def.melee && Math.hypot(player.x - actor.x, player.y - actor.y) <= MELEE_RANGE + PLAYER_RADIUS + 0.15)
      damagePlayer(world, def.melee(world.rng))
    return
  }
  const attack = def.ranged
  if (attack.kind === 'hitscan') {
    emit(world, attack.sound, actor.x, actor.y)
    const result = traceAttack(
      world,
      actor.x,
      actor.y,
      aim + spread(world.rng) * MONSTER_AIM_SPREAD,
      32,
      actor,
    )
    applyHit(world, result, attack.damage(world.rng))
  } else if (attack.kind === 'fireball') {
    emit(world, 'fireball', actor.x, actor.y)
    const out = def.radius + FIREBALL_RADIUS + 0.05
    world.projectiles.push({
      x: actor.x + Math.cos(aim) * out,
      y: actor.y + Math.sin(aim) * out,
      vx: Math.cos(aim) * attack.speed,
      vy: Math.sin(aim) * attack.speed,
      owner: actor.id,
      damage: attack.damage(world.rng),
      alive: true,
    })
  }
}

export function thinkActor(world: World, actor: Actor, dt: number): void {
  const def = MONSTER_DEFS[actor.kind]
  actor.time += dt
  switch (actor.state) {
    case 'idle':
      if (def.speed > 0 && canSeePlayer(world, actor)) wake(world, actor)
      return
    case 'chase':
      chase(world, actor, dt)
      return
    case 'attack':
      if (!actor.fired && actor.time >= def.windup) {
        actor.fired = true
        fire(world, actor)
      }
      if (actor.time >= def.windup + def.recover) {
        actor.state = 'chase'
        actor.time = 0
        actor.cooldown = (0.5 + world.rng() * 1.1) * (SKILLS[world.skill]?.aggression ?? 1)
        actor.moveTime = 0
      }
      return
    case 'pain':
      if (actor.time >= def.painTime) {
        actor.state = 'chase'
        actor.time = 0
      }
      return
    case 'dying':
      if (def.explodes && !actor.blasted && actor.time >= BARREL_BLAST_AT) {
        actor.blasted = true
        blast(world, actor.x, actor.y, actor)
      }
      if (actor.time >= def.deathTime) {
        actor.state = 'dead'
        actor.time = 0
      }
      return
    case 'dead':
      return
  }
}

export function moveProjectiles(world: World, dt: number): void {
  const { player } = world
  for (const ball of world.projectiles) {
    ball.x += ball.vx * dt
    ball.y += ball.vy * dt
    let hit = isSolid(world.grid, Math.floor(ball.x), Math.floor(ball.y))
    if (
      !hit &&
      !player.dead &&
      Math.hypot(player.x - ball.x, player.y - ball.y) < PLAYER_RADIUS + FIREBALL_RADIUS
    ) {
      damagePlayer(world, ball.damage)
      hit = true
    }
    if (!hit) {
      for (const actor of world.actors) {
        if (actor.id === ball.owner || !isSolidActor(actor)) continue
        if (
          Math.hypot(actor.x - ball.x, actor.y - ball.y) <
          MONSTER_DEFS[actor.kind].radius + FIREBALL_RADIUS
        ) {
          damageActor(world, actor, ball.damage)
          hit = true
          break
        }
      }
    }
    if (hit) {
      ball.alive = false
      spawnEffect(world, 'blast', ball.x - ball.vx * dt, ball.y - ball.vy * dt)
      emit(world, 'fireballHit', ball.x, ball.y)
    }
  }
  for (let i = world.projectiles.length - 1; i >= 0; i--)
    if (!world.projectiles[i]?.alive) world.projectiles.splice(i, 1)
}
