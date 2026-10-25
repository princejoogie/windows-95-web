import { hex, rgb } from './bitmap'

/** Hue, saturation, and luminosity on the Windows color dialog's 0 to 240 scales (hue stops at 239). */
export interface Hsl {
  hue: number
  sat: number
  lum: number
}

export function toHsl(color: string): Hsl {
  const [r, g, b] = rgb(color).map((channel) => channel / 255) as [number, number, number]
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    lum = (max + min) / 2
  if (max === min) return { hue: 160, sat: 0, lum: Math.round(lum * 240) }
  const delta = max - min
  const sat = lum > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  const hue =
    max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  return { hue: Math.round((hue / 6) * 240) % 240, sat: Math.round(sat * 240), lum: Math.round(lum * 240) }
}

export function fromHsl({ hue, sat, lum }: Hsl): string {
  const h = hue / 240,
    s = sat / 240,
    l = lum / 240
  if (!s) return hex([l * 255, l * 255, l * 255])
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s,
    p = 2 * l - q
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (u < 1 / 6) return p + (q - p) * 6 * u
    if (u < 1 / 2) return q
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6
    return p
  }
  return hex([channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255])
}

/** The 48 basic colors of the Windows color dialog, row by row. */
export const basicColors = [
  '#ff8080',
  '#ffff80',
  '#80ff80',
  '#00ff80',
  '#80ffff',
  '#0080ff',
  '#ff80c0',
  '#ff80ff',
  '#ff0000',
  '#ffff00',
  '#80ff00',
  '#00ff40',
  '#00ffff',
  '#0080c0',
  '#8080c0',
  '#ff00ff',
  '#804040',
  '#ff8040',
  '#00ff00',
  '#008080',
  '#004080',
  '#8080ff',
  '#800040',
  '#ff0080',
  '#800000',
  '#ff8000',
  '#008000',
  '#008040',
  '#0000ff',
  '#0000a0',
  '#800080',
  '#8000ff',
  '#400000',
  '#804000',
  '#004000',
  '#004040',
  '#000080',
  '#000040',
  '#400040',
  '#400080',
  '#000000',
  '#808000',
  '#808040',
  '#808080',
  '#408080',
  '#c0c0c0',
  '#400040',
  '#ffffff',
]

/** Get Colors and Save Colors use the text palette format JASC-PAL. */
export function formatPalette(colors: readonly string[]): string {
  return ['JASC-PAL', '0100', String(colors.length), ...colors.map((color) => rgb(color).join(' '))].join(
    '\r\n',
  )
}

export function parsePalette(content: string): string[] | null {
  const lines = content.split(/\r?\n/).map((line) => line.trim())
  if (lines[0] !== 'JASC-PAL') return null
  const count = Number(lines[2])
  if (!Number.isInteger(count) || count < 1) return null
  const colors: string[] = []
  for (const line of lines.slice(3, 3 + count)) {
    const channels = line.split(/\s+/).map(Number)
    if (channels.length !== 3 || channels.some((c) => !Number.isInteger(c) || c < 0 || c > 255)) return null
    colors.push(hex(channels))
  }
  return colors.length === count ? colors : null
}
