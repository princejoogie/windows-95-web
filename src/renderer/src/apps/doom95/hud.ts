import { type Bitmap, Painter, rgb, shade } from './art'
import { WEAPON_DEFS, WEAPONS } from './defs'
import { drawCentered, drawText, textWidth } from './font'
import { KEY_COLORS } from './map'
import { blit, SCREEN_W, VIEW_H } from './render'
import { createRng } from './rng'
import type { SpriteSet } from './sprites'
import type { World } from './world'

const BAR_H = 32
const LABEL = rgb(200, 196, 180)
const DIGIT = rgb(220, 30, 20)
const OWNED = rgb(240, 210, 40)
const NOT_OWNED = rgb(110, 106, 96)
const KEY_RGB = { red: rgb(220, 30, 24), blue: rgb(40, 80, 240), yellow: rgb(240, 210, 30) } as const

/** Section edges across the bar, left to right. */
const SECTIONS = [
  { x: 0, w: 48, label: 'AMMO' },
  { x: 48, w: 58, label: 'HEALTH' },
  { x: 106, w: 38, label: 'ARMS' },
  { x: 144, w: 32, label: '' },
  { x: 176, w: 58, label: 'ARMOR' },
  { x: 234, w: 16, label: '' },
  { x: 250, w: 70, label: '' },
] as const

/** The bar's static metal background, built once. */
export function buildStatusBackground(): Bitmap {
  const p = Painter.create(SCREEN_W, BAR_H)
  const rng = createRng(32)
  p.rect(0, 0, SCREEN_W, BAR_H, () => shade(rgb(96, 92, 84), 0.9 + rng() * 0.2))
  p.rect(0, 0, SCREEN_W, 1, rgb(150, 146, 136))
  for (const section of SECTIONS) {
    p.rect(section.x + 2, 2, section.w - 4, BAR_H - 4, () => shade(rgb(58, 56, 52), 0.9 + rng() * 0.2))
    p.bevel(section.x + 1, 1, section.w - 2, BAR_H - 2, rgb(40, 38, 34), rgb(150, 146, 136))
    if (section.label) drawCentered(p.bitmap, section.label, 23, { color: LABEL }, section.x + section.w / 2)
  }
  return p.bitmap
}

function bigNumber(frame: Bitmap, value: number, right: number, y: number, suffix = ''): void {
  const text = `${Math.max(0, Math.round(value))}${suffix}`
  drawText(frame, text, right - textWidth(text, 2), y, { color: DIGIT, scale: 2, shadow: true })
}

function faceFor(world: World, sprites: SpriteSet): Bitmap | undefined {
  const { player, face } = world
  if (player.dead) return sprites.deadFace
  const band = Math.min(4, Math.floor((100 - Math.min(100, player.hp)) / 20))
  const set = sprites.faces[band]
  if (!set) return undefined
  if (face.ouch > 0) return set.ouch
  if (face.grin > 0) return set.grin
  return set.look[face.look + 1]
}

export function drawStatusBar(frame: Bitmap, background: Bitmap, world: World, sprites: SpriteSet): void {
  frame.pixels.set(background.pixels, VIEW_H * SCREEN_W)
  const { player } = world
  const ammo = WEAPON_DEFS[player.weapon].ammo
  if (ammo) bigNumber(frame, player.ammo[ammo], 44, VIEW_H + 5)
  bigNumber(frame, player.hp, 102, VIEW_H + 5, '%')
  WEAPONS.forEach((weapon, i) => {
    const slot = WEAPON_DEFS[weapon].slot
    const color = player.owned[weapon] ? (weapon === player.weapon ? rgb(255, 255, 255) : OWNED) : NOT_OWNED
    drawText(frame, String(slot), 112 + i * 10, VIEW_H + 9, { color })
  })
  const faceBitmap = faceFor(world, sprites)
  if (faceBitmap) blit(frame, faceBitmap, 148, VIEW_H + 2)
  bigNumber(frame, player.armor, 230, VIEW_H + 5, '%')
  KEY_COLORS.forEach((key, i) => {
    const y = VIEW_H + 4 + i * 9
    if (player.keys[key]) {
      frame.pixels.fill(KEY_RGB[key], y * SCREEN_W + 238, y * SCREEN_W + 246)
      for (let j = 1; j < 7; j++)
        frame.pixels.fill(KEY_RGB[key], (y + j) * SCREEN_W + 238, (y + j) * SCREEN_W + 246)
    }
  })
  const rows = [
    ['BULL', player.ammo.bullets, 200],
    ['SHEL', player.ammo.shells, 50],
  ] as const
  rows.forEach(([label, have, max], i) => {
    const y = VIEW_H + 6 + i * 11
    drawText(frame, label, 254, y, { color: LABEL })
    drawText(frame, `${have}/${max}`, 280, y, { color: OWNED })
  })
}
