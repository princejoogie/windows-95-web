import { type Card, deck, SUITS, seededRandom } from '../solitaire/game'

export type { Card } from '../solitaire/game'
export const SEATS = [0, 1, 2, 3] as const
export type Seat = (typeof SEATS)[number]
export type Four<T> = readonly [T, T, T, T]
export type PassDirection = 'left' | 'right' | 'across' | 'hold'
export interface Play {
  readonly seat: Seat
  readonly card: Card
}
export type Trick = readonly [Play, Play, Play, Play]
export interface HandScore {
  readonly hand: number
  readonly points: Four<number>
  readonly totals: Four<number>
  readonly moon: Seat | null
}
interface Round {
  readonly seed: number
  readonly hand: number
  readonly hands: Four<readonly Card[]>
  readonly captured: Four<readonly Card[]>
  readonly heartsBroken: boolean
  readonly history: readonly HandScore[]
}
export type Game = Round &
  (
    | { readonly kind: 'passing' }
    | { readonly kind: 'receiving'; readonly received: Four<readonly Card[]> }
    | { readonly kind: 'playing'; readonly turn: Seat; readonly trick: readonly Play[] }
    | { readonly kind: 'trick'; readonly trick: Trick; readonly winner: Seat }
    | { readonly kind: 'scores'; readonly gameOver: boolean }
  )
export type Action =
  | { readonly type: 'pass'; readonly cards: readonly Card[] }
  | { readonly type: 'play'; readonly seat: Seat; readonly card: Card }
  | { readonly type: 'continue' }

export function four<T>(make: (seat: Seat) => T): Four<T> {
  return [make(0), make(1), make(2), make(3)]
}

export function nextSeat(seat: Seat, offset = 1): Seat {
  return SEATS[(seat + offset) % 4] ?? 0
}

export function sameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank
}

export function rank(card: Card): number {
  return card.rank === 1 ? 14 : card.rank
}

export function points(card: Card): number {
  return card.suit === 'hearts' ? 1 : card.suit === 'spades' && card.rank === 12 ? 13 : 0
}

export function sorted(cards: readonly Card[]): readonly Card[] {
  return [...cards].sort((a, b) => SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit) || rank(a) - rank(b))
}

export function passDirection(hand: number): PassDirection {
  return (['left', 'right', 'across', 'hold'] as const)[(hand - 1) % 4] ?? 'left'
}

export function passTarget(hand: number, seat: Seat): Seat {
  const offsets = { left: 1, right: 3, across: 2, hold: 0 }
  return nextSeat(seat, offsets[passDirection(hand)])
}

export function totals(game: Game): Four<number> {
  return game.history.at(-1)?.totals ?? [0, 0, 0, 0]
}

function deal(seed: number, hand: number, history: readonly HandScore[]): Game {
  const cards = deck()
  const random = seededRandom(seed + (hand - 1) * 997)
  for (let index = cards.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    const a = cards[index]
    const b = cards[other]
    if (a && b) {
      cards[index] = b
      cards[other] = a
    }
  }
  const round: Round = {
    seed,
    hand,
    hands: four((seat) => sorted(cards.filter((_, index) => index % 4 === seat))),
    captured: four(() => []),
    heartsBroken: false,
    history,
  }
  return passDirection(hand) === 'hold'
    ? { ...round, kind: 'playing', turn: clubsLeader(round.hands), trick: [] }
    : { ...round, kind: 'passing' }
}

export function newGame(seed: number): Game {
  return deal(seed, 1, [])
}

function clubsLeader(hands: Four<readonly Card[]>): Seat {
  return SEATS.find((seat) => hands[seat].some((card) => card.suit === 'clubs' && card.rank === 2)) ?? 0
}

export function legalCards(game: Game): readonly Card[] {
  if (game.kind !== 'playing') return []
  const hand = game.hands[game.turn]
  const lead = game.trick[0]
  const firstTrick = game.captured.every((cards) => cards.length === 0)
  if (!lead) {
    if (firstTrick) return hand.filter((card) => card.suit === 'clubs' && card.rank === 2)
    const nonHearts = hand.filter((card) => card.suit !== 'hearts')
    return game.heartsBroken || nonHearts.length === 0 ? hand : nonHearts
  }
  const following = hand.filter((card) => card.suit === lead.card.suit)
  if (following.length > 0) return following
  const noPoints = hand.filter((card) => points(card) === 0)
  return firstTrick && noPoints.length > 0 ? noPoints : hand
}

export function trickWinner(trick: readonly [Play, ...Play[]]): Seat {
  const lead = trick[0].card.suit
  return trick.reduce((winner, play) =>
    play.card.suit === lead && rank(play.card) > rank(winner.card) ? play : winner,
  ).seat
}

