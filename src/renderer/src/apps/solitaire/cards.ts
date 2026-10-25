import { pixelArt } from '../../icons/pixel'
import { type Card, SUITS, type Suit } from './game'
import { cardFrame, Pixels } from './pixels'

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
const cache = new Map<string, string>()
function cached(key: string, draw: () => Pixels): string {
  const previous = cache.get(key)
  if (previous) return previous
  const image = draw().image()
  cache.set(key, image)
  return image
}

const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  A: ['...k...', '..kkk..', '..k.k..', '.k...k.', '.k...k.', '.kkkkk.', '.k...k.', '.k...k.', 'kk...kk'],
  '2': ['.kkk.', 'k...k', '....k', '...k.', '..k..', '.k...', 'kkkkk'],
  '3': ['kkkk.', '....k', '....k', '.kkk.', '....k', '....k', 'kkkk.'],
  '4': ['...k.', '..kk.', '.k.k.', 'k..k.', 'kkkkk', '...k.', '...k.'],
  '5': ['kkkkk', 'k....', 'k....', 'kkkk.', '....k', '....k', 'kkkk.'],
  '6': ['..kk.', '.k...', 'k....', 'kkkk.', 'k...k', 'k...k', '.kkk.'],
  '7': ['kkkkk', '....k', '...k.', '..k..', '.k...', '.k...', '.k...'],
  '8': ['.kkk.', 'k...k', 'k...k', '.kkk.', 'k...k', 'k...k', '.kkk.'],
  '9': ['.kkk.', 'k...k', 'k...k', '.kkkk', '....k', '...k.', '.kk..'],
  '10': ['.k..kkk.', 'kk.k...k', '.k.k...k', '.k.k...k', '.k.k...k', '.k.k...k', 'kkkkkkk.'],
  J: ['..kkk', '...k.', '...k.', '...k.', 'k..k.', 'k..k.', '.kk..'],
  Q: ['.kkk.', 'k...k', 'k...k', 'k...k', 'k.k.k', 'k..k.', '.kk.k'],
  K: ['k...k', 'k..k.', 'k.k..', 'kk...', 'k.k..', 'k..k.', 'k...k'],
}
const PIPS: Record<Suit, readonly string[]> = {
  hearts: [
    '.kkk...kkk.',
    'kkkkk.kkkkk',
    'kkkkkkkkkkk',
    'kkkkkkkkkkk',
    'kkkkkkkkkkk',
    '.kkkkkkkkk.',
    '..kkkkkkk..',
    '...kkkkk...',
    '....kkk....',
    '.....k.....',
    '...........',
    '...........',
    '...........',
  ],
  diamonds: [
    '.....k.....',
    '....kkk....',
    '....kkk....',
    '...kkkkk...',
    '..kkkkkkk..',
    '.kkkkkkkkk.',
    'kkkkkkkkkkk',
    '.kkkkkkkkk.',
    '..kkkkkkk..',
    '...kkkkk...',
    '....kkk....',
    '....kkk....',
    '.....k.....',
  ],
  clubs: [
    '....kkk....',
    '...kkkkk...',
    '...kkkkk...',
    '....kkk....',
    '.kkk.k.kkk.',
    'kkkkkkkkkkk',
    'kkkkkkkkkkk',
    'kkkkkkkkkkk',
    '.kkk.k.kkk.',
    '.....k.....',
    '....kkk....',
    '...kkkkk...',
    '...........',
  ],
  spades: [
    '.....k.....',
    '....kkk....',
    '...kkkkk...',
    '..kkkkkkk..',
    '.kkkkkkkkk.',
    'kkkkkkkkkkk',
    'kkkkkkkkkkk',
    'kkkkkkkkkkk',
    '.kkkkkkkkk.',
    '..kk.k.kk..',
    '.....k.....',
    '....kkk....',
    '...kkkkk...',
  ],
}
const SMALL_PIPS: Record<Suit, readonly string[]> = {
  clubs: ['..kkk..', '..kkk..', 'kk.k.kk', 'kkkkkkk', 'kk.k.kk', '...k...', '..kkk..'],
  diamonds: ['...k...', '..kkk..', '.kkkkk.', 'kkkkkkk', '.kkkkk.', '..kkk..', '...k...'],
  hearts: ['.kk.kk.', 'kkkkkkk', 'kkkkkkk', '.kkkkk.', '..kkk..', '...k...', '.......'],
  spades: ['...k...', '..kkk..', '.kkkkk.', 'kkkkkkk', 'kk.k.kk', '...k...', '..kkk..'],
}
const PIP_ROWS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[35, 48]],
  2: [
    [35, 23],
    [35, 73],
  ],
  3: [
    [35, 23],
    [35, 48],
    [35, 73],
  ],
  4: [
    [22, 23],
    [48, 23],
    [22, 73],
    [48, 73],
  ],
  5: [
    [22, 23],
    [48, 23],
    [35, 48],
    [22, 73],
    [48, 73],
  ],
  6: [
    [22, 23],
    [48, 23],
    [22, 48],
    [48, 48],
    [22, 73],
    [48, 73],
  ],
  7: [
    [22, 23],
    [48, 23],
    [35, 35],
    [22, 48],
    [48, 48],
    [22, 73],
    [48, 73],
  ],
  8: [
    [22, 23],
    [48, 23],
    [35, 35],
    [22, 48],
    [48, 48],
    [35, 61],
    [22, 73],
    [48, 73],
  ],
  9: [
    [22, 22],
    [48, 22],
    [22, 39],
    [48, 39],
    [35, 48],
    [22, 57],
    [48, 57],
    [22, 74],
    [48, 74],
  ],
  10: [
    [22, 22],
    [48, 22],
    [35, 30],
    [22, 39],
    [48, 39],
    [22, 57],
    [48, 57],
    [35, 66],
    [22, 74],
    [48, 74],
  ],
}
const rankNames: Partial<Record<Card['rank'], string>> = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' }
const rankLabels: Partial<Record<Card['rank'], string>> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }
const ink = (suit: Suit) => (suit === 'hearts' || suit === 'diamonds' ? 'r' : 'k')

