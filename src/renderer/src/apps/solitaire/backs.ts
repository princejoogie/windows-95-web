import { cardFrame, type Pixels } from './pixels'

/**
 * The twelve SOL.EXE card backs. Each design fills the panel inside a 1px black border inset from the
 * card edge. The four animated backs take a frame step from 0 to 3.
 */
export const BACKS = [
  'Blue weave',
  'Red diamonds',
  'Blue plaid',
  'Robot',
  'Roses',
  'Ivy',
  'Tropical fish',
  'Shell',
  'Castle',
  'Beach',
  'Poker hand',
  'Sun',
] as const
export type Back = (typeof BACKS)[number]
export const ANIMATED_BACKS: readonly Back[] = ['Robot', 'Castle', 'Poker hand', 'Sun']

const PANEL = { x: 5, y: 5, width: 61, height: 86 } as const
const RIGHT = PANEL.x + PANEL.width
const BOTTOM = PANEL.y + PANEL.height

function panel(fill: string): Pixels {
  const p = cardFrame()
  p.rect(PANEL.x - 1, PANEL.y - 1, PANEL.width + 2, PANEL.height + 2, 'k')
  p.rect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, fill)
  return p
}
function each(p: Pixels, paint: (x: number, y: number) => string | undefined) {
  for (let y = PANEL.y; y < BOTTOM; y++)
    for (let x = PANEL.x; x < RIGHT; x++) {
      const color = paint(x - PANEL.x, y - PANEL.y)
      if (color) p.dot(x, y, color)
    }
}
function dither(p: Pixels, x: number, y: number, width: number, height: number, a: string, b: string) {
  for (let dy = 0; dy < height; dy++)
    for (let dx = 0; dx < width; dx++) p.dot(x + dx, y + dy, (dx + dy) % 2 ? b : a)
}
function ring(p: Pixels, cx: number, cy: number, rx: number, ry: number, color: string) {
  p.oval(cx, cy, rx, ry, color)
}

const blueWeave = (p: Pixels) =>
  each(p, (x, y) => {
    const a = (x + y) % 6
    const b = (x - y + 600) % 6
    if (a === 0 || b === 0) return 'w'
    if (a === 1 || b === 1) return 'c'
    return 'B'
  })
const redDiamonds = (p: Pixels) =>
  each(p, (x, y) => {
    const d = Math.abs((x % 10) - 5) + Math.abs((y % 10) - 5)
    if (d === 5) return 'w'
    if (d < 2) return 'y'
    if (d < 5) return 'r'
    return 'R'
  })
const bluePlaid = (p: Pixels) =>
  each(p, (x, y) => {
    const h = y % 12 < 3
    const v = x % 12 < 3
    if (h && v) return 'w'
    if (h || v) return (x + y) % 2 ? 'b' : 'w'
    if (y % 12 === 7 || x % 12 === 7) return 'b'
    return 'B'
  })

