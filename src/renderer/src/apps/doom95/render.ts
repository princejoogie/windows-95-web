import type { Bitmap } from './art'
import { MONSTER_DEFS, WEAPON_DEFS } from './defs'
import { TEX } from './map'
import { castRay, createHit } from './raycast'
import { type SpriteSet, TEXELS_PER_CELL } from './sprites'
import { LIGHT, LIGHT_LEVELS, type ShadedTextures, TEX_SIZE } from './textures'
import { type Actor, EFFECT_TIME, type World } from './world'

export const SCREEN_W = 320
export const SCREEN_H = 200
export const VIEW_H = 168
/** Pixels per cell at distance 1, which gives a 90 degree horizontal field of view. */
const PROJ = SCREEN_W / 2
const FULL = LIGHT_LEVELS - 1

export interface Assets {
  readonly textures: ShadedTextures
  readonly sprites: SpriteSet
  /** `lut[level * 256 + channel]` scales one color channel to a light level. */
  readonly lut: Uint8Array
}

export function buildLut(): Uint8Array {
  const lut = new Uint8Array(LIGHT_LEVELS * 256)
  LIGHT.forEach((f, level) => {
    for (let c = 0; c < 256; c++) lut[level * 256 + c] = Math.min(255, Math.round(c * f))
  })
  return lut
}

/** Light falls off with distance, and a muzzle flash brightens the whole room for a moment. */
const lightAt = (dist: number, extra: number): number => {
  const level = Math.round(FULL * (1.12 - dist * 0.075)) + extra
  return Math.max(2, Math.min(FULL, level))
}

interface SpriteDraw {
  bitmap: Bitmap
  x: number
  y: number
  /** Height of the sprite's bottom edge above the floor, in cells. */
  z: number
  bright: boolean
  depth: number
  lateral: number
}

const frameAt = (frames: readonly Bitmap[], progress: number): Bitmap | undefined =>
  frames[Math.min(frames.length - 1, Math.floor(progress * frames.length))]

function actorSprite(
  actor: Actor,
  sprites: SpriteSet,
  time: number,
): { bitmap: Bitmap; bright: boolean } | null {
  const def = MONSTER_DEFS[actor.kind]
  if (actor.kind === 'barrel') {
    if (actor.state === 'dead') return null
    if (actor.state === 'dying') {
      const bitmap = frameAt(sprites.explosion, actor.time / def.deathTime)
      return bitmap ? { bitmap, bright: true } : null
    }
    return { bitmap: sprites.barrel, bright: false }
  }
  const set = actor.kind === 'trooper' ? sprites.trooper : sprites.demon
  const walk = Math.floor(time * 5 + actor.id) % 2 === 0
  let bitmap: Bitmap | undefined
  let bright = false
  switch (actor.state) {
    case 'idle':
      bitmap = actor.kind === 'trooper' ? sprites.trooper.walkA : sprites.demon.walkA
      break
    case 'chase':
      bitmap =
        actor.kind === 'trooper'
          ? walk
            ? sprites.trooper.walkA
            : sprites.trooper.walkB
          : walk
            ? sprites.demon.walkA
            : sprites.demon.walkB
      break
    case 'attack': {
      const shooting = actor.time >= def.windup && actor.time < def.windup + 0.12
      bright = shooting
      if (actor.kind === 'trooper') bitmap = shooting ? sprites.trooper.fire : sprites.trooper.aim
      else bitmap = actor.time < def.windup ? sprites.demon.raise : sprites.demon.throw
      break
    }
    case 'pain':
      bitmap = set.pain
      break
    case 'dying':
      bitmap = frameAt(set.death.slice(0, 3), actor.time / def.deathTime)
      break
    case 'dead':
      bitmap = set.death[3]
      break
  }
  return bitmap ? { bitmap, bright } : null
}

