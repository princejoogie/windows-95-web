import { pixelArt } from '../../icons/pixel'
import type { Card, Suit } from './game'

export const BACKS = ['Blue weave', 'Red diamonds', 'Castle', 'Tropical fish'] as const
export type Back = (typeof BACKS)[number]
export const SUIT_SYMBOLS: Record<Suit, string> = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' }
const rankLabels: Partial<Record<Card['rank'], string>> = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' }
const rankNames: Partial<Record<Card['rank'], string>> = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' }
const suitPaths: Record<Suit, string> = {
  clubs: 'M0 2C-8 8-11-1-5-3C-9-10 1-13 3-7C10-10 13 1 5 3L2 2L4 9H-4L-2 2Z',
  diamonds: 'M0-11L8 0L0 11L-8 0Z',
  hearts: 'M0 10C-3 5-11 0-10-5C-9-12-2-11 0-6C2-11 9-12 10-5C11 0 3 5 0 10Z',
  spades: 'M0-11C-3-6-12-1-9 4C-7 8-2 6-1 3L-4 10H4L1 3C2 6 7 8 9 4C12-1 3-6 0-11Z',
}
const color = (suit: Suit) => (suit === 'hearts' || suit === 'diamonds' ? '#ff0000' : '#000000')
const suit = (value: Suit, x: number, y: number, size: number, inverted = false) =>
  `<path d="${suitPaths[value]}" fill="${color(value)}" transform="translate(${x} ${y}) scale(${size})${inverted ? ' rotate(180)' : ''}"/>`
const frame = '<rect x=".5" y=".5" width="70" height="95" rx="3" fill="#fff" stroke="#000"/>'
const cache = new Map<string, string>()
function image(key: string, content: () => string): string {
  const previous = cache.get(key)
  if (previous) return previous
  const url = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="71" height="96" viewBox="0 0 71 96" shape-rendering="crispEdges">${frame}${content()}</svg>`)}`
  cache.set(key, url)
  return url
}

const pipRows: Record<number, readonly (readonly [number, number])[]> = {
  1: [[35.5, 48]],
  2: [
    [35.5, 23],
    [35.5, 73],
  ],
  3: [
    [35.5, 23],
    [35.5, 48],
    [35.5, 73],
  ],
  4: [
    [22, 23],
    [49, 23],
    [22, 73],
    [49, 73],
  ],
  5: [
    [22, 23],
    [49, 23],
    [35.5, 48],
    [22, 73],
    [49, 73],
  ],
  6: [
    [22, 23],
    [49, 23],
    [22, 48],
    [49, 48],
    [22, 73],
    [49, 73],
  ],
  7: [
    [22, 23],
    [49, 23],
    [35.5, 35],
    [22, 48],
    [49, 48],
    [22, 73],
    [49, 73],
  ],
  8: [
    [22, 23],
    [49, 23],
    [35.5, 35],
    [22, 48],
    [49, 48],
    [35.5, 61],
    [22, 73],
    [49, 73],
  ],
  9: [
    [22, 22],
    [49, 22],
    [22, 39],
    [49, 39],
    [35.5, 48],
    [22, 57],
    [49, 57],
    [22, 74],
    [49, 74],
  ],
  10: [
    [22, 22],
    [49, 22],
    [35.5, 30],
    [22, 39],
    [49, 39],
    [22, 57],
    [49, 57],
    [35.5, 66],
    [22, 74],
    [49, 74],
  ],
}

function court(card: Card): string {
  const crown =
    card.rank === 11
      ? '<path d="M27 24h18v4H27zM30 20h12v4H30z" fill="#ff0000"/>'
      : '<path d="M27 25l-2-9 6 4 5-6 5 6 6-4-2 9z" fill="#ffff00" stroke="#000"/>'
  const half = `<path d="M19 47V37l13-5h9l12 7v8" fill="#000080" stroke="#000"/><path d="M22 46l22-10 5 5-14 7" fill="#ff0000"/><path d="M31 26h12v11H31z" fill="#ffff00" stroke="#000"/><path d="M41 28h3v5h-3M33 29h2M37 29h2M35 33h5" stroke="#000"/>${crown}<path d="M24 33v14M22 34h4M24 27v6" stroke="#ffff00" stroke-width="2"/>${card.rank === 12 ? '<path d="M49 35v10M46 36h6M49 33v6" stroke="#008000"/><rect x="47" y="31" width="4" height="4" fill="#ff0000"/>' : '<path d="M49 28v19M47 40h5" stroke="#ffff00"/>'}`
  return `<rect x="16" y="14" width="39" height="68" fill="#fff" stroke="#000080"/>${half}<g transform="translate(71 96) rotate(180)">${half}</g>${suit(card.suit, 23, 28, 0.3)}${suit(card.suit, 48, 68, 0.3, true)}`
}

