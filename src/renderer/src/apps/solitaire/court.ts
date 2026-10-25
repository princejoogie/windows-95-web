import type { Card, Suit } from './game'
import { Pixels } from './pixels'

/**
 * Court portraits in the SOL.EXE style: a double-headed figure inside a thin frame, the top half drawn
 * and the bottom half rotated, split along the classic diagonal. A figure is a head on a body. Template
 * letters: `1` `2` `3` are the costume colors a suit picks, `h` is the hair color, any other letter is a
 * palette color, and `.` leaves the card white.
 */
export const HALF_WIDTH = 45
export const HALF_HEIGHT = 44
export const FRAME = { x: 12, y: 9, width: 47, height: 78 } as const
const INNER_HEIGHT = FRAME.height - 2
const SPLIT = HALF_HEIGHT - INNER_HEIGHT / 2

type Rows = readonly string[]
type Item = (p: Pixels) => void
type Head = 'kingFront' | 'kingProfile' | 'queen' | 'jackFront' | 'jackProfile'
type Body = 'king' | 'queen' | 'jack'
export type CourtSpec = {
  readonly head: Head
  readonly body: Body
  readonly colors: Readonly<Record<'1' | '2' | '3' | 'h', string>>
  readonly behind?: readonly Item[]
  readonly front?: readonly Item[]
}

