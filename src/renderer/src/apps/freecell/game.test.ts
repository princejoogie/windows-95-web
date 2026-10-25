import { describe, expect, it } from 'vitest'
import { type Card, RANKS, SUITS, type Suit } from '../solitaire/game'
import {
  autoHome,
  canMove,
  gameNumber,
  hasLegalMove,
  movableColumn,
  move,
  moveLimit,
  newGame,
  type Position,
  safeHome,
  sourceCards,
  undo,
} from './game'

const card = (rank: Card['rank'], suit: Suit = 'clubs'): Card => ({ rank, suit })
const numbered = (value: string) => {
  const number = gameNumber(value)
  if (number === null) throw new Error('Invalid test deal')
  return newGame(number)
}
const position = (changes: Partial<Position> = {}): Position => ({
  columns: [[], [], [], [], [], [], [], []],
  cells: [null, null, null, null],
  homes: [[], [], [], []],
  moves: 0,
  ...changes,
})
const home = (suit: Suit, count: number) => RANKS.slice(0, count).map((rank) => card(rank, suit))
const notation = ({ rank, suit }: Card) => `${' A23456789TJQK'[rank]}${suit[0]?.toUpperCase()}`

describe('Microsoft numbered deals', () => {
  it('matches every card in Microsoft game #1', () => {
    const columns = numbered('1').position.columns
    const rows = Array.from({ length: 7 }, (_, row) =>
      columns.flatMap((column) => (column[row] ? [notation(column[row])] : [])).join(' '),
    )
    expect(rows).toEqual([
      'JD 2D 9H JC 5D 7H 7C 5H',
      'KD KC 9S 5S AD QC KH 3H',
      '2S KS 9D QD JS AS AH 3C',
      '4C 5C TS QH 4H AC 4D 7S',
      '3S TD 4S TH 8H 2C JH 7D',
      '6D 8S 8D QS 6C 3D 8C TC',
      '6S 9C 2H 6H',
    ])
  })

  it('deals repeatably without missing or duplicate cards at #617 and both limits', () => {
    for (const value of ['1', '617', '32000']) {
      const game = numbered(value)
      expect(game).toEqual(numbered(value))
      expect(game.position.columns.map((column) => column.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6])
      expect(new Set(game.position.columns.flat().map(notation)).size).toBe(52)
    }
    expect(numbered('617')).not.toEqual(numbered('1'))
  })

  it('accepts only integer game numbers from 1 through 32000', () => {
    for (const value of ['', '0', '-1', '32001', '1.5', '1e2', 'NaN', 'Infinity']) {
      expect(gameNumber(value)).toBeNull()
    }
    expect(gameNumber(' 00617 ')).toBe(617)
  })
})

