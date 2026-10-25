import { type Bitmap, mix, Painter, rgb, shade } from './art'
import type { ItemKind } from './map'
import { createRng, type Rng } from './rng'

/** Sprites use 64 texels per cell, so a 56-pixel-tall trooper stands 7/8 of a wall high. */
export const TEXELS_PER_CELL = 64

const BLOOD = rgb(150, 0, 0)
const DARK_BLOOD = rgb(90, 0, 0)

function splat(
  p: Painter,
  rng: Rng,
  cx: number,
  cy: number,
  spreadX: number,
  spreadY: number,
  n: number,
  c = BLOOD,
) {
  for (let i = 0; i < n; i++) {
    const x = cx + (rng() - 0.5) * spreadX * 2
    const y = cy + (rng() - 0.5) * spreadY * 2
    p.ball(x, y, 1 + rng() * 1.6, 1 + rng() * 1.2, rng() < 0.5 ? c : DARK_BLOOD, false)
  }
}

/** Rotates a bitmap about its bottom center and lays it down, for death frames. */
function topple(src: Bitmap, angle: number, width: number, height: number): Painter {
  const out = Painter.create(width, height)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const pivotX = src.width / 2
  const pivotY = src.height - 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - width / 2
      const dy = y - (height - 1)
      const sx = Math.round(pivotX + dx * cos + dy * sin)
      const sy = Math.round(pivotY - dx * sin + dy * cos)
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue
      const c = src.pixels[sy * src.width + sx] ?? 0
      if (c) out.set(x, y, c)
    }
  }
  return out
}

function pool(p: Painter, rng: Rng, cx: number, w: number) {
  p.ball(cx, p.height - 2, w, 2, DARK_BLOOD, false)
  splat(p, rng, cx, p.height - 3, w * 0.8, 1.5, 6)
}

interface Body {
  readonly skin: number
  readonly cloth: number
  readonly pants: number
  readonly boots: number
}

const TROOPER: Body = {
  skin: rgb(156, 146, 116),
  cloth: rgb(96, 104, 64),
  pants: rgb(86, 74, 50),
  boots: rgb(48, 36, 26),
}

type Pose = 'walkA' | 'walkB' | 'aim' | 'fire' | 'pain'

function trooper(pose: Pose, rng: Rng): Painter {
  const p = Painter.create(40, 56)
  const b = TROOPER
  const stride = pose === 'walkA' ? 3 : pose === 'walkB' ? -3 : 0
  p.limb(16, 34, 15 - stride, 52, 3, b.pants)
  p.limb(24, 34, 25 + stride, 52, 3, b.pants)
  p.rect(11 - stride, 51, 8, 5, b.boots)
  p.rect(21 + stride, 51, 8, 5, b.boots)
  p.ball(20, 27, 10, 11, b.cloth)
  p.rect(13, 24, 14, 3, shade(b.cloth, 0.6))
  p.rect(13, 33, 14, 3, rgb(60, 44, 30))
  p.ball(20, 10, 6, 7, b.skin)
  p.rect(14, 4, 12, 4, rgb(70, 76, 50))
  p.set(17, 10, rgb(200, 30, 20))
  p.set(23, 10, rgb(200, 30, 20))
  p.rect(18, 14, 4, 1, rgb(80, 50, 40))
  const gun = rgb(46, 46, 50)
  if (pose === 'aim' || pose === 'fire') {
    p.limb(10, 22, 18, 26, 2.5, b.cloth)
    p.limb(30, 22, 22, 26, 2.5, b.cloth)
    p.rect(17, 20, 6, 10, gun)
    p.ball(20, 22, 2.5, 2.5, rgb(20, 20, 20), false)
    if (pose === 'fire') {
      p.ball(20, 21, 7, 6, rgb(255, 200, 60))
      p.ball(20, 21, 3.5, 3, rgb(255, 255, 210), false)
    }
  } else if (pose === 'pain') {
    p.limb(10, 22, 4, 14, 2.5, b.cloth)
    p.limb(30, 22, 36, 14, 2.5, b.cloth)
    p.rect(30, 8, 8, 3, gun)
    splat(p, rng, 20, 25, 6, 6, 10)
  } else {
    p.limb(10, 22, 12, 32, 2.5, b.cloth)
    p.limb(30, 22, 28, 32, 2.5, b.cloth)
    p.rect(8, 28, 26, 4, gun)
    p.rect(30, 26, 8, 3, gun)
  }
  p.outline()
  p.grain(rng, 0.12)
  return p
}

