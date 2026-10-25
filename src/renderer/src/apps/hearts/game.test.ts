import { describe, expect, it } from 'vitest'
import { deck } from '../solitaire/game'
import {
  type Card,
  choosePass,
  choosePlay,
  four,
  type Game,
  gameReducer,
  legalCards,
  newGame,
  passDirection,
  passTarget,
  points,
  SEATS,
  sameCard,
  scoreHand,
  totals,
  trickWinner,
} from './game'

const card = (suit: Card['suit'], rank: Card['rank']): Card => ({ suit, rank })
const c2 = card('clubs', 2)
const queen = card('spades', 12)
function playing(hand: readonly Card[], changes: Partial<Extract<Game, { kind: 'playing' }>> = {}): Game {
  return {
    ...newGame(95),
    kind: 'playing',
    hands: [hand, [], [], []],
    turn: 0,
    trick: [],
    ...changes,
  }
}
function finishHand(initial: Game): Game {
  let game = initial
  for (let step = 0; step < 100; step++) {
    if (game.kind === 'scores') return game
    if (game.kind === 'passing') game = gameReducer(game, { type: 'pass', cards: choosePass(game.hands[0]) })
    else if (game.kind === 'playing') {
      const choice = choosePlay(game)
      expect(choice).toBeDefined()
      if (!choice) throw new Error('No legal card')
      const before = game
      game = gameReducer(game, { type: 'play', seat: game.turn, card: choice })
      expect(game).not.toBe(before)
    } else game = gameReducer(game, { type: 'continue' })
    const cards = [
      ...game.hands.flat(),
      ...game.captured.flat(),
      ...(game.kind === 'playing' || game.kind === 'trick' ? game.trick.map((p) => p.card) : []),
    ]
    expect(cards).toHaveLength(52)
    expect(new Set(cards.map((c) => `${c.suit}-${c.rank}`)).size).toBe(52)
  }
  throw new Error('Hand failed to finish')
}

describe('Hearts deals and passing', () => {
  it('repeats a seeded deal of 52 distinct cards, 13 per player', () => {
    const game = newGame(95)
    expect(game).toEqual(newGame(95))
    expect(game.hands).not.toEqual(newGame(96).hands)
    expect(game.hands.map((hand) => hand.length)).toEqual([13, 13, 13, 13])
    expect(new Set(game.hands.flat().map((c) => `${c.suit}-${c.rank}`)).size).toBe(52)
  })
  it('cycles left, right, across, hold and delivers three cards simultaneously', () => {
    expect([1, 2, 3, 4, 5].map(passDirection)).toEqual(['left', 'right', 'across', 'hold', 'left'])
    let game = newGame(95)
    for (let round = 1; round <= 4; round++) {
      expect(game.hand).toBe(round)
      if (game.kind === 'passing') {
        const outgoing = game.hands[0].slice(0, 3)
        const next = gameReducer(game, { type: 'pass', cards: outgoing })
        expect(next.kind).toBe('receiving')
        expect(
          outgoing.every((c) => next.hands[passTarget(round, 0)].some((other) => sameCard(c, other))),
        ).toBe(true)
        expect(next.hands.map((hand) => hand.length)).toEqual([13, 13, 13, 13])
      } else expect(game.kind).toBe('playing')
      game = gameReducer(finishHand(game), { type: 'continue' })
    }
  })
  it('rejects duplicate, missing, and wrong-count passes without changing the game', () => {
    const game = newGame(1)
    const first = game.hands[0][0]
    if (!first) throw new Error('Missing card')
    for (const cards of [[], [first, first, first], game.hands[1].slice(0, 3)])
      expect(gameReducer(game, { type: 'pass', cards })).toBe(game)
  })
})