const KING_FRONT: Rows = [
  '..............y...y...y...y...y..............',
  '..............r...r...r...r...r..............',
  '..............yy.yyy.yyy.yyy.yy..............',
  '..............yyyyyyyyyyyyyyyyy..............',
  '..............y.r.y.r.y.r.y.r.y..............',
  '..............yyyyyyyyyyyyyyyyy..............',
  '...............kkkkkkkkkkkkkkk...............',
  '...............khhwwwwwwwwwhhk...............',
  '...............khwwwwwwwwwwwhk...............',
  '...............kwkkkwwwwwkkkwk...............',
  '...............kwwkwwwwwwwkwwk...............',
  '...............kwwwwwwkwwwwwwk...............',
  '...............kwwwwwkkkwwwwwk...............',
  '...............khhhhhhwhhhhhhk...............',
  '...............khhhhhrrrhhhhhk...............',
  '..............khhhhhhhhhhhhhhhk..............',
  '..............khhhhhhhhhhhhhhhk..............',
  '...............khhhhhhhhhhhhhk...............',
  '................khhhhhhhhhhhk................',
  '.................kkkhhhhhkkk.................',
]
const KING_PROFILE: Rows = [
  '..............y...y...y...y...y..............',
  '..............r...r...r...r...r..............',
  '..............yy.yyy.yyy.yyy.yy..............',
  '..............yyyyyyyyyyyyyyyyy..............',
  '..............y.r.y.r.y.r.y.r.y..............',
  '..............yyyyyyyyyyyyyyyyy..............',
  '...............kkkkkkkkkkkkkkk...............',
  '...............kwwwwwwwwwwhhhk...............',
  '...............kwwwwwwwwwwwhhk...............',
  '..............kkkkwwwwwwwwwwhk...............',
  '..............kwwkwwwwwwwwhhk................',
  '.............kwwwwwwwwwwwwwhhk...............',
  '.............kkwwwwwwwwwwwwhhk...............',
  '..............kwwwwwwwwwwwwhhk...............',
  '..............krrwhhhhhhhhhhhk...............',
  '..............khhhhhhhhhhhhhhk...............',
  '...............khhhhhhhhhhhhhk...............',
  '...............khhhhhhhhhhhhk................',
  '................khhhhhhhhhhk.................',
  '.................kkkhhhhhkkk.................',
]
const QUEEN: Rows = [
  '...................y.y.y.y...................',
  '..................yyyyyyyyy..................',
  '..................y.r.y.r.y..................',
  '..................yyyyyyyyy..................',
  '................khhhhhhhhhhhk................',
  '...............khhhhhhhhhhhhhk...............',
  '..............khhhkwwwwwwwkhhhk..............',
  '..............khhkwwwwwwwwwkhhk..............',
  '..............khhkwkkwwwkkwkhhk..............',
  '..............khhkwwkwwwkwwkhhk..............',
  '..............khhkwwwwkwwwwkhhk..............',
  '..............khhkwwwwwwwwwkhhk..............',
  '..............khhkwwwrrrwwwkhhk..............',
  '..............khhkwwwwwwwwwkhhk..............',
  '..............khhhkwwwwwwwkhhhk..............',
  '..............khhhhkkwwwkkhhhhk..............',
  '..............khhhhhkwwwkhhhhhk..............',
  '..............khhhhhkwwwkhhhhhk..............',
  '.............kkhhhhhkwwwkhhhhhkk.............',
  '...........kkk1hhhhhyyyyyhhhhh1kkk...........',
]
const JACK_FRONT: Rows = [
  '.............................................',
  '.............................................',
  '..............kkkkkkkkkkkkkkkkk..............',
  '.............k11111111111111111k.............',
  '............k1111111111111111111k............',
  '............k1111111111111111111k............',
  '...........kyyyyyyyyyyyyyyyyyyyyyk...........',
  '...........kkkkkkkkkkkkkkkkkkkkkkk...........',
  '...............khhwwwwwwwwwhhk...............',
  '...............khwwwwwwwwwwwhk...............',
  '...............kwwkkwwwwwkkwwk...............',
  '...............kwwkwwwwwwwkwwk...............',
  '...............kwwwwwwkwwwwwwk...............',
  '...............kwwwwwkkkwwwwwk...............',
  '...............kwwwwwwwwwwwwwk...............',
  '...............kwwwwwrrrwwwwwk...............',
  '................kwwwwwwwwwwwk................',
  '.................kkkwwwwwkkk.................',
  '....................kwwwk....................',
  '....................kwwwk....................',
]
const JACK_PROFILE: Rows = [
  '.............................................',
  '.............................................',
  '..............kkkkkkkkkkkkkkkkk..............',
  '.............k11111111111111111k.............',
  '............k1111111111111111111k............',
  '............k1111111111111111111k............',
  '...........kyyyyyyyyyyyyyyyyyyyyyk...........',
  '...........kkkkkkkkkkkkkkkkkkkkkkk...........',
  '...............kwwwwwwwwwwhhhk...............',
  '...............kwwwwwwwwwwwhhk...............',
  '..............kkkkwwwwwwwwwwhk...............',
  '..............kwwkwwwwwwwwwhhk...............',
  '.............kwwwwwwwwwwwwwhhk...............',
  '.............kkwwwwwwwwwwwwhhk...............',
  '..............kwwwwwwwwwwwwhhk...............',
  '..............krrwwwwwwwwwwhhk...............',
  '...............kwwwwwwwwwwwwk................',
  '.................kkkwwwwwkkk.................',
  '....................kwwwk....................',
  '....................kwwwk....................',
]
const KING_BODY: Rows = [
  '..........kkkkkkkkkkkkkkkkkkkkkkkkk..........',
  '.........k222222y11111111111y33333kk.........',
  '........k2222222y11111111111y333333k.........',
  '.......k22222222y11111111111y3333333k........',
  '......k222222222y11111111111y33333333k.......',
  '.....k2222222222y11111111111y333333333k......',
  '....k22222222222y11111111111y33kwwwwwk3k.....',
  '...k222222222222y11111111111y3kwwwwwwwk3k....',
  '..k2222222222222y11111111111y3kwwwwwwwk33k...',
  '..k2222222222222y11111111111y3kwwwwwwwk33k...',
  '..k2222222222222y11111111111y33kwwwwwk333k...',
  '..k2222222222222y11111111111y333kkkkk3333k...',
  '..k2222222222222y11111111111y3333333333333k..',
  '..k2222y22222222y11111111111y3333333333333k..',
  '..k222y2y2222222y11111111111y3333333333333k..',
  '..k22y222y222222y11111111111y3333333333333k..',
  '..k2y22222y22222y11111111111y3333333333333k..',
  '..k2222222222222y11111111111y3333333333333k..',
  '..k2222222222222y11111111111y3333333333333k..',
  '..k2222y22222222y11111111111y3333333333333k..',
  '..k222y2y2222222y11111111111y3333333333333k..',
  '..k22y222y222222y11111111111y3333333333333k..',
  '..k2y22222y22222y11111111111y3333333333333k..',
  '..k2222222222222y11111111111y3333333333333k..',
]
const QUEEN_BODY: Rows = [
  '.........kk1111hhhhhy111yhhhhh1111kk.........',
  '.......kk111111hhhhh11111hhhhh111111kk.......',
  '.....kk22211111hhhhh11111hhhhh11111222kk.....',
  '....k2222211111hhhhh11111hhhhh1111122222k....',
  '...k222222111111hhh1111111hhh111111222222k...',
  '..k222222221111111111111111111111222222222k..',
  '..k2222222211111111111111111111kwwwwwwk222k..',
  '..k2222222211111111111111111111kwwwwwwk222k..',
  '..k2222222211111111111111111111kwwwwwwk222k..',
  '..k2222222211111111111111111111kkkkkkk2222k..',
  '..k222222221111111111111111111111222222222k..',
  '..k2222222211y11111111111111111y1222222222k..',
  '..k222222221y1y11111111111111y1y1222222222k..',
  '..k2222222211y11111111111111111y1222222222k..',
  '..k222222221111111111111111111111222222222k..',
  '..k222222221111111111111111111111222222222k..',
  '..k2222222211y11111111111111111y1222222222k..',
  '..k222222221y1y11111111111111y1y1222222222k..',
  '..k2222222211y11111111111111111y1222222222k..',
  '..k222222221111111111111111111111222222222k..',
  '..k222222221111111111111111111111222222222k..',
  '..k2222222211y11111111111111111y1222222222k..',
  '..k222222221y1y11111111111111y1y1222222222k..',
  '..k2222222211y11111111111111111y1222222222k..',
]
const JACK_BODY: Rows = [
  '..........kkkkkkkkkkkkkkkkkkkkkkkkk..........',
  '.........k3333y1111y2222y3333333kkk..........',
  '........k33333y1111y2222y333333333k..........',
  '.......k333333y1111y2222y3333333333k.........',
  '......k3333333y1111y2222y33333333333k........',
  '.....k33333333y1111y2222y333333kwwwwk3k......',
  '....k333333333y1111y2222y33333kwwwwwwk3k.....',
  '...k3333333333y1111y2222y3333kwwwwwwwk33k....',
  '..k33333333333y1111y2222y3333kwwwwwwwk333k...',
  '..k33333333333y1111y2222y33333kwwwwwk3333k...',
  '..k33333333333y1111y2222y333333kkkkk33333k...',
  '..k33333333333y1111y2222y3333333333333333k...',
  '..k3k3k3k3k3k3y1111y2222y3k3k3k3k3k3k3k3kk...',
  '..k33333333333y1111y2222y3333333333333333k...',
  '..k33333333333y1111y2222y3333333333333333k...',
  '..k22222222222222222222222222222222222222k...',
  '..kyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyk...',
  '..k22222222222222222222222222222222222222k...',
  '..k11111111111111111111111111111111111111k...',
  '..k11111111111111111111111111111111111111k...',
  '..k1111k1111k1111k1111k1111k1111k1111k111k...',
  '..k1111k1111k1111k1111k1111k1111k1111k111k...',
  '..k1111k1111k1111k1111k1111k1111k1111k111k...',
  '..k1111k1111k1111k1111k1111k1111k1111k111k...',
]
export const HEADS: Readonly<Record<Head, Rows>> = {
  kingFront: KING_FRONT,
  kingProfile: KING_PROFILE,
  queen: QUEEN,
  jackFront: JACK_FRONT,
  jackProfile: JACK_PROFILE,
}
export const BODIES: Readonly<Record<Body, Rows>> = { king: KING_BODY, queen: QUEEN_BODY, jack: JACK_BODY }