const ROBOT_HEAD = [
  '........kkkkkkkkkkkkkkkkkkkkk........',
  '.......kssssssssssssssssssssk........',
  '......kssssssssssssssssssssssk.......',
  '.....kssskkkkkkksssskkkkkkksssk......',
  '.....ksskwwwwwwwkssskwwwwwwwkssk.....',
  '.....ksskwwkkkwwkssskwwkkkwwkssk.....',
  '.....ksskwwkkkwwkssskwwkkkwwkssk.....',
  '.....ksskwwwwwwwkssskwwwwwwwkssk.....',
  '.....kssskkkkkkksssskkkkkkksssk......',
  '.....kssssssssssssssssssssssssk......',
  '.....kssskkkkkkkkkkkkkkkkkksssk......',
  '.....ksskwkwkwkwkwkwkwkwkwkkssk......',
  '.....ksskkkkkkkkkkkkkkkkkkkkssk......',
  '.....kssssssssssssssssssssssssk......',
  '......kkkkkkkkkkkkkkkkkkkkkkkk.......',
]
function robot(p: Pixels, step: number) {
  dither(p, PANEL.x, PANEL.y, PANEL.width, PANEL.height, 'y', 'w')
  p.rect(34, 6, 3, 6, 'k')
  p.rect(35, 7, 1, 5, 's')
  p.stamp(['.r.', 'rrr', '.r.'], 34, 5, step % 2 ? 'r' : 'R')
  p.stamp(ROBOT_HEAD, 17, 11)
  p.rect(32, 26, 7, 4, 'k')
  p.rect(33, 26, 5, 4, 'g')
  p.rect(20, 30, 31, 34, 'k')
  p.rect(21, 31, 29, 32, 'g')
  p.rect(23, 33, 25, 28, 's')
  p.rect(26, 36, 8, 8, 'k')
  p.rect(37, 36, 8, 8, 'k')
  p.rect(27, 37, 6, 6, 'w')
  p.rect(38, 37, 6, 6, 'w')
  const needle: readonly (readonly [number, number])[] = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0],
  ]
  const [nx, ny] = needle[step % 4] ?? [0, -2]
  p.line(30, 40, 30 + nx, 40 + ny, 'r')
  p.line(41, 40, 41 - nx, 40 - ny, 'r')
  p.rect(26, 47, 19, 10, 'k')
  p.rect(27, 48, 17, 8, 'g')
  for (let i = 0; i < 4; i++) p.rect(28 + i * 4, 49, 3, 2, ['r', 'l', 'y', 'c'][(i + step) % 4] ?? 'r')
  for (let i = 0; i < 4; i++) p.rect(28 + i * 4, 53, 3, 2, ['c', 'y', 'l', 'r'][(i + step) % 4] ?? 'r')
  p.rect(11, 33, 9, 22, 'k')
  p.rect(12, 34, 7, 20, 's')
  p.rect(51, 33, 9, 22, 'k')
  p.rect(52, 34, 7, 20, 's')
  p.rect(10, 55, 11, 7, 'k')
  p.rect(11, 56, 9, 5, 'g')
  p.rect(50, 55, 11, 7, 'k')
  p.rect(51, 56, 9, 5, 'g')
  p.rect(23, 64, 10, 20, 'k')
  p.rect(24, 65, 8, 18, 's')
  p.rect(38, 64, 10, 20, 'k')
  p.rect(39, 65, 8, 18, 's')
  p.rect(20, 83, 14, 5, 'k')
  p.rect(21, 84, 12, 3, 'g')
  p.rect(37, 83, 14, 5, 'k')
  p.rect(38, 84, 12, 3, 'g')
}

const ROSE = [
  '....RRR....',
  '..RRrrrRR..',
  '.RrrwwrrrR.',
  '.RrwRRwrrR.',
  'RrrRrrRrrrR',
  'RrrRrRRrrrR',
  'RrrrRRrrrrR',
  '.RrrrrrrrR.',
  '.RRrrrrrRR.',
  '...RRRRR...',
]
function roses(p: Pixels) {
  p.rect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 'w')
  for (let row = 0; row < 4; row++)
    for (let col = 0; col < 3; col++) {
      const x = 9 + col * 20 + (row % 2) * 6
      const y = 8 + row * 21
      p.line(x + 5, y + 10, x + 2, y + 17, 'L')
      p.stamp(['..LL', '.LlL', 'LlL.', 'LL..'], x + 5, y + 11)
      p.stamp(['LL..', 'LlL.', '.LlL', '..LL'], x - 2, y + 12)
      p.stamp(ROSE, x, y)
    }
}

const IVY_LEAF = [
  '....L....',
  '...LlL...',
  '.LLLlLLL.',
  'LlllllllL',
  '.LllllL..',
  '..LlllL..',
  '...LlL...',
  '....L....',
]
function ivy(p: Pixels) {
  p.rect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 'k')
  for (let x = 8; x < RIGHT; x += 20) p.line(x, PANEL.y, x + 12, BOTTOM - 1, 'Y')
  for (let row = 0; row < 7; row++)
    for (let col = 0; col < 3; col++) {
      const x = 7 + col * 20 + (row % 2) * 8
      const y = 7 + row * 12
      p.stamp(IVY_LEAF, x, y)
    }
}