const DEMON_SKIN = rgb(128, 82, 52)

type DemonPose = 'walkA' | 'walkB' | 'raise' | 'throw' | 'pain'

function demon(pose: DemonPose, rng: Rng): Painter {
  const p = Painter.create(44, 58)
  const skin = DEMON_SKIN
  const stride = pose === 'walkA' ? 3 : pose === 'walkB' ? -3 : 0
  p.limb(17, 36, 14 - stride, 54, 3.5, shade(skin, 0.85))
  p.limb(27, 36, 30 + stride, 54, 3.5, shade(skin, 0.85))
  p.ball(13 - stride, 55, 4, 2.5, rgb(60, 40, 30))
  p.ball(31 + stride, 55, 4, 2.5, rgb(60, 40, 30))
  p.ball(22, 28, 12, 12, skin)
  for (let y = 22; y < 38; y += 4) p.rect(16, y, 12, 1, shade(skin, 0.7))
  p.ball(22, 13, 7, 7, skin)
  const spike = rgb(230, 224, 200)
  for (const [x, y, dx] of [
    [10, 18, -4],
    [12, 15, -3],
    [34, 18, 4],
    [32, 15, 3],
  ] as const)
    p.line(x, y, x + dx, y - 6, spike)
  p.line(17, 8, 15, 2, spike)
  p.line(27, 8, 29, 2, spike)
  const eye = pose === 'pain' ? rgb(255, 255, 255) : rgb(255, 170, 20)
  p.rect(18, 12, 3, 2, eye)
  p.rect(24, 12, 3, 2, eye)
  p.rect(19, 17, 7, pose === 'pain' || pose === 'throw' ? 3 : 1, rgb(60, 10, 10))
  const fire = (x: number, y: number, r: number) => {
    p.ball(x, y, r, r, rgb(240, 90, 20))
    p.ball(x, y, r * 0.55, r * 0.55, rgb(255, 230, 120), false)
  }
  if (pose === 'raise') {
    p.limb(12, 22, 6, 8, 3, skin)
    p.limb(32, 22, 36, 34, 3, skin)
    fire(6, 6, 4.5)
  } else if (pose === 'throw') {
    p.limb(12, 22, 18, 26, 3, skin)
    p.limb(32, 22, 26, 26, 3, skin)
    fire(22, 26, 6)
  } else if (pose === 'pain') {
    p.limb(12, 22, 4, 12, 3, skin)
    p.limb(32, 22, 40, 12, 3, skin)
    splat(p, rng, 22, 28, 7, 7, 10)
  } else {
    p.limb(12, 22, 8 + stride, 36, 3, skin)
    p.limb(32, 22, 36 - stride, 36, 3, skin)
    for (const x of [7 + stride, 36 - stride]) p.line(x, 37, x, 40, spike)
  }
  p.outline()
  p.grain(rng, 0.14)
  return p
}

function deathFrames(stand: Painter, rng: Rng): Bitmap[] {
  const h = stand.height
  // Bodies fall to the left about the feet, so the frame must fit a full body length beside them.
  const w = 2 * h + 8
  const torso = w / 2 - h * 0.5
  const reel = topple(stand.bitmap, -0.25, w, h)
  splat(reel, rng, w / 2 - h * 0.15, h * 0.45, 7, 7, 14)
  const fall = topple(stand.bitmap, -0.85, w, h)
  splat(fall, rng, w / 2 - h * 0.35, h * 0.65, 8, 5, 12)
  const down = topple(stand.bitmap, -1.45, w, h)
  pool(down, rng, torso, 14)
  const corpse = topple(stand.bitmap, -1.57, w, h)
  pool(corpse, rng, torso, 18)
  splat(corpse, rng, torso, h - 6, 16, 3, 16)
  return [reel.bitmap, fall.bitmap, down.bitmap, corpse.bitmap]
}

function barrel(rng: Rng): Bitmap {
  const p = Painter.create(24, 32)
  for (let x = 0; x < 24; x++) {
    const f = 0.45 + 0.75 * Math.cos(((x - 9) / 15) * (Math.PI / 2)) ** 0.6
    p.rect(x, 4, 1, 28, shade(rgb(78, 104, 66), f))
    for (const y of [5, 17, 29]) p.rect(x, y, 1, 2, shade(rgb(60, 66, 60), f))
  }
  p.ball(12, 4, 11, 3.5, rgb(40, 50, 36), false)
  p.ball(12, 4, 8, 2.5, rgb(120, 230, 60), false)
  p.ball(10, 3.5, 3, 1, rgb(220, 255, 160), false)
  p.outline(0.6)
  p.grain(rng, 0.12)
  return p.bitmap
}