/** The right-hand fist of every body closes around x 33..35 at rows 26..30. */
const GRIP_X = 34
const GRIP_Y = 26

function pole(p: Pixels, x: number, top: number, bottom: number, color = 'Y') {
  p.rect(x - 1, top, 3, bottom - top + 1, 'k')
  p.rect(x, top, 1, bottom - top + 1, color)
}
const swordUp: Item = (p) => {
  p.stamp(['.k.', 'ksk', 'ksk'], GRIP_X - 1, 0)
  p.rect(GRIP_X - 1, 3, 3, GRIP_Y - 3, 'k')
  p.rect(GRIP_X, 3, 1, GRIP_Y - 3, 's')
}
const swordBehindHead: Item = (p) => {
  for (const offset of [-1, 0, 1]) p.line(GRIP_X + offset, GRIP_Y - 2, 7 + offset, 1, offset ? 'k' : 's')
  p.stamp(['kk.', 'ksk', '.kk'], 6, 0)
}
const guard: Item = (p) => {
  p.stamp(['yyyyyyy', 'yyyyyyy'], GRIP_X - 3, GRIP_Y - 2)
  p.stamp(['.y.', 'yyy', '.y.'], GRIP_X - 1, GRIP_Y + 5)
}
const axe: Item = (p) => {
  pole(p, GRIP_X, 1, GRIP_Y + 6)
  p.stamp(
    [
      'kk......',
      'kssskk...',
      'kssssskk.',
      'kssssssk.',
      '.kssssssk',
      '.kssssssk',
      '..kssssk.',
      '..kssskk.',
      '..kkkk...',
    ],
    GRIP_X + 1,
    3,
  )
}
const halberd: Item = (p) => {
  pole(p, GRIP_X, 7, GRIP_Y + 6)
  p.stamp(['.k.', 'ksk', 'ksk', 'ksk', 'ksk', 'ksk', 'kkk'], GRIP_X - 1, 0)
  p.stamp(['kkk...', 'kssk..', 'ksssk.', 'kssssk', 'kssssk', 'ksssk.', 'kssk..', 'kkk...'], GRIP_X + 1, 4)
}
const pike: Item = (p) => {
  pole(p, GRIP_X, 8, GRIP_Y + 6)
  p.stamp(['..k..', '.ksk.', '.ksk.', 'kssskk', 'ksssk', '.ksk.', '.ksk.', '..k..', '.yyy.'], GRIP_X - 2, 0)
}
const leafStaff: Item = (p) => {
  pole(p, GRIP_X, 6, GRIP_Y + 6)
  p.stamp(
    ['....kk.', '..kkLLk', '.kLLLLk', 'kLLLLLk', 'kLLLLk.', '.kLLk..', '..kk...'],
    GRIP_X - 7,
    0,
    undefined,
  )
  p.stamp(['...kk', '..kLLk', '.kLLLk', 'kLLLLk', 'kLLLk.', 'kkkk..'], GRIP_X + 1, 2)
}
const flower: Item = (p) => {
  p.rect(GRIP_X, 17, 1, GRIP_Y - 17, 'L')
  p.stamp(['..LL.', '.LL..'], GRIP_X + 1, 20)
  p.stamp(['..rr..', '.rrrr.', 'rryyrr', 'rryyrr', '.rrrr.', '..rr..'], GRIP_X - 2, 11)
}
const scepter: Item = (p) => {
  pole(p, 8, 14, 29, 'y')
  p.stamp(['.yyy.', 'yyryy', 'yrrry', 'yyryy', '.yyy.'], 6, 9)
  p.stamp(['.kkkkk.', 'kwwwwwk', 'kwwwwwk', 'kwwwwwk', '.kkkkk.'], 5, 24)
}
const orb: Item = (p) => {
  p.stamp(['..kkk..', '.kyyyk.', 'kyykyyk', 'kykkkyk', 'kyykyyk', '.kyyyk.', '..kkk..'], 4, 20)
  p.stamp(['.kkkkk.', 'kwwwwwk', 'kwwwwwk', 'kwwwwwk', '.kkkkk.'], 4, 27)
}
const mustache: Item = (p) => p.stamp(['kk.kk', '.kkk.'], 20, 14)
const earring: Item = (p) => p.stamp(['y', 'y'], 29, 12)