function court(card: Card, pixels: Pixels) {
  const variant = SUITS.indexOf(card.suit)
  const half = new Pixels(39, 34, 'w')
  half.rect(0, 0, 39, 34, 'B')
  half.rect(1, 1, 37, 33, 'w')
  half.rect(3, 25, 33, 9, 'y')
  for (let y = 25; y < 34; y++)
    for (let x = 3; x < 36; x++) {
      const stripe = (x + y + variant * 3) % 11
      if (stripe < 3) half.dot(x, y, 'r')
      else if (stripe > 6) half.dot(x, y, 'B')
      if ((x + y) % 7 === 0) half.dot(x, y, 'k')
    }
  half.line(4, 25, 33, 33, 'k')
  half.line(5, 24, 33, 32, 'w')
  const headX = 14 + (variant % 2) * 2
  half.rect(headX - 2, 8, 14, 17, card.rank === 12 ? 'y' : 'k')
  half.rect(headX, 9, 10, 14, 'w')
  half.line(headX, 9, headX + 8, 9, 'r')
  half.line(headX + 9, 11, headX + 11, 17, 'k')
  half.rect(headX + 2, 12, 2, 1, 'k')
  half.rect(headX + 7, 12, 2, 1, 'k')
  half.line(headX + 5, 13, headX + 4, 17, 'r')
  half.line(headX + 4, 17, headX + 7, 17, 'r')
  half.line(headX + 3, 20, headX + 7, 20, 'r')
  if (card.rank === 11) {
    half.rect(headX - 3, 6, 16, 3, 'r')
    half.rect(headX - 1, 2, 11, 4, variant % 2 ? 'B' : 'r')
    half.line(headX + 10, 5, headX + 14, 1, 'y')
    half.line(headX + 10, 6, headX + 13, 2, 'k')
    half.line(6, 32, 6, 9, 'k')
    half.line(7, 32, 7, 10, 'y')
    if (variant % 2) {
      half.line(3, 12, 10, 12, 'k')
      half.line(4, 13, 9, 13, 's')
    } else {
      half.line(6, 9, 3, 15, 'k')
      half.line(6, 9, 9, 15, 'k')
    }
  } else {
    half.rect(headX - 3, 5, 16, 4, 'y')
    half.line(headX - 3, 8, headX + 12, 8, 'k')
    for (let x = headX - 3; x < headX + 13; x += 5) {
      half.rect(x, 2, 2, 4, 'y')
      half.dot(x, 2, 'r')
    }
    half.line(headX, 6, headX + 9, 6, 'r')
    if (card.rank === 12) {
      half.line(headX - 2, 10, headX - 5, 24, 'y')
      half.line(headX + 12, 10, headX + 15, 24, 'y')
      half.line(6, 31, 6, 17, 'L')
      half.stamp(['..r..', '.ryr.', 'ryyyr', '.ryr.', '..r..'], 4, 13)
      half.line(6, 26, 3, 23, 'L')
      half.line(6, 28, 10, 24, 'L')
    } else {
      half.stamp(['k...k', 'kkkkk', '.kkk.', '..k..'], headX + 2, 21)
      half.rect(5, 7, 2, 25, 'k')
      half.rect(5, 9, 1, 18, 'y')
      half.rect(2, 26, 8, 2, 'y')
      if (variant === 2) {
        half.rect(2, 8, 7, 5, 's')
        half.line(2, 8, 8, 12, 'k')
      }
    }
  }
  half.rect(28, 11, 8, 10, 'w')
  half.stamp(SMALL_PIPS[card.suit], 29, 12, ink(card.suit))
  const rows = half.rows.map((row) => row.join(''))
  pixels.stamp(rows, 16, 14)
  pixels.stamp(rows, 16, 48, undefined, true)
}

