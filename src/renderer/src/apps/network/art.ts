import { small } from '../../icons/art'
import { pixelArt } from '../../icons/pixel'

type Sprite = readonly string[]

/** Lays sprites onto a transparent square; later sprites draw over earlier ones. */
function compose(size: number, layers: readonly (readonly [Sprite, number, number])[]): string[] {
  const grid = Array.from({ length: size }, () => Array<string>(size).fill('.'))
  for (const [sprite, left, top] of layers) {
    sprite.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const pixel = row[x]
        const line = grid[top + y]
        if (pixel && pixel !== '.' && line && left + x < size) line[left + x] = pixel
      }
    })
  }
  return grid.map((row) => row.join(''))
}

const line = (length: number, vertical = false): Sprite =>
  vertical ? Array.from({ length }, () => 'k') : ['k'.repeat(length)]

/** The 16x16 My Computer machine, trimmed to its 14 drawn rows. */
const computer: Sprite = small.myComputer.slice(1, 15)

const smallMonitor: Sprite = [
  'kkkkkkk',
  'kwwwwgk',
  'kwCCCgk',
  'kwCCCgk',
  'kgggggk',
  'kkkkkkk',
  '..kgk..',
  '.kkkkk.',
]

/** Two computers on the cable behind a third: the Windows 95 Network Neighborhood picture. */
export const networkIcon = pixelArt(
  compose(32, [
    [line(4, true), 7, 13],
    [line(4, true), 23, 13],
    [line(17), 7, 16],
    [line(3, true), 15, 16],
    [computer, 0, 0],
    [computer, 16, 0],
    [computer, 8, 18],
  ]),
)

export const networkSmallIcon = pixelArt(
  compose(16, [
    [line(6, true), 3, 7],
    [line(6, true), 12, 7],
    [line(10), 3, 11],
    [smallMonitor, 0, 0],
    [smallMonitor, 9, 0],
    [smallMonitor, 4, 8],
  ]),
)

/** A globe of blue sea and green land, for Entire Network. */
function globe(size: number): string[] {
  const center = (size - 1) / 2
  const radius = size / 2 - 1
  const land = [
    { x: 0.32, y: 0.3, rx: 0.16, ry: 0.12 },
    { x: 0.42, y: 0.62, rx: 0.1, ry: 0.2 },
    { x: 0.72, y: 0.36, rx: 0.14, ry: 0.1 },
    { x: 0.7, y: 0.66, rx: 0.08, ry: 0.08 },
  ]
  return Array.from({ length: size }, (_, y) =>
    Array.from({ length: size }, (_, x) => {
      const distance = Math.hypot(x - center, y - center)
      if (distance > radius + 0.5) return '.'
      if (distance > radius - 0.5) return 'k'
      const u = x / size
      const v = y / size
      const ground = land.some((blob) => ((u - blob.x) / blob.rx) ** 2 + ((v - blob.y) / blob.ry) ** 2 <= 1)
      const lit = x + y < size * 0.7
      if (ground) return lit ? 'l' : 'L'
      return lit ? 'b' : 'B'
    }).join(''),
  )
}

export const entireNetworkIcon = pixelArt(globe(32))
export const entireNetworkSmallIcon = pixelArt(globe(16))