const FISH = [
  '.............kkkkk............',
  '...........kkyyyyykk..........',
  'k........kkyyyyyyyyykk....kk..',
  'kk.....kkyyyrrryyyrrryk..kyk..',
  'kkk..kkyyyyyrrryyyrrryykkyyk..',
  'kyykkyyyyyyyrrryyyrrryyyyyyyk.',
  'kyyyyyyyyyyyrrryyyrrryyykwkyk.',
  'kyyyyyyyyyyyrrryyyrrryyykkkyyk',
  'kyyyyyyyyyyyrrryyyrrryyyyyyyk.',
  'kyykkyyyyyyyrrryyyrrryyyyyyyk.',
  'kkk..kkyyyyyrrryyyrrryyyyykk..',
  'kk.....kkyyyrrryyyrrryyykk....',
  'k........kkyyyyyyyyyykk.......',
  '...........kkyyyyykk..........',
  '.............kkkkk............',
]
function tropicalFish(p: Pixels) {
  p.rect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 'b')
  for (let x = 9; x < RIGHT; x += 10) {
    p.line(x, BOTTOM - 1, x - 2 + (x % 3), 62, 'L')
    p.line(x + 1, BOTTOM - 1, x + 3, 66, 'l')
    p.stamp(['L.', 'LL', '.L'], x - 2, 70 + (x % 7))
  }
  p.stamp(FISH, 6, 28, undefined, false, 2)
  p.stamp(['.kkk.', 'k...k', 'k...k', '.kkk.'], 50, 16, 'c')
  p.stamp(['.kk.', 'k..k', '.kk.'], 54, 10, 'c')
  p.stamp(['kk', 'kk'], 57, 5, 'c')
  p.stamp(['..kkk..', '.k...k.', 'k.....k', 'k.....k', '.k...k.', '..kkk..'], 8, 12, 'c')
}

function shell(p: Pixels) {
  p.rect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 'C')
  for (let y = PANEL.y + 6; y < BOTTOM; y += 14)
    for (let x = PANEL.x + (y % 28 ? 0 : 7); x < RIGHT; x += 14) p.stamp(['..cc..', 'cc..cc'], x, y)
  const hinge = { x: 35, y: 76 }
  const spread = Math.PI * 0.42
  const ridges = 11
  each(p, (px, py) => {
    const dx = px + PANEL.x - hinge.x
    const dy = hinge.y - (py + PANEL.y)
    if (dy < 0) return undefined
    const angle = Math.atan2(dx, dy)
    if (Math.abs(angle) > spread) return undefined
    const band = ((angle + spread) / (2 * spread)) * ridges
    const edge = 48 - 3 * Math.abs(Math.sin(band * Math.PI))
    const radius = Math.sqrt(dx * dx + dy * dy)
    if (radius > edge) return undefined
    if (radius > edge - 1.5) return 'k'
    const ridge = Math.abs(band - Math.round(band)) < 0.08
    return ridge ? 'g' : Math.floor(band) % 2 ? 's' : 'w'
  })
  p.rect(hinge.x - 7, hinge.y - 1, 15, 6, 'k')
  p.rect(hinge.x - 6, hinge.y, 13, 4, 's')
  p.stamp(['..r..', '.rrr.', 'rrrrr', '.rrr.', 'r.r.r'], 9, 80)
}