export const COURT: Readonly<Record<Suit, Readonly<Record<11 | 12 | 13, CourtSpec>>>> = {
  clubs: {
    11: {
      head: 'jackFront',
      body: 'jack',
      colors: { '1': 'r', '2': 'y', '3': 'b', h: 'k' },
      behind: [leafStaff],
      front: [mustache],
    },
    12: { head: 'queen', body: 'queen', colors: { '1': 'r', '2': 'b', '3': 'y', h: 'k' }, behind: [flower] },
    13: {
      head: 'kingFront',
      body: 'king',
      colors: { '1': 'r', '2': 'b', '3': 'y', h: 'k' },
      behind: [swordUp],
      front: [guard, orb],
    },
  },
  diamonds: {
    11: { head: 'jackFront', body: 'jack', colors: { '1': 'b', '2': 'r', '3': 'y', h: 'y' }, behind: [axe] },
    12: { head: 'queen', body: 'queen', colors: { '1': 'b', '2': 'r', '3': 'y', h: 'y' }, behind: [flower] },
    13: {
      head: 'kingProfile',
      body: 'king',
      colors: { '1': 'b', '2': 'r', '3': 'y', h: 'Y' },
      behind: [axe],
    },
  },
  hearts: {
    11: {
      head: 'jackProfile',
      body: 'jack',
      colors: { '1': 'b', '2': 'y', '3': 'r', h: 'y' },
      behind: [halberd],
      front: [earring],
    },
    12: { head: 'queen', body: 'queen', colors: { '1': 'r', '2': 'y', '3': 'b', h: 'y' }, behind: [flower] },
    13: {
      head: 'kingFront',
      body: 'king',
      colors: { '1': 'b', '2': 'y', '3': 'r', h: 'g' },
      behind: [swordBehindHead],
      front: [guard],
    },
  },
  spades: {
    11: {
      head: 'jackProfile',
      body: 'jack',
      colors: { '1': 'r', '2': 'b', '3': 'y', h: 'k' },
      behind: [pike],
    },
    12: {
      head: 'queen',
      body: 'queen',
      colors: { '1': 'r', '2': 'y', '3': 'b', h: 'k' },
      behind: [flower, scepter],
    },
    13: {
      head: 'kingFront',
      body: 'king',
      colors: { '1': 'y', '2': 'r', '3': 'b', h: 'g' },
      behind: [swordUp],
      front: [guard],
    },
  },
}

