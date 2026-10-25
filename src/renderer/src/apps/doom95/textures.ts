import { mix, Painter, rgb, shade } from './art'
import { drawCentered } from './font'
import { TEX, TEXTURE_COUNT } from './map'
import { createRng, type Rng } from './rng'

export const TEX_SIZE = 64
export const LIGHT_LEVELS = 32

type Draw = (p: Painter, rng: Rng) => void

const noisy = (rng: Rng, c: number, amount: number) => shade(c, 1 + (rng() - 0.5) * amount)

const tech: Draw = (p, rng) => {
  p.rect(0, 0, 64, 64, () => noisy(rng, rgb(118, 118, 112), 0.12))
  for (const [x, y, w, h] of [
    [0, 0, 32, 24],
    [32, 0, 32, 24],
    [0, 24, 64, 16],
    [0, 40, 24, 24],
    [24, 40, 40, 24],
  ] as const) {
    p.bevel(x, y, w, h, rgb(170, 170, 160), rgb(58, 58, 54))
  }
  p.rect(4, 28, 56, 8, () => noisy(rng, rgb(46, 52, 46), 0.2))
  for (let x = 6; x < 58; x += 6) p.rect(x, 30, 3, 4, x % 12 === 0 ? rgb(60, 200, 70) : rgb(200, 60, 40))
  for (const [x, y] of [
    [3, 3],
    [28, 3],
    [35, 3],
    [60, 3],
    [3, 20],
    [60, 20],
    [27, 44],
    [60, 60],
  ] as const) {
    p.set(x, y, rgb(200, 200, 190))
    p.set(x + 1, y + 1, rgb(40, 40, 40))
  }
  for (let y = 46; y < 60; y += 3) p.rect(30, y, 28, 1, rgb(70, 70, 66))
}

const brick: Draw = (p, rng) => {
  p.rect(0, 0, 64, 64, () => noisy(rng, rgb(70, 62, 56), 0.2))
  for (let row = 0; row < 8; row++) {
    const offset = row % 2 ? 8 : 0
    for (let col = -1; col < 4; col++) {
      const base = mix(rgb(132, 58, 40), rgb(96, 44, 34), rng())
      const x = col * 16 + offset
      p.rect(x + 1, row * 8 + 1, 15, 7, () => noisy(rng, base, 0.22))
      p.rect(x + 1, row * 8 + 1, 15, 1, shade(base, 1.25))
      p.rect(x + 1, row * 8 + 7, 15, 1, shade(base, 0.7))
    }
  }
}

const metal: Draw = (p, rng) => {
  p.rect(0, 0, 64, 64, (x, y) =>
    noisy(rng, shade(rgb(84, 88, 96), 0.9 + 0.12 * Math.sin(x * 0.7 + y * 0.05)), 0.1),
  )
  p.bevel(0, 0, 64, 32, rgb(140, 146, 156), rgb(36, 38, 44))
  p.bevel(0, 32, 64, 32, rgb(140, 146, 156), rgb(36, 38, 44))
  for (const y of [4, 27, 36, 59])
    for (const x of [4, 20, 43, 59]) {
      p.ball(x, y, 1.6, 1.6, rgb(170, 176, 184))
    }
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * 60)
    p.rect(x, 8 + Math.floor(rng() * 40), 1, 6 + Math.floor(rng() * 10), rgb(110, 70, 40))
  }
}

const wood: Draw = (p, rng) => {
  const planks = [0, 11, 21, 33, 42, 54, 64]
  for (let i = 0; i < planks.length - 1; i++) {
    const x0 = planks[i] ?? 0
    const x1 = planks[i + 1] ?? 64
    const base = mix(rgb(120, 78, 40), rgb(92, 58, 30), rng())
    const phase = rng() * 10
    p.rect(x0, 0, x1 - x0, 64, (x, y) =>
      noisy(rng, shade(base, 0.85 + 0.2 * Math.sin(y * 0.35 + Math.sin(x * 1.3 + phase) * 2)), 0.08),
    )
    p.rect(x0, 0, 1, 64, rgb(40, 24, 12))
    p.rect(x0 + 1, 0, 1, 64, shade(base, 1.2))
  }
  for (const y of [6, 57]) for (let x = 3; x < 64; x += 11) p.set(x, y, rgb(30, 30, 30))
}

const stone: Draw = (p, rng) => {
  p.rect(0, 0, 64, 64, () => noisy(rng, rgb(74, 78, 70), 0.25))
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rng() * 64)
    const y = Math.floor(rng() * 64)
    p.ball(x, y, 5 + rng() * 6, 4 + rng() * 4, mix(rgb(100, 104, 94), rgb(70, 72, 64), rng()))
  }
  p.grain(rng, 0.2)
}