function explosion(size: number, rng: Rng, heat: number): Bitmap {
  const p = Painter.create(size, size)
  const c = size / 2
  for (let i = 0; i < 18; i++) {
    const a = rng() * Math.PI * 2
    const r = rng() * c * 0.55
    const rad = c * (0.25 + rng() * 0.25)
    p.ball(
      c + Math.cos(a) * r,
      c + Math.sin(a) * r,
      rad,
      rad,
      mix(rgb(160, 30, 10), rgb(250, 120, 20), rng() * heat),
    )
  }
  p.ball(c, c, c * 0.35 * heat, c * 0.35 * heat, rgb(255, 230, 140), false)
  return p.bitmap
}

function smoke(size: number, rng: Rng, color: number, spark: boolean): Bitmap {
  const p = Painter.create(10, 10)
  for (let i = 0; i < 5; i++) p.ball(5 + (rng() - 0.5) * 3, 5 + (rng() - 0.5) * 3, size, size, color)
  if (spark) p.ball(5, 5, 1.5, 1.5, rgb(255, 240, 160), false)
  return p.bitmap
}

function droplets(n: number, rng: Rng): Bitmap {
  const p = Painter.create(10, 10)
  splat(p, rng, 5, 5, 3 + n, 3 + n, 4 + n * 2)
  return p.bitmap
}

function fireball(phase: number): Bitmap {
  const p = Painter.create(14, 14)
  p.ball(7, 7, 6.5, 6.5, phase ? rgb(240, 70, 20) : rgb(250, 110, 20), false)
  p.ball(7, 7, 4.5, 4.5, rgb(255, 170, 40), false)
  p.ball(7 - phase, 6, 2.5, 2.5, rgb(255, 250, 200), false)
  return p.bitmap
}

function items(rng: Rng): Record<ItemKind, Bitmap> {
  const medkit = Painter.create(24, 16)
  medkit.rect(0, 2, 24, 14, rgb(220, 220, 214))
  medkit.bevel(0, 2, 24, 14, rgb(255, 255, 255), rgb(130, 130, 124))
  medkit.rect(10, 4, 4, 10, rgb(210, 20, 20))
  medkit.rect(7, 7, 10, 4, rgb(210, 20, 20))
  medkit.rect(9, 0, 6, 2, rgb(90, 90, 90))

  const armor = Painter.create(28, 22)
  armor.ball(14, 12, 12, 10, rgb(50, 150, 60))
  armor.rect(10, 0, 8, 6, 0)
  armor.ball(14, 3, 4, 3, 0, false)
  for (let y = 8; y < 20; y += 4) armor.rect(6, y, 16, 1, rgb(30, 90, 36))
  armor.outline()

  const clip = Painter.create(8, 14)
  clip.rect(1, 3, 6, 11, rgb(60, 60, 64))
  clip.bevel(1, 3, 6, 11, rgb(110, 110, 116), rgb(30, 30, 30))
  clip.rect(2, 0, 4, 3, rgb(200, 160, 60))

  const shells = Painter.create(18, 10)
  for (let i = 0; i < 4; i++) {
    shells.rect(1 + i * 4, 0, 3, 7, rgb(190, 30, 24))
    shells.rect(1 + i * 4, 7, 3, 3, rgb(210, 170, 70))
    shells.rect(1 + i * 4, 0, 1, 7, rgb(240, 90, 80))
  }

  const shotgun = Painter.create(52, 12)
  shotgun.rect(0, 3, 34, 3, rgb(60, 60, 66))
  shotgun.rect(0, 3, 34, 1, rgb(130, 130, 140))
  shotgun.rect(12, 6, 12, 3, rgb(110, 70, 36))
  shotgun.rect(32, 3, 8, 5, rgb(50, 50, 54))
  shotgun.rect(38, 4, 14, 6, rgb(120, 76, 38))
  shotgun.rect(44, 8, 8, 4, rgb(100, 62, 30))
  shotgun.outline(0.6)

  const card = (c: number) => {
    const k = Painter.create(10, 14)
    k.rect(1, 1, 8, 12, c)
    k.bevel(1, 1, 8, 12, shade(c, 1.4), shade(c, 0.5))
    k.rect(2, 4, 6, 2, rgb(240, 240, 240))
    k.rect(3, 9, 4, 2, shade(c, 0.6))
    return k.bitmap
  }
  medkit.grain(rng, 0.06)
  return {
    health: medkit.bitmap,
    armor: armor.bitmap,
    clip: clip.bitmap,
    shells: shells.bitmap,
    shotgun: shotgun.bitmap,
    redKey: card(rgb(220, 30, 24)),
    blueKey: card(rgb(40, 80, 240)),
    yellowKey: card(rgb(240, 210, 30)),
  }
}