export function cardImage(card: Card): string {
  return image(`${card.suit}-${card.rank}`, () => {
    const rank = rankLabels[card.rank] ?? String(card.rank)
    const corner = `<text x="7" y="13" text-anchor="middle" fill="${color(card.suit)}" font-family="Times New Roman,serif" font-size="13" font-weight="bold"${card.rank === 10 ? ' textLength="11" lengthAdjust="spacingAndGlyphs"' : ''}>${rank}</text>${suit(card.suit, 7, 20, 0.34)}`
    const pips =
      card.rank > 10
        ? court(card)
        : (pipRows[card.rank] ?? [])
            .map(([x, y]) => suit(card.suit, x, y, card.rank === 1 ? 1 : 0.55, y > 48))
            .join('')
    return `${pips}${corner}<g transform="translate(71 96) rotate(180)">${corner}</g>`
  })
}

export function backImage(back: Back): string {
  return image(back, () => {
    const base = '<rect x="4" y="4" width="63" height="88" fill="#000080"/>'
    switch (back) {
      case 'Blue weave':
        return `${base}<defs><pattern id="weave" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M0 0h3v3H0zM3 3h3v3H3z" fill="#fff"/></pattern></defs><rect x="5" y="5" width="61" height="86" fill="url(#weave)"/><rect x="10" y="10" width="51" height="76" fill="none" stroke="#000080"/>`
      case 'Red diamonds':
        return '<defs><pattern id="diamonds" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#800000"/><path d="M4 0l4 4-4 4-4-4z" fill="#fff"/><rect x="3" y="3" width="2" height="2" fill="#ff0000"/></pattern></defs><rect x="4" y="4" width="63" height="88" fill="url(#diamonds)"/>'
      case 'Castle':
        return `${base}<rect x="9" y="9" width="53" height="78" fill="#00ffff"/><circle cx="48" cy="24" r="8" fill="#ffff00"/><path d="M9 69l14-19 13 10 13-17 13 22v22H9z" fill="#008000"/><path d="M20 69V39h4v5h4v-5h4v5h4v-5h4v5h4v-5h5v30z" fill="#c0c0c0" stroke="#000"/><path d="M29 69V56q6-8 12 0v13M24 48h4v5h-4M41 48h4v5h-4" fill="#000080"/>`
      case 'Tropical fish':
        return `${base}<path d="M7 80q12-16 28 0t29 0M7 15q12 16 28 0t29 0" fill="none" stroke="#00ffff"/><path d="M15 48l12-13q20-7 29 13-9 20-29 13L15 48l-7-9v18z" fill="#ffff00"/><path d="M30 37v23M39 35v27" stroke="#ff0000" stroke-width="5"/><rect x="48" y="43" width="3" height="3" fill="#000"/><path d="M20 73v10M45 18v9" stroke="#fff"/>`
    }
  })
}

export function cardName(card: Card): string {
  const rank = rankNames[card.rank] ?? String(card.rank)
  return `${rank} of ${card.suit}`
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
const iconPixels = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => '.'))
function iconRect(x: number, y: number, width: number, height: number, fill: string) {
  for (let row = y; row < y + height; row++) {
    for (let col = x; col < x + width; col++) {
      const pixels = iconPixels[row]
      if (pixels) pixels[col] = fill
    }
  }
}
iconRect(12, 2, 18, 25, 'k')
iconRect(13, 3, 16, 23, 'w')
iconRect(15, 5, 2, 5, 'r')
iconRect(26, 19, 2, 5, 'r')
iconRect(7, 5, 18, 25, 'k')
iconRect(8, 6, 16, 23, 'w')
iconRect(2, 8, 18, 24, 'k')
iconRect(3, 9, 16, 22, 'w')
iconRect(5, 11, 12, 18, 'B')
for (let y = 12; y < 29; y += 3) {
  for (let x = 6; x < 17; x += 3) iconRect(x, y, 1, 1, 'w')
}
export const icon = pixelArt(iconPixels.map((row) => row.join('')))