const exitSwitch =
  (on: boolean): Draw =>
  (p, rng) => {
    tech(p, rng)
    p.rect(20, 14, 24, 36, rgb(52, 52, 50))
    p.bevel(20, 14, 24, 36, rgb(30, 30, 30), rgb(150, 150, 140))
    p.rect(23, 17, 18, 8, rgb(20, 20, 20))
    drawCentered(p.bitmap, 'EXIT', 18, { color: rgb(230, 40, 30) }, 32)
    p.rect(29, 28, 6, 18, rgb(30, 30, 30))
    const knobY = on ? 40 : 30
    p.rect(30, on ? 34 : 30, 4, 10, rgb(150, 150, 150))
    p.ball(32, knobY, 3, 3, on ? rgb(60, 220, 60) : rgb(220, 50, 40))
  }

const door =
  (stripe: number | null): Draw =>
  (p, rng) => {
    p.rect(0, 0, 64, 64, (_, y) => noisy(rng, y % 16 < 2 ? rgb(70, 72, 78) : rgb(112, 114, 120), 0.08))
    for (let y = 0; y < 64; y += 16) p.rect(0, y + 2, 64, 1, rgb(150, 152, 160))
    p.bevel(0, 0, 64, 64, rgb(160, 160, 166), rgb(40, 40, 44))
    p.rect(30, 0, 4, 64, rgb(60, 62, 66))
    p.rect(31, 0, 1, 64, rgb(140, 142, 148))
    if (stripe !== null) {
      p.rect(0, 4, 64, 5, stripe)
      p.rect(0, 55, 64, 5, stripe)
      for (let i = 0; i < 9; i++) p.rect(32 - i, 24 + i, i * 2, 1, stripe)
      for (let i = 0; i < 9; i++) p.rect(32 - (8 - i), 33 + i, (8 - i) * 2, 1, stripe)
    }
  }

const jamb: Draw = (p, rng) => {
  p.rect(0, 0, 64, 64, (x) => noisy(rng, x % 16 < 8 ? rgb(66, 66, 70) : rgb(90, 90, 94), 0.1))
  for (let x = 0; x < 64; x += 8) p.rect(x, 0, 1, 64, rgb(40, 40, 44))
}

const floor: Draw = (p, rng) => {
  for (let ty = 0; ty < 4; ty++)
    for (let tx = 0; tx < 4; tx++) {
      const base = mix(rgb(92, 84, 70), rgb(76, 70, 60), rng())
      p.rect(tx * 16, ty * 16, 16, 16, () => noisy(rng, base, 0.18))
      p.rect(tx * 16, ty * 16, 16, 1, rgb(50, 46, 40))
      p.rect(tx * 16, ty * 16, 1, 16, rgb(50, 46, 40))
    }
}

const ceiling: Draw = (p, rng) => {
  p.rect(0, 0, 64, 64, () => noisy(rng, rgb(62, 62, 66), 0.15))
  for (let y = 0; y < 64; y += 32)
    for (let x = 0; x < 64; x += 32) p.bevel(x, y, 32, 32, rgb(96, 96, 100), rgb(40, 40, 44))
  p.rect(26, 26, 12, 12, rgb(176, 176, 160))
  p.bevel(25, 25, 14, 14, rgb(44, 44, 46), rgb(110, 110, 104))
}

const DRAW: Readonly<Record<number, Draw>> = {
  [TEX.tech]: tech,
  [TEX.brick]: brick,
  [TEX.metal]: metal,
  [TEX.wood]: wood,
  [TEX.stone]: stone,
  [TEX.exit]: exitSwitch(false),
  [TEX.exitOn]: exitSwitch(true),
  [TEX.door]: door(null),
  [TEX.doorRed]: door(rgb(210, 30, 24)),
  [TEX.doorBlue]: door(rgb(40, 70, 230)),
  [TEX.doorYellow]: door(rgb(230, 200, 30)),
  [TEX.jamb]: jamb,
  [TEX.floor]: floor,
  [TEX.ceiling]: ceiling,
}

/** Brightness of each light level, from near black to full. */
export const LIGHT = Array.from(
  { length: LIGHT_LEVELS },
  (_, i) => 0.06 + 0.94 * (i / (LIGHT_LEVELS - 1)) ** 1.25,
)

/**
 * Every texture at every light level, column-major so a wall column is a contiguous run. Index as
 * `shaded[tex][level][u * 64 + v]`.
 */
export type ShadedTextures = readonly (readonly Uint32Array[])[]

export function buildTextures(seed = 95): ShadedTextures {
  const out: Uint32Array[][] = []
  for (let tex = 0; tex < TEXTURE_COUNT; tex++) {
    const draw = DRAW[tex]
    const p = Painter.create(TEX_SIZE, TEX_SIZE)
    if (draw) draw(p, createRng(seed + tex * 101))
    const base = new Uint32Array(TEX_SIZE * TEX_SIZE)
    for (let u = 0; u < TEX_SIZE; u++) for (let v = 0; v < TEX_SIZE; v++) base[u * TEX_SIZE + v] = p.get(u, v)
    out.push(LIGHT.map((f) => base.map((c) => shade(c, f))))
  }
  return out
}
