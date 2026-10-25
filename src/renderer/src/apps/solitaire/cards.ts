import { pixelArt } from '../../icons/pixel'
import { ANIMATED_BACKS, type Back, drawBack } from './backs'
import { drawCourt } from './court'
import type { Card, Suit } from './game'
import { cardFrame, Pixels } from './pixels'

export { ANIMATED_BACKS, BACKS, type Back } from './backs'

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
    if (card.rank > 10) drawCourt(card, pixels)
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

export function backImage(back: Back, frame = 0): string {
  const step = ANIMATED_BACKS.includes(back) ? frame % 4 : 0
  return cached(`back-${back}-${step}`, () => drawBack(back, step))
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
