import { type Bitmap, shade } from './art'

/** A 5x7 capitals font, drawn here so nothing is borrowed. Each glyph is seven rows of five bits. */
const GLYPHS: Readonly<Record<string, string>> = {
  A: '01110 10001 10001 11111 10001 10001 10001',
  B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11100 10010 10001 10001 10001 10010 11100',
  E: '11111 10000 10000 11110 10000 10000 11111',
  F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110',
  J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 10001 11001 10101 10011 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010',
  X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 10001 01010 00100 00100 00100',
  Z: '11111 00001 00010 00100 01000 10000 11111',
  '0': '01110 10001 10011 10101 11001 10001 01110',
  '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111',
  '3': '11111 00010 00100 00010 00001 10001 01110',
  '4': '00010 00110 01010 10010 11111 00010 00010',
  '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110',
  '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110',
  '9': '01110 10001 10001 01111 00001 00010 01100',
  '.': '00000 00000 00000 00000 00000 01100 01100',
  ',': '00000 00000 00000 00000 01100 00100 01000',
  ':': '00000 01100 01100 00000 01100 01100 00000',
  '!': '00100 00100 00100 00100 00100 00000 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100',
  '%': '11000 11001 00010 00100 01000 10011 00011',
  '-': '00000 00000 00000 11111 00000 00000 00000',
  "'": '00100 00100 01000 00000 00000 00000 00000',
  '/': '00000 00001 00010 00100 01000 10000 00000',
  '(': '00010 00100 01000 01000 01000 00100 00010',
  ')': '01000 00100 00010 00010 00010 00100 01000',
  '+': '00000 00100 00100 11111 00100 00100 00000',
  '>': '01000 00100 00010 00001 00010 00100 01000',
  '<': '00010 00100 01000 10000 01000 00100 00010',
}

const ROWS = new Map(
  Object.entries(GLYPHS).map(([ch, bits]) => [ch, bits.split(' ').map((row) => Number.parseInt(row, 2))]),
)

const GLYPH_W = 5

export const textWidth = (text: string, scale = 1): number =>
  Math.max(0, text.length * (GLYPH_W + 1) * scale - scale)

export interface TextStyle {
  readonly color: number
  readonly scale?: number
  /** A drop shadow one pixel down and right, like Doom's menu text. */
  readonly shadow?: boolean
  /** Darkens lower rows of each glyph, for the big lettering. */
  readonly gradient?: boolean
}

export function drawText(target: Bitmap, text: string, x: number, y: number, style: TextStyle): void {
  const scale = style.scale ?? 1
  if (style.shadow) drawText(target, text, x + scale, y + scale, { color: 0xff000000, scale })
  const { width, height, pixels } = target
  let cx = Math.round(x)
  for (const ch of text.toUpperCase()) {
    const rows = ROWS.get(ch)
    if (rows) {
      rows.forEach((bits, row) => {
        const color = style.gradient ? shade(style.color, 1.1 - row * 0.09) : style.color
        for (let col = 0; col < GLYPH_W; col++) {
          if (!(bits & (1 << (GLYPH_W - 1 - col)))) continue
          for (let sy = 0; sy < scale; sy++) {
            const py = Math.round(y) + row * scale + sy
            if (py < 0 || py >= height) continue
            for (let sx = 0; sx < scale; sx++) {
              const px = cx + col * scale + sx
              if (px >= 0 && px < width) pixels[py * width + px] = color
            }
          }
        }
      })
    }
    cx += (GLYPH_W + 1) * scale
  }
}

export function drawCentered(
  target: Bitmap,
  text: string,
  y: number,
  style: TextStyle,
  cx = target.width / 2,
): void {
  drawText(target, text, Math.round(cx - textWidth(text, style.scale ?? 1) / 2), y, style)
}