export function cardImage(card: Card): string {
  return cached(`${card.suit}-${card.rank}`, () => {
    const pixels = cardFrame()
    const color = ink(card.suit)
    const glyph = GLYPHS[rankLabels[card.rank] ?? String(card.rank)] ?? []
    const corner = new Pixels(10, 22)
    corner.stamp(glyph, card.rank === 10 ? 0 : 1, 0, color)
    corner.stamp(SMALL_PIPS[card.suit], 0, 10, color)
    const rows = corner.rows.map((row) => row.join(''))
    pixels.stamp(rows, 4, 5)
    pixels.stamp(rows, 57, 69, undefined, true)
    if (card.rank > 10) court(card, pixels)
    else
      for (const [x, y] of PIP_ROWS[card.rank] ?? []) {
        const scale = card.rank === 1 ? 2 : 1
        pixels.stamp(
          PIPS[card.suit],
          x - Math.floor((11 * scale) / 2),
          y - Math.floor((13 * scale) / 2),
          color,
          y > 48,
          scale,
        )
      }
    return pixels
  })
}

function backBase(fill: string): Pixels {
  const pixels = cardFrame()
  pixels.rect(4, 4, 63, 88, 'k')
  pixels.rect(5, 5, 61, 86, fill)
  return pixels
}
function palm(p: Pixels, x: number, y: number) {
  p.line(x, y, x + 4, y - 27, 'k')
  p.line(x + 1, y, x + 5, y - 27, 'Y')
  const leaves: readonly (readonly [number, number])[] = [
    [-18, -4],
    [-15, -12],
    [-4, -15],
    [11, -14],
    [19, -4],
    [15, 5],
  ]
  for (const [dx, dy] of leaves) {
    p.line(x + 4, y - 27, x + 4 + dx, y - 27 + dy, 'L')
    p.line(x + 4, y - 26, x + 4 + dx, y - 26 + dy, 'L')
  }
}