function gatherSprites(world: World, sprites: SpriteSet, out: SpriteDraw[]): void {
  const { player } = world
  const dirX = Math.cos(player.angle)
  const dirY = Math.sin(player.angle)
  out.length = 0
  const add = (bitmap: Bitmap | undefined, x: number, y: number, z: number, bright: boolean) => {
    if (!bitmap) return
    const rx = x - player.x
    const ry = y - player.y
    const depth = rx * dirX + ry * dirY
    if (depth < 0.12) return
    out.push({ bitmap, x, y, z, bright, depth, lateral: rx * -dirY + ry * dirX })
  }
  for (const item of world.items) if (!item.taken) add(sprites.items[item.kind], item.x, item.y, 0, false)
  for (const actor of world.actors) {
    const sprite = actorSprite(actor, sprites, world.time)
    if (sprite) add(sprite.bitmap, actor.x, actor.y, 0, sprite.bright)
  }
  for (const ball of world.projectiles)
    add(sprites.fireball[Math.floor(world.time * 12) % 2], ball.x, ball.y, 0.32, true)
  for (const effect of world.effects) {
    const progress = effect.time / EFFECT_TIME[effect.kind]
    const frames =
      effect.kind === 'puff' ? sprites.puff : effect.kind === 'blood' ? sprites.blood : sprites.blast
    add(
      frameAt(frames, progress),
      effect.x,
      effect.y,
      effect.kind === 'blast' ? 0.25 : 0.42,
      effect.kind !== 'blood',
    )
  }
  out.sort((a, b) => b.depth - a.depth)
}

/**
 * Draws the 3D view into the top `viewH` rows of `frame`, and marks each wall it draws as seen for the
 * automap. Reuses `zbuf` and `scratch` between frames.
 */
export function renderView(
  frame: Bitmap,
  world: World,
  assets: Assets,
  zbuf: Float32Array,
  viewH = VIEW_H,
  scratch: SpriteDraw[] = [],
): void {
  const { player, grid, seen } = world
  const horizon = viewH / 2
  const { pixels } = frame
  const W = SCREEN_W
  const dirX = Math.cos(player.angle)
  const dirY = Math.sin(player.angle)
  const planeX = -dirY
  const planeY = dirX
  const extra = player.flash > 0 ? 6 : 0
  const bobZ = player.dead ? 0 : Math.sin(player.bobPhase * 2) * 0.03 * player.bob
  const eyeZ = player.dead ? Math.max(0.1, 0.5 - player.deadTime * 0.9) : 0.5 + bobZ
  const floorTex = assets.textures[TEX.floor] ?? []
  const ceilTex = assets.textures[TEX.ceiling] ?? []

  for (let y = 0; y < viewH; y++) {
    const below = y + 0.5 > horizon
    const rowDist = below ? (eyeZ * PROJ) / (y + 0.5 - horizon) : ((1 - eyeZ) * PROJ) / (horizon - y - 0.5)
    const texels = (below ? floorTex : ceilTex)[lightAt(rowDist, extra)]
    if (!texels) continue
    const stepX = (rowDist * 2 * planeX) / W
    const stepY = (rowDist * 2 * planeY) / W
    let fx = player.x + rowDist * (dirX - planeX)
    let fy = player.y + rowDist * (dirY - planeY)
    let i = y * W
    for (let x = 0; x < W; x++) {
      pixels[i++] = texels[(((fx * TEX_SIZE) & 63) << 6) | ((fy * TEX_SIZE) & 63)] ?? 0
      fx += stepX
      fy += stepY
    }
  }

  const hit = createHit()
  for (let x = 0; x < W; x++) {
    const cam = (2 * (x + 0.5)) / W - 1
    if (!castRay(grid, player.x, player.y, dirX + planeX * cam, dirY + planeY * cam, hit)) {
      zbuf[x] = Number.POSITIVE_INFINITY
      continue
    }
    seen[hit.cell] = 1
    const t = Math.max(hit.t, 1e-4)
    zbuf[x] = t
    const lineH = PROJ / t
    const top = horizon - (1 - eyeZ) * lineH
    const level = Math.max(2, lightAt(t, extra) - (hit.side === 1 ? 3 : 0))
    const texels = assets.textures[hit.tex]?.[level]
    if (!texels) continue
    const column = Math.min(TEX_SIZE - 1, Math.floor(hit.u * TEX_SIZE)) * TEX_SIZE
    const y0 = Math.max(0, Math.ceil(top - 0.5))
    const y1 = Math.min(viewH, Math.ceil(top + lineH - 0.5))
    const step = TEX_SIZE / lineH
    let v = (y0 + 0.5 - top) * step
    for (let y = y0; y < y1; y++) {
      pixels[y * W + x] = texels[column + Math.min(TEX_SIZE - 1, v | 0)] ?? 0
      v += step
    }
  }

  gatherSprites(world, assets.sprites, scratch)
  for (const sprite of scratch) drawSprite(frame, sprite, eyeZ, extra, assets.lut, zbuf, viewH)
  if (!player.dead) drawWeapon(frame, world, assets, viewH)
  tint(frame, viewH, player.damageTint * 0.55, 255, 0, 0)
  tint(frame, viewH, player.bonusTint * 0.35, 255, 220, 80)
  if (player.dead) tint(frame, viewH, Math.min(0.5, player.deadTime * 0.5), 140, 0, 0)
}

