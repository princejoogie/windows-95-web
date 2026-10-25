import { describe, expect, it } from 'vitest'
import {
  canMove,
  canRecycle,
  DEFAULT_OPTIONS,
  deck,
  FOUNDATION_SLOTS,
  type Foundations,
  type Game,
  gameReducer,
  newGame,
  type Options,
  RANKS,
  SUITS,
  seededRandom,
  type TableauCard,
} from './game'

function position(changes: Partial<Game> = {}, options: Partial<Options> = {}): Game {
  return {
    ...newGame({ ...DEFAULT_OPTIONS, ...options }, seededRandom(95)),
    stock: [],
    tableau: Array.from({ length: 7 }, () => []),
    ...changes,
  }
}
const up = (rank: TableauCard['rank'], suit: TableauCard['suit']): TableauCard => ({
  rank,
  suit,
  faceUp: true,
})
const draw = (game: Game) => gameReducer(game, { type: 'stock' })
const undo = (game: Game) => gameReducer(game, { type: 'undo' })
const move = (game: Game, source: Parameters<typeof canMove>[1], target: Parameters<typeof canMove>[2]) =>
  gameReducer(game, { type: 'move', source, target })
function emptyStock(game: Game): Game {
  let next = game
  while (next.stock.length) next = draw(next)
  return next
}