export function choosePass(hand: readonly Card[]): readonly Card[] {
  const risk = (card: Card) => {
    const length = hand.filter((other) => other.suit === card.suit).length
    if (card.suit === 'spades' && rank(card) >= 12) return 100 + rank(card)
    return rank(card) * 3 + (card.suit === 'hearts' ? 12 : 0) + (length <= 3 ? 14 : 0)
  }
  return [...hand].sort((a, b) => risk(b) - risk(a)).slice(0, 3)
}

export function choosePlay(game: Game): Card | undefined {
  if (game.kind !== 'playing') return undefined
  const legal = [...legalCards(game)].sort((a, b) => rank(a) - rank(b))
  const first = game.trick[0]
  if (!first) {
    return legal.sort((a, b) => {
      const length = (card: Card) => game.hands[game.turn].filter((c) => c.suit === card.suit).length
      return rank(a) - rank(b) || length(a) - length(b)
    })[0]
  }
  if (legal.every((card) => card.suit !== first.card.suit)) {
    return legal.sort((a, b) => points(b) - points(a) || rank(b) - rank(a))[0]
  }
  const highest = Math.max(
    ...game.trick.filter((play) => play.card.suit === first.card.suit).map((play) => rank(play.card)),
  )
  const under = legal.filter((card) => rank(card) < highest)
  if (under.length > 0) return under.at(-1)
  const trickPoints = game.trick.reduce((sum, play) => sum + points(play.card), 0)
  if (game.trick.length === 3 && trickPoints === 0)
    return legal.filter((card) => points(card) === 0).at(-1) ?? legal[0]
  return legal[0]
}

export function scoreHand(captured: Four<readonly Card[]>): { points: Four<number>; moon: Seat | null } {
  const raw = four((seat) => captured[seat].reduce((sum, card) => sum + points(card), 0))
  const moon = SEATS.find((seat) => raw[seat] === 26) ?? null
  return { points: moon === null ? raw : four((seat) => (seat === moon ? 0 : 26)), moon }
}

export function gameReducer(game: Game, action: Action): Game {
  switch (action.type) {
    case 'pass': {
      if (game.kind !== 'passing' || action.cards.length !== 3) return game
      const selected = action.cards
      if (
        selected.some((card) => !game.hands[0].some((own) => sameCard(own, card))) ||
        selected.some((card, index) => selected.slice(0, index).some((other) => sameCard(other, card)))
      )
        return game
      const outgoing = four((seat) => (seat === 0 ? selected : choosePass(game.hands[seat])))
      const received = four(
        (seat) => outgoing[SEATS.find((from) => passTarget(game.hand, from) === seat) ?? 0],
      )
      const hands = four((seat) =>
        sorted([
          ...game.hands[seat].filter((card) => !outgoing[seat].some((other) => sameCard(card, other))),
          ...received[seat],
        ]),
      )
      return { ...game, kind: 'receiving', hands, received }
    }
    case 'play': {
      if (game.kind !== 'playing' || game.turn !== action.seat) return game
      if (!legalCards(game).some((card) => sameCard(card, action.card))) return game
      const play = { seat: action.seat, card: action.card }
      const trick = [...game.trick, play]
      const round = {
        ...game,
        hands: four((seat) =>
          seat === action.seat
            ? game.hands[seat].filter((card) => !sameCard(card, action.card))
            : game.hands[seat],
        ),
        heartsBroken: game.heartsBroken || action.card.suit === 'hearts',
      }
      const [a, b, c, d] = trick
      if (a && b && c && d) {
        const complete: Trick = [a, b, c, d]
        return { ...round, kind: 'trick', trick: complete, winner: trickWinner(complete) }
      }
      return { ...round, kind: 'playing', trick, turn: nextSeat(action.seat) }
    }
    case 'continue': {
      switch (game.kind) {
        case 'passing':
        case 'playing':
          return game
        case 'receiving':
          return { ...game, kind: 'playing', trick: [], turn: clubsLeader(game.hands) }
        case 'scores':
          return game.gameOver ? game : deal(game.seed, game.hand + 1, game.history)
        case 'trick': {
          const captured = four((seat) =>
            seat === game.winner
              ? [...game.captured[seat], ...game.trick.map((play) => play.card)]
              : game.captured[seat],
          )
          if (game.hands.some((hand) => hand.length > 0))
            return { ...game, kind: 'playing', captured, trick: [], turn: game.winner }
          const result = scoreHand(captured)
          const scores = totals(game)
          const total = four((seat) => scores[seat] + result.points[seat])
          return {
            ...game,
            kind: 'scores',
            captured,
            gameOver: total.some((score) => score >= 100),
            history: [
              ...game.history,
              { hand: game.hand, points: result.points, totals: total, moon: result.moon },
            ],
          }
        }
      }
    }
  }
}