function drawSprite(
  frame: Bitmap,
  sprite: SpriteDraw,
  eyeZ: number,
  extra: number,
  lut: Uint8Array,
  zbuf: Float32Array,
  viewH: number,
): void {
  const { bitmap, depth } = sprite
  const scale = PROJ / depth
  const w = (bitmap.width / TEXELS_PER_CELL) * scale
  const h = (bitmap.height / TEXELS_PER_CELL) * scale
  const left = SCREEN_W / 2 + (sprite.lateral / depth) * PROJ - w / 2
  const bottom = viewH / 2 + (eyeZ - sprite.z) * scale
  const top = bottom - h
  const x0 = Math.max(0, Math.ceil(left - 0.5))
  const x1 = Math.min(SCREEN_W, Math.ceil(left + w - 0.5))
  const y0 = Math.max(0, Math.ceil(top - 0.5))
  const y1 = Math.min(viewH, Math.ceil(bottom - 0.5))
  const base = (sprite.bright ? LIGHT_LEVELS - 1 : lightAt(depth, extra)) * 256
  const src = bitmap.pixels
  const dst = frame.pixels
  for (let x = x0; x < x1; x++) {
    if (depth >= (zbuf[x] ?? 0)) continue
    const u = Math.min(bitmap.width - 1, Math.floor(((x + 0.5 - left) / w) * bitmap.width))
    for (let y = y0; y < y1; y++) {
      const v = Math.min(bitmap.height - 1, Math.floor(((y + 0.5 - top) / h) * bitmap.height))
      const c = src[v * bitmap.width + u] ?? 0
      if (!c) continue
      dst[y * SCREEN_W + x] =
        (0xff000000 |
          ((lut[base + ((c >>> 16) & 255)] ?? 0) << 16) |
          ((lut[base + ((c >>> 8) & 255)] ?? 0) << 8) |
          (lut[base + (c & 255)] ?? 0)) >>>
        0
    }
  }
}

/** Copies a bitmap 1:1, skipping transparent pixels and clipping to the view. */
export function blit(frame: Bitmap, bitmap: Bitmap, x: number, y: number, maxY = SCREEN_H): void {
  const x0 = Math.round(x)
  const y0 = Math.round(y)
  for (let j = 0; j < bitmap.height; j++) {
    const py = y0 + j
    if (py < 0 || py >= maxY) continue
    for (let i = 0; i < bitmap.width; i++) {
      const px = x0 + i
      if (px < 0 || px >= frame.width) continue
      const c = bitmap.pixels[j * bitmap.width + i] ?? 0
      if (c) frame.pixels[py * frame.width + px] = c
    }
  }
}

function drawWeapon(frame: Bitmap, world: World, assets: Assets, viewH: number): void {
  const { player } = world
  const def = WEAPON_DEFS[player.weapon]
  const frames = assets.sprites.weapons[player.weapon]
  let bitmap = frames[0]
  if (player.weapon === 'fist' && player.cooldown > def.cooldown - 0.22) bitmap = frames[1]
  else if (player.flash > 0) bitmap = frames[1]
  else if (player.weapon === 'shotgun' && player.cooldown > 0.25 && player.cooldown < def.cooldown - 0.2)
    bitmap = frames[2]
  if (!bitmap) return
  const swing = player.bobPhase
  const bx = Math.cos(swing) * 10 * player.bob
  const by = Math.abs(Math.sin(swing)) * 8 * player.bob
  const half = 0.18
  const lowered = player.switchTime > 0 ? 1 - Math.abs(player.switchTime - half) / half : 0
  const x = SCREEN_W / 2 - bitmap.width / 2 + bx + (player.weapon === 'fist' ? 20 : 0)
  const y = viewH - bitmap.height + 6 + by + lowered * 70
  blit(frame, bitmap, x, y, viewH)
}

function tint(frame: Bitmap, viewH: number, amount: number, r: number, g: number, b: number): void {
  if (amount <= 0.01) return
  const keep = 1 - amount
  const pr = r * amount
  const pg = g * amount
  const pb = b * amount
  const { pixels } = frame
  const end = viewH * SCREEN_W
  for (let i = 0; i < end; i++) {
    const c = pixels[i] ?? 0
    pixels[i] =
      (0xff000000 |
        ((((c >>> 16) & 255) * keep + pb) << 16) |
        ((((c >>> 8) & 255) * keep + pg) << 8) |
        ((c & 255) * keep + pr)) >>>
      0
  }
}