export function backImage(back: Back, frame = 0): string {
  const step = ANIMATED_BACKS.includes(back) ? frame % 4 : 0
  return cached(`back-${back}-${step}`, () => {
    const p = backBase('B')
    switch (back) {
      case 'Blue weave':
      case 'Blue plaid':
      case 'Red diamonds': {
        for (let y = 5; y < 91; y++)
          for (let x = 5; x < 66; x++) {
            const color =
              back === 'Red diamonds'
                ? Math.abs((x % 8) - 4) + Math.abs((y % 8) - 4) < 3
                  ? 'w'
                  : 'R'
                : back === 'Blue plaid'
                  ? x % 8 < 2 || y % 8 < 2
                    ? 'w'
                    : 'B'
                  : x % 4 === y % 4 || (x + y) % 4 === 0
                    ? 'w'
                    : 'B'
            p.dot(x, y, color)
          }
        break
      }
      case 'Robot': {
        p.rect(8, 8, 55, 80, 'k')
        p.rect(17, 15, 38, 29, 'g')
        p.rect(19, 17, 34, 25, 's')
        p.rect(21, 21, 11, 8, step % 2 ? 'r' : 'y')
        p.rect(40, 21, 10, 8, step % 2 ? 'y' : 'r')
        p.rect(24, 23, 4, 4, 'k')
        p.rect(43, 23, 4, 4, 'k')
        p.rect(28, 34, 17, 4, 'k')
        p.rect(30 + step * 3, 35, 3, 2, 'r')
        p.rect(14, 23, 3, 13, 'r')
        p.rect(55, 23, 3, 13, 'r')
        p.line(34, 14, 34, 9, 's')
        p.rect(32, 7, 5, 3, 'r')
        p.rect(23, 46, 26, 28, 's')
        p.rect(25, 48, 22, 24, 'g')
        p.rect(29, 52, 14, 10, 'B')
        p.rect(31, 54, 10, 6, step % 2 ? 'c' : 'l')
        p.rect(16, 49, 5, 23, 's')
        p.rect(51, 49, 5, 23, 's')
        p.rect(25, 75, 8, 10, 'g')
        p.rect(39, 75, 8, 10, 'g')
        p.rect(22, 84, 12, 3, 's')
        p.rect(38, 84, 12, 3, 's')
        break
      }
      case 'Roses':
        p.rect(7, 7, 57, 82, 'w')
        for (let y = 15; y < 84; y += 23)
          for (let x = 16; x < 59; x += 22) {
            p.line(x, y + 3, x - 3, y + 15, 'L')
            p.line(x - 2, y + 10, x + 5, y + 7, 'L')
            p.stamp(['..RRR..', '.RrrrR.', 'RrrRrrR', 'RrRrRrR', '.RrrrR.', '..RRR..'], x - 3, y - 3)
          }
        break
      case 'Ivy':
        p.rect(7, 7, 57, 82, 'k')
        for (let y = 10; y < 88; y += 12)
          for (let x = 10; x < 62; x += 16) {
            p.line(x, y, x + 5, y + 10, 'Y')
            p.stamp(['..L.L..', '.LLLLL.', 'LLLLLLL', '.LLLLL.', '...L...'], x, y, (x + y) % 3 ? 'L' : 'l')
          }
        break
      case 'Tropical fish':
        p.rect(8, 8, 55, 80, 'b')
        for (let x = 10; x < 63; x += 9) {
          p.line(x, 85, x - 2, 64, 'L')
          p.line(x + 1, 85, x + 4, 70, 'l')
        }
        p.oval(38, 43, 20, 13, 'y')
        for (let y = 34; y < 54; y++) for (let x = 23; x < 49; x++) if (x % 11 < 4) p.dot(x, y, 'r')
        for (let x = 12; x < 24; x++)
          p.line(x, 35 + Math.floor((x - 12) / 2), x, 53 - Math.floor((x - 12) / 2), 'y')
        p.rect(49, 39, 3, 3, 'k')
        p.rect(50, 39, 1, 1, 'w')
        for (let y = 15; y < 36; y += 8) p.oval(54, y, 2, 2, 'c')
        break
      case 'Shell':
        p.rect(8, 8, 55, 80, 'M')
        p.oval(35, 48, 24, 25, 'w')
        p.oval(35, 49, 22, 23, 's')
        for (let x = 14; x <= 56; x += 5) p.line(35, 72, x, 27 + Math.floor(Math.abs(35 - x) / 2), 'w')
        p.rect(27, 72, 17, 4, 'w')
        break
      case 'Castle': {
        p.rect(8, 8, 55, 80, 'B')
        p.oval(50, 20, 8, 8, 'w')
        p.oval(53, 18, 7, 7, 'B')
        for (let x = 10; x < 63; x += 7) p.dot(x, 12 + (x % 17), 'w')
        p.rect(8, 74, 55, 14, 'L')
        p.rect(19, 44, 34, 35, 'g')
        p.rect(14, 34, 13, 44, 's')
        p.rect(46, 34, 12, 44, 's')
        for (let x = 14; x < 59; x += 6) p.rect(x, x < 27 || x > 45 ? 30 : 40, 3, 6, 's')
        for (let y = 48; y < 74; y += 8) {
          p.rect(18, y, 3, 4, 'B')
          p.rect(50, y, 3, 4, 'B')
        }
        p.oval(36, 68, 6, 10, 'k')
        p.rect(30, 68, 13, 11, 'k')
        p.line(28, 81, 39, 81, 'Y')
        p.line(24, 86, 44, 86, 'Y')
        p.stamp(
          step % 2
            ? ['k...k...k', '.k.kkk.k.', '..kkkkk..', '...k.k...']
            : ['.kk...kk.', '..kkkkk..', 'kk.kkk.kk', '....k....'],
          13 + step * 8,
          20 + (step % 2) * 4,
          'k',
        )
        break
      }
      case 'Beach':
        p.rect(8, 8, 55, 80, 'c')
        p.rect(8, 44, 55, 24, 'b')
        p.rect(8, 68, 55, 20, 'y')
        p.oval(50, 25, 8, 8, 'y')
        for (let y = 48; y < 67; y += 5)
          for (let x = 9; x < 60; x += 11) p.line(x + (y % 3), y, x + 5, y, 'c')
        palm(p, 24, 80)
        palm(p, 48, 86)
        break
      case 'Poker hand': {
        p.rect(8, 8, 55, 80, 'L')
        p.rect(10, 54, 23, 33, 'k')
        p.rect(11, 55, 18, 31, 'B')
        p.rect(27, 53, 6, 16, 'w')
        p.rect(33, 48 - step, 18, 15, 'Y')
        p.rect(34, 47 - step, 15, 14, 'w')
        for (let finger = 0; finger < 4; finger++) p.rect(42 + finger * 3, 32 + finger * 3 - step, 2, 22, 'w')
        for (let card = 0; card < 3; card++) {
          const x = 22 + card * 9
          p.rect(x, 18 + card * 3 - step * 2, 16, 26, 'k')
          p.rect(x + 1, 19 + card * 3 - step * 2, 14, 24, 'w')
          p.stamp(SMALL_PIPS[SUITS[card] ?? 'spades'], x + 3, 23 + card * 3 - step * 2, card % 2 ? 'r' : 'k')
        }
        break
      }
      case 'Sun': {
        p.rect(8, 8, 55, 80, 'c')
        const rays: readonly (readonly [number, number])[] = [
          [35, 12],
          [35, 78],
          [9, 45],
          [61, 45],
          [16, 22],
          [55, 22],
          [16, 69],
          [55, 69],
        ]
        for (const [x, y] of rays) p.line(35, 45, x, y, 'y')
        p.oval(35, 45, 21, 22, 'y')
        const glassesY = 36 + (step === 2 ? 2 : 0)
        p.rect(17, glassesY, 16, 10, 'k')
        p.rect(37, glassesY, 16, 10, 'k')
        p.rect(31, glassesY + 1, 8, 2, 'k')
        p.line(20, glassesY + 2, 24, glassesY + 2, 'w')
        p.line(40, glassesY + 2, 44, glassesY + 2, 'w')
        p.line(26, 55, 31, 59, 'k')
        p.line(31, 59, 41, 59, 'k')
        p.line(41, 59, 46, 54, 'k')
        break
      }
    }
    return p
  })
}