const BAT = [
  ['k.....k', 'kk...kk', 'kkkkkkk', '.kk.kk.'],
  ['.k...k.', 'kkk.kkk', '.kkkkk.', '..k.k..'],
]
function castle(p: Pixels, step: number) {
  p.rect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 'B')
  for (const [x, y] of [
    [9, 9],
    [20, 7],
    [31, 12],
    [44, 8],
    [57, 11],
    [12, 24],
    [60, 26],
    [26, 20],
  ])
    p.dot(x ?? 0, y ?? 0, 'w')
  p.oval(50, 20, 8, 8, 'y')
  p.oval(54, 18, 8, 8, 'B')
  p.rect(PANEL.x, 76, PANEL.width, 15, 'L')
  p.rect(PANEL.x, 76, PANEL.width, 1, 'l')
  for (let x = PANEL.x; x < RIGHT; x += 5) p.rect(x + (x % 3), 80 + (x % 4), 2, 1, 'l')
  for (const [x, w, top] of [
    [10, 11, 32],
    [50, 11, 32],
    [21, 29, 42],
  ]) {
    const left = x ?? 0
    const width = w ?? 0
    const y = top ?? 0
    p.rect(left, y, width, 77 - y, 'g')
    for (let bx = left; bx < left + width; bx += 4) p.rect(bx, y - 4, 2, 4, 'g')
    p.rect(left, y, width, 1, 's')
  }
  p.rect(30, 30, 11, 12, 'g')
  for (let bx = 30; bx < 41; bx += 4) p.rect(bx, 26, 2, 4, 'g')
  for (const [x, y] of [
    [13, 40],
    [13, 52],
    [53, 40],
    [53, 52],
    [34, 36],
    [26, 50],
    [41, 50],
  ])
    p.rect(x ?? 0, y ?? 0, 3, 5, 'y')
  p.rect(32, 60, 7, 17, 'k')
  p.oval(35, 61, 3, 3, 'k')
  p.rect(33, 73, 5, 4, 'Y')
  const bat = BAT[step % 2] ?? []
  p.stamp(bat, 10 + step * 11, 14 + (step % 2) * 3)
  p.stamp(BAT[(step + 1) % 2] ?? [], 48 - step * 6, 44 - step * 2)
}

function palm(p: Pixels, x: number, base: number, height: number) {
  for (let i = 0; i < height; i++) {
    const dx = Math.round((i * i) / (height * 6))
    p.rect(x + dx, base - i, 3, 1, i % 4 === 0 ? 'k' : 'Y')
  }
  const top = base - height
  const tip = x + Math.round((height * height) / (height * 6)) + 1
  const fronds: readonly (readonly [number, number])[] = [
    [-16, 2],
    [-13, -6],
    [-5, -10],
    [5, -10],
    [13, -6],
    [16, 2],
  ]
  for (const [dx, dy] of fronds) {
    p.line(tip, top, tip + dx, top + dy, 'L')
    p.line(tip, top + 1, tip + dx, top + dy + 1, 'l')
    p.line(tip, top + 2, tip + Math.round(dx * 0.6), top + dy + 6, 'L')
  }
  p.stamp(['Y.Y', '.Y.'], tip - 1, top + 3)
}
function beach(p: Pixels) {
  p.rect(PANEL.x, PANEL.y, PANEL.width, 40, 'c')
  p.oval(52, 17, 7, 7, 'y')
  p.rect(PANEL.x, 45, PANEL.width, 22, 'b')
  for (let y = 48; y < 66; y += 5)
    for (let x = PANEL.x + (y % 10); x < RIGHT; x += 12) p.rect(x, y, 5, 1, 'w')
  p.rect(PANEL.x, 67, PANEL.width, BOTTOM - 67, 'y')
  dither(p, PANEL.x, 67, PANEL.width, 3, 'y', 'w')
  for (const [x, y] of [
    [12, 80],
    [40, 85],
    [56, 75],
  ])
    p.dot(x ?? 0, y ?? 0, 'Y')
  palm(p, 14, 86, 36)
  p.oval(50, 82, 6, 6, 'r')
  p.oval(50, 82, 6, 6, 'r')
  p.stamp(['..w..', '.www.', 'wwwww', '.www.', '..w..'], 48, 80)
  ring(p, 48, 80, 2, 2, 'w')
  p.stamp(['...k', '..kkk', '.kkkkk', 'kkkkkkk'], 23, 38, 'w')
  p.stamp(['..k', '.kkk', 'kkkkk'], 38, 34, 'w')
}