describe('Klondike deal and moves', () => {
  it.each(FOUNDATION_SLOTS)('accepts an Ace of clubs in empty foundation position %i', (slot) => {
    const game = position({ waste: [up(1, 'clubs')] })
    const next = move(game, { kind: 'waste' }, { kind: 'foundation', pile: slot })
    expect(next.foundations[slot]).toEqual([up(1, 'clubs')])
    expect(next.waste).toEqual([])
  })

  it.each(FOUNDATION_SLOTS)('builds the chosen suit in position %i and releases it when emptied', (pile) => {
    const game = position({ waste: [up(1, 'hearts')], tableau: [[up(2, 'clubs')], [], [], [], [], [], []] })
    const ace = move(game, { kind: 'waste' }, { kind: 'foundation', pile })
    expect(
      canMove({ ...ace, waste: [up(2, 'diamonds')] }, { kind: 'waste' }, { kind: 'foundation', pile }),
    ).toBe(false)
    expect(
      canMove({ ...ace, waste: [up(3, 'hearts')] }, { kind: 'waste' }, { kind: 'foundation', pile }),
    ).toBe(false)
    const two = move({ ...ace, waste: [up(2, 'hearts')] }, { kind: 'waste' }, { kind: 'foundation', pile })
    expect(two.foundations[pile].map((card) => card.rank)).toEqual([1, 2])
    const returned = move(ace, { kind: 'foundation', pile }, { kind: 'tableau', column: 0 })
    expect(returned.foundations[pile]).toEqual([])
    expect(
      canMove({ ...returned, waste: [up(1, 'spades')] }, { kind: 'waste' }, { kind: 'foundation', pile }),
    ).toBe(true)
  })

  it('deals 52 distinct cards with one face-up card per column and a repeatable seed', () => {
    const game = newGame(DEFAULT_OPTIONS, seededRandom(95))
    expect(game).toEqual(newGame(DEFAULT_OPTIONS, seededRandom(95)))
    expect(game.tableau.map((column) => column.length)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(game.tableau.map((column) => column.filter((card) => card.faceUp).length)).toEqual([
      1, 1, 1, 1, 1, 1, 1,
    ])
    expect(game.tableau.every((column) => column.at(-1)?.faceUp)).toBe(true)
    expect(game.stock).toHaveLength(24)
    const cards = [...game.stock, ...game.tableau.flat()]
    expect(new Set(cards.map((card) => `${card.suit}:${card.rank}`)).size).toBe(52)
  })

  it('moves an alternating descending three-card run and leaves the exposed card face down', () => {
    const hidden = { ...up(4, 'clubs'), faceUp: false }
    const game = position({
      tableau: [
        [hidden, up(7, 'hearts'), up(6, 'clubs'), up(5, 'diamonds')],
        [up(8, 'spades')],
        [],
        [],
        [],
        [],
        [],
      ],
    })
    const next = move(game, { kind: 'tableau', column: 0, index: 1 }, { kind: 'tableau', column: 1 })
    expect(next.tableau[1]?.map((card) => card.rank)).toEqual([8, 7, 6, 5])
    expect(next.tableau[0]).toEqual([hidden])
    expect(game.tableau[0]).toHaveLength(4)
  })

  it('rejects same-color, wrong-rank, hidden, malformed, and same-column runs', () => {
    const game = position({
      tableau: [
        [up(7, 'hearts'), up(6, 'clubs')],
        [up(8, 'diamonds')],
        [up(9, 'spades')],
        [{ ...up(8, 'clubs'), faceUp: false }],
        [up(5, 'hearts'), up(4, 'diamonds')],
        [],
        [],
      ],
    })
    for (const target of [0, 1, 2, 3, 9]) {
      expect(move(game, { kind: 'tableau', column: 0, index: 0 }, { kind: 'tableau', column: target })).toBe(
        game,
      )
    }
    expect(canMove(game, { kind: 'tableau', column: 3, index: 0 }, { kind: 'tableau', column: 2 })).toBe(
      false,
    )
    expect(canMove(game, { kind: 'tableau', column: 4, index: 0 }, { kind: 'tableau', column: 0 })).toBe(
      false,
    )
    expect(canMove(game, { kind: 'tableau', column: 0, index: -1 }, { kind: 'tableau', column: 5 })).toBe(
      false,
    )
  })

  it('accepts only a King in an empty column, including a run beginning with a King', () => {
    const game = position({
      tableau: [[up(13, 'clubs'), up(12, 'hearts')], [], [], [], [], [], []],
      waste: [up(12, 'clubs')],
    })
    expect(canMove(game, { kind: 'tableau', column: 0, index: 0 }, { kind: 'tableau', column: 1 })).toBe(true)
    expect(canMove(game, { kind: 'waste' }, { kind: 'tableau', column: 1 })).toBe(false)
  })

  it('builds foundations by suit from Ace and rejects skips, wrong suits, and runs', () => {
    const game = position({
      waste: [up(1, 'hearts')],
      tableau: [[up(2, 'hearts')], [up(1, 'clubs'), up(13, 'hearts')], [], [], [], [], []],
    })
    expect(canMove(game, { kind: 'waste' }, { kind: 'foundation', pile: 3 })).toBe(true)
    expect(canMove(game, { kind: 'tableau', column: 0, index: 0 }, { kind: 'foundation', pile: 2 })).toBe(
      false,
    )
    expect(canMove(game, { kind: 'tableau', column: 1, index: 0 }, { kind: 'foundation', pile: 0 })).toBe(
      false,
    )
    const ace = move(game, { kind: 'waste' }, { kind: 'foundation', pile: 2 })
    expect(ace.foundations[2].map((card) => card.rank)).toEqual([1])
    const two = move(ace, { kind: 'tableau', column: 0, index: 0 }, { kind: 'foundation', pile: 2 })
    expect(two.foundations[2].map((card) => card.rank)).toEqual([1, 2])
  })

  it('flips only a face-down top card when explicitly clicked', () => {
    const game = position({
      tableau: [[{ ...up(3, 'hearts'), faceUp: false }], [up(4, 'clubs')], [], [], [], [], []],
    })
    expect(gameReducer(game, { type: 'flip', column: 1 })).toBe(game)
    expect(gameReducer(game, { type: 'flip', column: 0 }).tableau[0]?.[0]?.faceUp).toBe(true)
  })
})

describe('stock cycles', () => {
  it.each([1, 3] as const)('draws %i in order and recycles without changing that order', (count) => {
    const game = position({ stock: deck().slice(0, 7) }, { draw: count })
    const first = draw(game)
    expect(first.waste.map((card) => card.rank)).toEqual(count === 1 ? [7] : [7, 6, 5])
    expect(first.wasteFan).toBe(count)
    const exhausted = emptyStock(first)
    expect(exhausted.waste.map((card) => card.rank)).toEqual([7, 6, 5, 4, 3, 2, 1])
    expect(exhausted.wasteFan).toBe(1)
    const recycled = draw(exhausted)
    expect(recycled.waste).toEqual([])
    expect(recycled.stock).toEqual(game.stock)
    expect(draw(recycled).waste).toEqual(first.waste)
  })

  it('allows one Vegas pass in Draw One and three Vegas passes in Draw Three', () => {
    const one = emptyStock(position({ stock: deck().slice(0, 7) }, { scoring: 'vegas', draw: 1 }))
    expect(canRecycle(one)).toBe(false)
    expect(draw(one)).toBe(one)
    let three = position({ stock: deck().slice(0, 7) }, { scoring: 'vegas', draw: 3 })
    for (let pass = 0; pass < 2; pass++) {
      three = emptyStock(three)
      expect(canRecycle(three)).toBe(true)
      three = draw(three)
    }
    three = emptyStock(three)
    expect(canRecycle(three)).toBe(false)
    expect(draw(three)).toBe(three)
  })
})

describe('Standard scoring and undo', () => {
  it('awards 5 for waste to tableau, 10 for foundation, and 5 for turning a card', () => {
    const game = position({
      waste: [up(1, 'hearts')],
      tableau: [[up(2, 'clubs')], [{ ...up(4, 'spades'), faceUp: false }], [], [], [], [], []],
    })
    expect(move(game, { kind: 'waste' }, { kind: 'tableau', column: 0 }).score).toBe(5)
    expect(move(game, { kind: 'waste' }, { kind: 'foundation', pile: 2 }).score).toBe(10)
    const onTableau = move(game, { kind: 'waste' }, { kind: 'tableau', column: 0 })
    expect(
      move(onTableau, { kind: 'tableau', column: 0, index: 1 }, { kind: 'foundation', pile: 2 }).score,
    ).toBe(15)
    expect(gameReducer(game, { type: 'flip', column: 1 }).score).toBe(5)
  })

  it('deducts 15 for foundation to tableau and floors Standard scores at zero', () => {
    const game = position({
      score: 20,
      foundations: [[], [], [up(1, 'hearts')], []],
      tableau: [[up(2, 'clubs')], [], [], [], [], [], []],
    })
    expect(move(game, { kind: 'foundation', pile: 2 }, { kind: 'tableau', column: 0 }).score).toBe(5)
    expect(
      move({ ...game, score: 3 }, { kind: 'foundation', pile: 2 }, { kind: 'tableau', column: 0 }).score,
    ).toBe(0)
  })

  it('deducts 100 for each Draw One recycle and 20 after three Draw Three passes', () => {
    const game = position({ score: 200, waste: [up(4, 'clubs')] }, { draw: 1 })
    expect(draw(game).score).toBe(100)
    expect(draw({ ...game, score: 20 }).score).toBe(0)
    for (const recycles of [0, 1, 2, 3]) {
      expect(draw({ ...game, recycles, options: { ...game.options, draw: 3 } }).score).toBe(
        recycles < 2 ? 200 : 180,
      )
    }
  })

  it('deducts 2 every ten active seconds, with no clock before play or in untimed games', () => {
    const game = position({ score: 20, elapsed: 9, started: true })
    expect(gameReducer(game, { type: 'tick' })).toMatchObject({ score: 18, elapsed: 10 })
    expect(gameReducer({ ...game, started: false }, { type: 'tick' }).elapsed).toBe(9)
    expect(
      gameReducer({ ...game, options: { ...game.options, timed: false } }, { type: 'tick' }).elapsed,
    ).toBe(9)
  })

  it('undo restores the board and prior score with the Standard 2-point penalty, preserving time', () => {
    const game = position({ score: 30, waste: [up(1, 'hearts')], elapsed: 9, started: true })
    const moved = move(game, { kind: 'waste' }, { kind: 'foundation', pile: 2 })
    const restored = undo(gameReducer(moved, { type: 'tick' }))
    expect(restored).toMatchObject({
      waste: game.waste,
      foundations: game.foundations,
      score: 26,
      elapsed: 10,
      previous: null,
    })
    expect(undo(restored)).toBe(restored)
  })

  it('undo restores flips, draws, and recycling', () => {
    const game = position({ score: 200, stock: [up(5, 'clubs')] }, { draw: 1 })
    expect(undo(draw(game))).toMatchObject({ stock: game.stock, waste: [], score: 198 })
    const exhausted = emptyStock(game)
    expect(undo(draw(exhausted))).toMatchObject({
      stock: [],
      waste: exhausted.waste,
      recycles: 0,
      score: 198,
    })
    const hidden = position({
      score: 20,
      tableau: [[{ ...up(3, 'clubs'), faceUp: false }], [], [], [], [], [], []],
    })
    expect(undo(gameReducer(hidden, { type: 'flip', column: 0 }))).toMatchObject({
      tableau: hidden.tableau,
      score: 18,
    })
  })
})

describe('Vegas, no scoring, and winning', () => {
  it('charges 52, pays 5 per foundation card, charges 5 on return, and undo restores earnings', () => {
    const game = position(
      { waste: [up(1, 'hearts')], tableau: [[up(2, 'clubs')], [], [], [], [], [], []] },
      { scoring: 'vegas' },
    )
    expect(game.score).toBe(-52)
    const paid = move(game, { kind: 'waste' }, { kind: 'foundation', pile: 2 })
    expect(paid.score).toBe(-47)
    expect(undo(paid).score).toBe(-52)
    expect(move(paid, { kind: 'foundation', pile: 2 }, { kind: 'tableau', column: 0 }).score).toBe(-52)
    expect(move(game, { kind: 'waste' }, { kind: 'tableau', column: 0 }).score).toBe(-52)
    expect(draw(position({ waste: [up(4, 'clubs')] }, { scoring: 'vegas' })).score).toBe(-52)
    expect(gameReducer({ ...paid, elapsed: 9 }, { type: 'tick' }).score).toBe(-47)
    expect(
      gameReducer(
        position(
          { tableau: [[{ ...up(3, 'clubs'), faceUp: false }], [], [], [], [], [], []] },
          { scoring: 'vegas' },
        ),
        { type: 'flip', column: 0 },
      ).score,
    ).toBe(-52)
  })

  it('leaves scores at zero when scoring is None', () => {
    const game = position({ waste: [up(1, 'hearts')] }, { scoring: 'none' })
    expect(move(game, { kind: 'waste' }, { kind: 'foundation', pile: 2 }).score).toBe(0)
  })

  it.each([30, 31, 100])(
    'wins only at 52 foundation cards and awards the timed bonus at %i seconds',
    (elapsed) => {
      const foundations: Foundations = [
        RANKS.map((rank) => ({ rank, suit: SUITS[0] })),
        RANKS.map((rank) => ({ rank, suit: SUITS[1] })),
        RANKS.map((rank) => ({ rank, suit: SUITS[2] })),
        RANKS.slice(0, 12).map((rank) => ({ rank, suit: SUITS[3] })),
      ]
      const game = position({ foundations, waste: [up(13, 'spades')], score: 500, elapsed })
      expect(game.phase).toBe('playing')
      const won = move(game, { kind: 'waste' }, { kind: 'foundation', pile: 3 })
      expect(won.phase).toBe('won')
      expect(won.score).toBe(510 + (elapsed > 30 ? Math.floor(700000 / elapsed) : 0))
      expect(gameReducer(won, { type: 'tick' })).toBe(won)
    },
  )
})