describe('FreeCell moves', () => {
  it('requires descending alternating colors and one card in each free cell', () => {
    const board = position({ columns: [[card(8), card(7, 'hearts')], [card(9, 'diamonds')]] })
    expect(canMove(board, { kind: 'column', column: 0, index: 0 }, { kind: 'column', column: 1 })).toBe(true)
    expect(canMove(board, { kind: 'column', column: 0, index: 0 }, { kind: 'cell', cell: 0 })).toBe(false)
    expect(canMove(board, { kind: 'column', column: 0, index: 1 }, { kind: 'cell', cell: 0 })).toBe(true)
    expect(canMove(board, { kind: 'column', column: 0, index: 1 }, { kind: 'column', column: 0 })).toBe(false)
    expect(sourceCards(board, { kind: 'column', column: 0, index: -1 })).toEqual([])
    const occupied = { ...board, cells: [card(6), null, null, null] } satisfies Position
    expect(canMove(occupied, { kind: 'column', column: 0, index: 1 }, { kind: 'cell', cell: 0 })).toBe(false)
    expect(
      sourceCards(position({ columns: [[card(8), card(7)]] }), { kind: 'column', column: 0, index: 0 }),
    ).toEqual([])
  })

  it('uses spare columns to multiply capacity, excluding an empty destination', () => {
    const board = position({
      columns: [
        [card(8), card(7, 'hearts'), card(6)],
        [card(9, 'hearts')],
        [card(9)],
        [card(9)],
        [card(9)],
        [card(9)],
        [card(9)],
        [],
      ],
      cells: [null, card(10), card(11), card(12)],
    })
    expect(moveLimit(board, 1)).toBe(4)
    expect(moveLimit(board, 7)).toBe(2)
    expect(canMove(board, { kind: 'column', column: 0, index: 0 }, { kind: 'column', column: 1 })).toBe(true)
    expect(canMove(board, { kind: 'column', column: 0, index: 0 }, { kind: 'column', column: 7 })).toBe(false)
    expect(movableColumn(board, 0, { kind: 'column', column: 7 })).toEqual({
      kind: 'column',
      column: 0,
      index: 1,
    })
    expect(
      canMove(
        { ...board, cells: [card(10), card(10), card(11), card(12)] },
        { kind: 'column', column: 0, index: 0 },
        { kind: 'column', column: 1 },
      ),
    ).toBe(false)
  })

  it('builds homes by suit from Ace, in any chosen home', () => {
    const board = position({ cells: [card(1, 'hearts'), card(2, 'hearts'), card(2), null] })
    expect(canMove(board, { kind: 'cell', cell: 0 }, { kind: 'home', cell: 3 })).toBe(true)
    expect(canMove(board, { kind: 'cell', cell: 1 }, { kind: 'home', cell: 3 })).toBe(false)
    const started = { ...board, homes: [[], [], [], [card(1, 'hearts')]] } satisfies Position
    expect(canMove(started, { kind: 'cell', cell: 1 }, { kind: 'home', cell: 3 })).toBe(true)
    expect(canMove(started, { kind: 'cell', cell: 2 }, { kind: 'home', cell: 3 })).toBe(false)
  })

  it('keeps unsafe cards in play and cascades only safe home moves', () => {
    const board = position({
      columns: [[card(3, 'hearts'), card(2, 'hearts'), card(1, 'hearts')]],
    })
    const after = autoHome(board)
    expect(after.homes[0]).toEqual(home('hearts', 2))
    expect(after.columns[0]).toEqual([card(3, 'hearts')])
    expect(safeHome(after, card(3, 'hearts'))).toBe(false)
    const ready = {
      ...after,
      homes: [home('hearts', 2), home('clubs', 2), home('spades', 2), home('diamonds', 1)],
    } satisfies Position
    expect(autoHome(ready).columns[0]).toEqual([])
    expect(
      safeHome(
        { ...ready, homes: [home('hearts', 2), home('clubs', 2), home('spades', 2), []] },
        card(3, 'hearts'),
      ),
    ).toBe(false)
  })

  it('undo restores the user move and all resulting automatic moves once', () => {
    const game = { ...numbered('1'), position: position({ columns: [[card(1), card(7, 'hearts')]] }) }
    const next = move(game, { kind: 'column', column: 0, index: 1 }, { kind: 'cell', cell: 0 })
    expect(next.position.homes[0]).toEqual([card(1)])
    expect(next.position.moves).toBe(1)
    expect(undo(next).position).toEqual(game.position)
    expect(undo(undo(next))).toEqual(undo(next))
    expect(move(game, { kind: 'column', column: 0, index: 1 }, { kind: 'home', cell: 0 })).toBe(game)
  })

  it('recognizes completion and forbids undo after a win', () => {
    const game = {
      ...numbered('1'),
      position: position({
        columns: SUITS.map((suit) => [card(13, suit)]),
        homes: [home('clubs', 12), home('diamonds', 12), home('hearts', 12), home('spades', 12)],
      }),
    }
    const next = move(game, { kind: 'column', column: 0, index: 0 }, { kind: 'home', cell: 0 })
    expect(next.phase).toBe('won')
    expect(next.position.homes.flat()).toHaveLength(52)
    expect(undo(next)).toBe(next)
  })

  it('recognizes a blocked board and a playable board', () => {
    expect(
      hasLegalMove(
        position({
          columns: Array.from({ length: 8 }, () => [card(10)]),
          cells: [card(12), card(12), card(12), card(12)],
        }),
      ),
    ).toBe(false)
    expect(hasLegalMove(numbered('1').position)).toBe(true)
  })
})