const SLEEVE_CARD = ['kkkkkkkkkk', 'kwwwwwwwwk', 'kwrwwwwwwk', 'kwwwwwwwwk', 'kwwwwrwwwk', 'kwwwrrrwwk']
function pokerHand(p: Pixels, step: number) {
  p.rect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 'L')
  const fan: readonly (readonly [number, number, string, readonly string[]])[] = [
    [14, 26, 'k', ['..k..', '.kkk.', 'kkkkk', 'kk.kk', '..k..']],
    [24, 20, 'r', ['.k.k.', 'kkkkk', 'kkkkk', '.kkk.', '..k..']],
    [34, 16, 'k', ['..k..', '.kkk.', 'kkkkk', '.kkk.', '..k..']],
    [44, 20, 'r', ['..k..', '.kkk.', 'kkkkk', '.kkk.', '..k..']],
  ]
  for (const [x, y, color, pip] of fan) {
    p.rect(x, y, 14, 22, 'k')
    p.rect(x + 1, y + 1, 12, 20, 'w')
    p.stamp(pip, x + 2, y + 2, color)
  }
  p.rect(8, 56, 24, 35, 'k')
  p.rect(9, 57, 22, 33, 'B')
  p.rect(9, 57, 22, 3, 'w')
  p.rect(9, 60, 22, 1, 'k')
  const slide = step % 4 === 0 ? 0 : step * 4
  p.stamp(SLEEVE_CARD, 20 - slide, 61 - slide * 2)
  p.rect(28, 36, 22, 24, 'k')
  p.rect(29, 37, 20, 22, 'w')
  for (let finger = 0; finger < 4; finger++) {
    p.rect(30 + finger * 5, 30 - finger, 5, 10 + finger, 'k')
    p.rect(31 + finger * 5, 31 - finger, 3, 9 + finger, 'w')
  }
  p.rect(24, 44, 6, 10, 'k')
  p.rect(25, 45, 5, 8, 'w')
}

function sun(p: Pixels, step: number) {
  p.rect(PANEL.x, PANEL.y, PANEL.width, PANEL.height, 'c')
  const cx = 35
  const cy = 46
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI) / 8
    const x = Math.round(cx + Math.cos(angle) * 30)
    const y = Math.round(cy + Math.sin(angle) * 40)
    p.line(cx, cy, x, y, 'y')
    p.line(cx + 1, cy, x + 1, y, 'y')
  }
  p.oval(cx, cy, 22, 24, 'k')
  p.oval(cx, cy, 21, 23, 'y')
  p.rect(16, 36, 16, 10, 'k')
  p.rect(39, 36, 16, 10, 'k')
  p.rect(32, 38, 7, 2, 'k')
  p.rect(15, 39, 1, 2, 'k')
  p.rect(55, 39, 1, 2, 'k')
  p.rect(19, 38, 5, 1, 'w')
  p.rect(42, 38, 5, 1, 'w')
  p.rect(30, 50, 2, 3, 'Y')
  p.line(24, 57, 29, 62, 'k')
  p.line(29, 62, 41, 62, 'k')
  p.line(41, 62, 46, 57, 'k')
  p.rect(29, 60, 13, 2, 'k')
  if (step) {
    const length = step * 3
    p.rect(32, 62, 7, length, 'r')
    p.rect(31, 62, 1, length - 1, 'k')
    p.rect(39, 62, 1, length - 1, 'k')
    p.rect(32, 62 + length, 7, 1, 'k')
    p.rect(35, 63, 1, length - 1, 'R')
  }
}

export function drawBack(back: Back, step: number): Pixels {
  const p = panel('B')
  switch (back) {
    case 'Blue weave':
      blueWeave(p)
      break
    case 'Red diamonds':
      redDiamonds(p)
      break
    case 'Blue plaid':
      bluePlaid(p)
      break
    case 'Robot':
      robot(p, step)
      break
    case 'Roses':
      roses(p)
      break
    case 'Ivy':
      ivy(p)
      break
    case 'Tropical fish':
      tropicalFish(p)
      break
    case 'Shell':
      shell(p)
      break
    case 'Castle':
      castle(p, step)
      break
    case 'Beach':
      beach(p)
      break
    case 'Poker hand':
      pokerHand(p, step)
      break
    case 'Sun':
      sun(p, step)
      break
  }
  return p
}