function half(spec: CourtSpec): Pixels {
  const pixels = new Pixels(HALF_WIDTH, HALF_HEIGHT)
  for (const item of spec.behind ?? []) item(pixels)
  const rows = [...HEADS[spec.head], ...BODIES[spec.body]].map((row) =>
    Array.from(row, (letter) => spec.colors[letter as keyof CourtSpec['colors']] ?? letter).join(''),
  )
  pixels.stamp(rows, 0, 0)
  for (const item of spec.front ?? []) item(pixels)
  return pixels
}

/** Draws the framed double-headed portrait for a court card onto a 71 by 96 card. */
export function drawCourt(card: Card, pixels: Pixels) {
  const spec = COURT[card.suit][card.rank as 11 | 12 | 13]
  const top = half(spec).rows
  const left = FRAME.x + 1
  const topEdge = FRAME.y + 1
  for (let y = 0; y < INNER_HEIGHT; y++)
    for (let x = 0; x < HALF_WIDTH; x++) {
      const onTop =
        y < INNER_HEIGHT - HALF_HEIGHT || (y < HALF_HEIGHT && x * SPLIT * 2 < (HALF_HEIGHT - y) * HALF_WIDTH)
      const letter = onTop ? top[y]?.[x] : top[INNER_HEIGHT - 1 - y]?.[HALF_WIDTH - 1 - x]
      if (letter && letter !== '.') pixels.dot(left + x, topEdge + y, letter)
    }
  pixels.line(
    left,
    topEdge + HALF_HEIGHT,
    left + HALF_WIDTH - 1,
    topEdge + INNER_HEIGHT - HALF_HEIGHT - 1,
    'k',
  )
  pixels.rect(FRAME.x, FRAME.y, FRAME.width, 1, 'k')
  pixels.rect(FRAME.x, FRAME.y + FRAME.height - 1, FRAME.width, 1, 'k')
  pixels.rect(FRAME.x, FRAME.y, 1, FRAME.height, 'k')
  pixels.rect(FRAME.x + FRAME.width - 1, FRAME.y, 1, FRAME.height, 'k')
}

/** Every template row must be exactly one half wide, or the art shifts. */
export function validateTemplates(): string[] {
  const problems: string[] = []
  const check = (name: string, rows: Rows, height: number) => {
    if (rows.length !== height) problems.push(`${name}: ${rows.length} rows, expected ${height}`)
    rows.forEach((row, index) => {
      if (row.length !== HALF_WIDTH)
        problems.push(`${name} row ${index}: ${row.length} wide, expected ${HALF_WIDTH}`)
    })
  }
  for (const [name, rows] of Object.entries(HEADS)) check(name, rows, 20)
  for (const [name, rows] of Object.entries(BODIES)) check(name, rows, HALF_HEIGHT - 20)
  return problems
}