describe('Hearts legal play', () => {
  it('requires the two of clubs to open and rejects an out-of-turn play', () => {
    const game = playing([c2, card('clubs', 1), queen])
    expect(legalCards(game)).toEqual([c2])
    expect(gameReducer(game, { type: 'play', seat: 1, card: c2 })).toBe(game)
    expect(gameReducer(game, { type: 'play', seat: 0, card: queen })).toBe(game)
  })
  it('requires following suit and forbids first-trick points while a nonpoint card exists', () => {
    const trick = [{ seat: 1, card: c2 }] as const
    expect(legalCards(playing([card('clubs', 3), queen], { trick }))).toEqual([card('clubs', 3)])
    expect(legalCards(playing([card('diamonds', 4), card('hearts', 3), queen], { trick }))).toEqual([
      card('diamonds', 4),
    ])
    expect(legalCards(playing([card('hearts', 3), queen], { trick }))).toEqual([card('hearts', 3), queen])
  })
  it('allows hearts to lead only after breaking or when the hand contains only hearts', () => {
    const captured = [[c2], [], [], []] as const
    const hand = [card('hearts', 5), queen]
    expect(legalCards(playing(hand, { captured }))).toEqual([queen])
    expect(legalCards(playing(hand, { captured, heartsBroken: true }))).toEqual(hand)
    expect(legalCards(playing([card('hearts', 5)], { captured }))).toEqual([card('hearts', 5)])
  })
  it('breaks hearts on a discarded heart but not the queen of spades', () => {
    const game = playing([card('hearts', 5), queen], {
      captured: [[c2], [], [], []],
      trick: [{ seat: 3, card: card('diamonds', 2) }],
    })
    expect(gameReducer(game, { type: 'play', seat: 0, card: card('hearts', 5) }).heartsBroken).toBe(true)
    expect(gameReducer(game, { type: 'play', seat: 0, card: queen }).heartsBroken).toBe(false)
  })
  it('awards the trick to the highest card of the led suit, with aces high', () => {
    expect(
      trickWinner([
        { seat: 1, card: card('clubs', 13) },
        { seat: 2, card: card('clubs', 1) },
        { seat: 3, card: card('hearts', 1) },
        { seat: 0, card: card('clubs', 12) },
      ]),
    ).toBe(2)
  })
})

describe('Hearts scoring and computer players', () => {
  it('counts one point per heart and thirteen for the queen of spades', () => {
    expect(deck().reduce((sum, c) => sum + points(c), 0)).toBe(26)
    expect(scoreHand([[queen, card('hearts', 1)], [card('hearts', 2)], [], []])).toEqual({
      points: [14, 1, 0, 0],
      moon: null,
    })
  })
  it('shoots the moon by adding 26 to each opponent', () => {
    expect(scoreHand([[], [], deck().filter((c) => points(c) > 0), []])).toEqual({
      points: [26, 26, 0, 26],
      moon: 2,
    })
  })
  it('passes dangerous spades and discards the queen when void', () => {
    expect(choosePass([c2, queen, card('spades', 1), card('spades', 13), card('hearts', 2)])).toEqual([
      card('spades', 1),
      card('spades', 13),
      queen,
    ])
    expect(
      choosePlay(
        playing([queen, card('hearts', 1)], {
          captured: [[c2], [], [], []],
          trick: [{ seat: 1, card: card('diamonds', 2) }],
        }),
      ),
    ).toEqual(queen)
  })
  it('plays 32 complete seeded hands legally while conserving all 52 cards', () => {
    for (let seed = 1; seed <= 32; seed++) {
      const game = finishHand(newGame(seed))
      expect(game.captured.flat()).toHaveLength(52)
      expect(game.history).toHaveLength(1)
      expect(totals(game).reduce((sum, score) => sum + score, 0)).toBe(
        game.history[0]?.moon === null ? 26 : 78,
      )
    }
  })
  it('ends at 100, keeps the score sheet, and deals no further hands', () => {
    const game = finishHand({
      ...newGame(95),
      history: [{ hand: 0, points: [99, 99, 99, 99], totals: [99, 99, 99, 99], moon: null }],
    })
    expect(game.kind === 'scores' && game.gameOver).toBe(true)
    expect(gameReducer(game, { type: 'continue' })).toBe(game)
    expect(SEATS.some((seat) => totals(game)[seat] >= 100)).toBe(true)
  })
  it('finishes a full game with all three passing directions and hold rounds', () => {
    let game = newGame(1995)
    for (let hand = 0; hand < 40; hand++) {
      game = finishHand(game)
      if (game.kind === 'scores' && game.gameOver) break
      game = gameReducer(game, { type: 'continue' })
    }
    expect(game.kind === 'scores' && game.gameOver).toBe(true)
    expect(game.history.length).toBeGreaterThan(4)
    expect(four((seat) => game.captured[seat].length).reduce((sum, count) => sum + count, 0)).toBe(52)
  })
})