export const slotImage = cached('slot', () => {
  const p = new Pixels(71, 96)
  p.rect(2, 0, 67, 1, 'k')
  p.rect(2, 95, 67, 1, 'l')
  p.rect(0, 2, 1, 92, 'k')
  p.rect(70, 2, 1, 92, 'l')
  p.dot(1, 1, 'k')
  p.dot(69, 1, 'k')
  p.dot(1, 94, 'l')
  p.dot(69, 94, 'l')
  return p
})
export function stockImage(recycle: boolean): string {
  return cached(`stock-${recycle}`, () => {
    const p = new Pixels(71, 96)
    if (recycle) {
      p.oval(35, 48, 22, 22, 'l')
      p.oval(35, 48, 15, 15, 'L')
      p.rect(35, 24, 26, 24, 'L')
      p.stamp(
        [
          'kkkkkkkkkkkk',
          '.kkkkkkkkkkk',
          '..kkkkkkkkkk',
          '...kkkkkkkkk',
          '....kkkkkkkk',
          '.....kkkkkkk',
          '......kkkkkk',
          '.......kkkkk',
          '........kkkk',
          '.........kkk',
          '..........kk',
          '...........k',
        ],
        44,
        25,
        'l',
      )
    } else
      for (let offset = -2; offset <= 2; offset++) {
        p.line(20 + offset, 32, 50 + offset, 64, 'R')
        p.line(50 + offset, 32, 20 + offset, 64, 'R')
      }
    return p
  })
}
export function cardName(card: Card): string {
  return `${rankNames[card.rank] ?? String(card.rank)} of ${card.suit}`
}
export const smallIcon = pixelArt([
  '................',
  '....kkkkkkkkk...',
  '....kwwwwwwwk...',
  '....kwrwwwwwk...',
  '..kkkkkkkkkwk...',
  '..kwwwwwwwkwk...',
  '..kwbwbwbwkwk...',
  '..kwwbwbwwkwk...',
  '..kwbwbwbwkwk...',
  '..kwwbwbwwkwk...',
  '..kwbwbwbwkwk...',
  '..kwwbwbwwkkk...',
  '..kwbwbwbwk.....',
  '..kwwwwwwwk.....',
  '..kkkkkkkkk.....',
  '................',
])
const appIcon = new Pixels(32, 32)
appIcon.rect(12, 2, 18, 25, 'k')
appIcon.rect(13, 3, 16, 23, 'w')
appIcon.rect(15, 5, 2, 5, 'r')
appIcon.rect(26, 19, 2, 5, 'r')
appIcon.rect(7, 5, 18, 25, 'k')
appIcon.rect(8, 6, 16, 23, 'w')
appIcon.rect(2, 8, 18, 24, 'k')
appIcon.rect(3, 9, 16, 22, 'w')
appIcon.rect(5, 11, 12, 18, 'B')
for (let y = 12; y < 29; y += 3) for (let x = 6; x < 17; x += 3) appIcon.dot(x, y, 'w')
export const icon = appIcon.image()