const SKIN = rgb(220, 160, 118)
const SLEEVE = rgb(70, 96, 50)

function fist(punch: boolean): Bitmap {
  const p = Painter.create(90, 70)
  if (punch) {
    p.limb(70, 70, 50, 34, 9, SLEEVE)
    p.ball(46, 30, 15, 13, SKIN)
    for (let i = 0; i < 4; i++) p.ball(36 + i * 7, 22, 4, 4, shade(SKIN, 1.05))
  } else {
    p.limb(84, 70, 70, 52, 8, SLEEVE)
    p.ball(64, 48, 13, 12, SKIN)
    for (let i = 0; i < 4; i++) p.ball(56 + i * 6, 40, 3.5, 3.5, shade(SKIN, 1.05))
  }
  p.outline(0.5)
  return p.bitmap
}

function muzzle(p: Painter, cx: number, cy: number, r: number) {
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    p.line(cx, cy, cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.2, rgb(255, 210, 90))
  }
  p.ball(cx, cy, r, r * 0.8, rgb(255, 190, 60), false)
  p.ball(cx, cy, r * 0.55, r * 0.45, rgb(255, 255, 220), false)
}

function pistol(firing: boolean): Bitmap {
  const p = Painter.create(64, 80)
  if (firing) muzzle(p, 32, 14, 11)
  p.rect(26, 28, 12, 30, rgb(58, 58, 64))
  p.rect(26, 28, 3, 30, rgb(110, 110, 120))
  p.rect(30, 26, 4, 3, rgb(30, 30, 30))
  p.limb(22, 80, 28, 58, 8, SKIN)
  p.limb(42, 80, 36, 60, 8, SKIN)
  p.ball(32, 60, 10, 8, SKIN)
  p.outline(0.5)
  return p.bitmap
}

function shotgunView(frame: 'ready' | 'fire' | 'pump'): Bitmap {
  const p = Painter.create(96, 88)
  const drop = frame === 'pump' ? 14 : 0
  if (frame === 'fire') muzzle(p, 48, 12, 14)
  const steel = rgb(54, 54, 60)
  p.rect(41, 24 + drop, 14, 40, steel)
  p.rect(41, 24 + drop, 4, 40, rgb(120, 120, 130))
  p.ball(48, 25 + drop, 4, 3, rgb(18, 18, 18), false)
  p.rect(38, 46 + drop + (frame === 'pump' ? 8 : 0), 20, 14, rgb(120, 76, 38))
  p.rect(38, 46 + drop + (frame === 'pump' ? 8 : 0), 20, 2, rgb(160, 110, 60))
  p.rect(36, 64 + drop, 24, 24, rgb(104, 64, 32))
  p.limb(24, 88, 40, 56 + drop + (frame === 'pump' ? 8 : 0), 8, SKIN)
  p.limb(70, 88, 58, 76 + drop, 9, SKIN)
  p.outline(0.5)
  return p.bitmap
}

const FACE_SKIN = rgb(214, 156, 112)

export type FaceExpression = 'look' | 'ouch' | 'grin' | 'dead'

/** The status bar face: `band` 0 is healthy and 4 is near death. */
function face(band: number, expression: FaceExpression, look: -1 | 0 | 1, rng: Rng): Bitmap {
  const p = Painter.create(24, 29)
  const skin = expression === 'dead' ? rgb(150, 120, 100) : shade(FACE_SKIN, 1 - band * 0.06)
  p.ball(12, 15, 10, 13, skin)
  p.rect(3, 2, 18, 5, rgb(110, 70, 34))
  p.ball(12, 4, 9, 4, rgb(110, 70, 34), false)
  p.rect(2, 13, 2, 5, shade(skin, 0.8))
  p.rect(20, 13, 2, 5, shade(skin, 0.8))
  const eyeY = 12
  if (expression === 'dead') {
    for (const ex of [8, 16]) {
      p.line(ex - 2, eyeY - 2, ex + 2, eyeY + 2, rgb(40, 0, 0))
      p.line(ex - 2, eyeY + 2, ex + 2, eyeY - 2, rgb(40, 0, 0))
    }
    p.rect(8, 21, 8, 2, rgb(60, 10, 10))
  } else {
    const wide = expression === 'ouch'
    for (const ex of [8, 16]) {
      p.rect(ex - 2, eyeY - (wide ? 2 : 1), 5, wide ? 4 : 3, rgb(240, 240, 240))
      p.rect(ex + look, eyeY - (wide ? 1 : 0), 1, 2, rgb(40, 60, 140))
      p.rect(ex - 2, eyeY - (wide ? 4 : 3), 5, 1, rgb(80, 50, 24))
    }
    p.rect(11, 14, 2, 4, shade(skin, 0.8))
    if (expression === 'ouch') p.ball(12, 22, 3, 3, rgb(70, 10, 10), false)
    else if (expression === 'grin') {
      p.rect(7, 20, 10, 3, rgb(250, 250, 240))
      p.rect(7, 23, 10, 1, rgb(90, 20, 20))
    } else p.rect(8, 21, 8, 1, rgb(110, 50, 40))
  }
  splat(p, rng, 12, 14, 9, 11, band * 5)
  p.outline(0.6)
  return p.bitmap
}

export interface SpriteSet {
  readonly trooper: Readonly<Record<Pose, Bitmap>> & { readonly death: readonly Bitmap[] }
  readonly demon: Readonly<Record<DemonPose, Bitmap>> & { readonly death: readonly Bitmap[] }
  readonly barrel: Bitmap
  readonly explosion: readonly Bitmap[]
  readonly items: Readonly<Record<ItemKind, Bitmap>>
  readonly fireball: readonly Bitmap[]
  readonly puff: readonly Bitmap[]
  readonly blood: readonly Bitmap[]
  readonly blast: readonly Bitmap[]
  readonly weapons: {
    readonly fist: readonly Bitmap[]
    readonly pistol: readonly Bitmap[]
    readonly shotgun: readonly Bitmap[]
  }
  /** `faces[band][expression]`, with the three looks under `look`. */
  readonly faces: readonly {
    readonly look: readonly Bitmap[]
    readonly ouch: Bitmap
    readonly grin: Bitmap
  }[]
  readonly deadFace: Bitmap
}

export function buildSprites(seed = 1995): SpriteSet {
  const rng = createRng(seed)
  const trooperPoses = {
    walkA: trooper('walkA', rng).bitmap,
    walkB: trooper('walkB', rng).bitmap,
    aim: trooper('aim', rng).bitmap,
    fire: trooper('fire', rng).bitmap,
    pain: trooper('pain', rng).bitmap,
  }
  const demonPoses = {
    walkA: demon('walkA', rng).bitmap,
    walkB: demon('walkB', rng).bitmap,
    raise: demon('raise', rng).bitmap,
    throw: demon('throw', rng).bitmap,
    pain: demon('pain', rng).bitmap,
  }
  return {
    trooper: { ...trooperPoses, death: deathFrames(trooper('walkA', rng), rng) },
    demon: { ...demonPoses, death: deathFrames(demon('walkA', rng), rng) },
    barrel: barrel(rng),
    explosion: [explosion(36, rng, 1), explosion(48, rng, 0.8), explosion(56, rng, 0.45)],
    items: items(rng),
    fireball: [fireball(0), fireball(1)],
    puff: [
      smoke(2.5, rng, rgb(200, 200, 190), true),
      smoke(3, rng, rgb(150, 150, 146), false),
      smoke(2, rng, rgb(110, 110, 106), false),
    ],
    blood: [droplets(0, rng), droplets(1, rng), droplets(2, rng)],
    blast: [explosion(24, rng, 1), explosion(28, rng, 0.7), explosion(30, rng, 0.35)],
    weapons: {
      fist: [fist(false), fist(true)],
      pistol: [pistol(false), pistol(true)],
      shotgun: [shotgunView('ready'), shotgunView('fire'), shotgunView('pump')],
    },
    faces: [0, 1, 2, 3, 4].map((band) => ({
      look: ([-1, 0, 1] as const).map((look) => face(band, 'look', look, createRng(seed + band))),
      ouch: face(band, 'ouch', 0, createRng(seed + band)),
      grin: face(band, 'grin', 0, createRng(seed + band)),
    })),
    deadFace: face(4, 'dead', 0, createRng(seed + 4)),
  }
}
