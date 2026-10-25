export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const
export const RANKS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] as const
export type Suit = (typeof SUITS)[number]
export type Rank = (typeof RANKS)[number]
export const FOUNDATION_SLOTS = [0, 1, 2, 3] as const
export type FoundationSlot = (typeof FOUNDATION_SLOTS)[number]
export type Foundations = readonly [readonly Card[], readonly Card[], readonly Card[], readonly Card[]]
export interface Card {
  readonly suit: Suit
  readonly rank: Rank
}
export interface TableauCard extends Card {
  readonly faceUp: boolean
}
export interface Options {
  readonly draw: 1 | 3
  readonly scoring: 'standard' | 'vegas' | 'none'
  readonly timed: boolean
  readonly statusBar: boolean
  readonly outline: boolean
  readonly keepScore: boolean
}
export const DEFAULT_OPTIONS: Options = {
  draw: 3,
  scoring: 'standard',
  timed: true,
  statusBar: true,
  outline: false,
  keepScore: false,
}
export interface Position {
  readonly stock: readonly Card[]
  readonly waste: readonly Card[]
  readonly wasteFan: number
  readonly tableau: readonly (readonly TableauCard[])[]
  readonly foundations: Foundations
  readonly recycles: number
  readonly score: number
  readonly elapsed: number
  readonly started: boolean
}
export interface Game extends Position {
  readonly options: Options
  readonly previous: Position | null
  readonly phase: 'playing' | 'won'
}
export type Source =
  | { readonly kind: 'waste' }
  | { readonly kind: 'tableau'; readonly column: number; readonly index: number }
  | { readonly kind: 'foundation'; readonly pile: FoundationSlot }
export type Target =
  | { readonly kind: 'tableau'; readonly column: number }
  | { readonly kind: 'foundation'; readonly pile: FoundationSlot }
export type Action =
  | { readonly type: 'stock' }
  | { readonly type: 'move'; readonly source: Source; readonly target: Target }
  | { readonly type: 'flip'; readonly column: number }
  | { readonly type: 'undo' }
  | { readonly type: 'tick' }

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0
  return () => {
    value = (Math.imul(1664525, value) + 1013904223) >>> 0
    return value / 4294967296
  }
}

export function deck(): Card[] {
  return SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })))
}

export function newGame(
  options: Options = DEFAULT_OPTIONS,
  random: () => number = Math.random,
  vegasBalance = 0,
): Game {
  const cards = deck()
  for (let index = cards.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1))
    const first = cards[index]
    const second = cards[other]
    if (first && second) {
      cards[index] = second
      cards[other] = first
    }
  }
  const tableau: TableauCard[][] = Array.from({ length: 7 }, () => [])
  for (let row = 0; row < 7; row++) {
    for (let column = row; column < 7; column++) {
      const card = cards.pop()
      if (card) tableau[column]?.push({ ...card, faceUp: column === row })
    }
  }
  return {
    options,
    stock: cards,
    waste: [],
    wasteFan: 0,
    tableau,
    foundations: [[], [], [], []],
    recycles: 0,
    score: options.scoring === 'vegas' ? (options.keepScore ? vegasBalance : 0) - 52 : 0,
    elapsed: 0,
    started: false,
    previous: null,
    phase: 'playing',
  }
}

export function red(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds'
}

export function sourceCards(game: Game, source: Source): readonly Card[] {
  switch (source.kind) {
    case 'waste': {
      const card = game.waste.at(-1)
      return card ? [card] : []
    }
    case 'foundation': {
      const card = game.foundations[source.pile].at(-1)
      return card ? [card] : []
    }
    case 'tableau': {
      if (!Number.isInteger(source.index) || source.index < 0) return []
      const run = game.tableau[source.column]?.slice(source.index) ?? []
      if (
        !run.every((card, index) => {
          const previous = run[index - 1]
          return (
            card.faceUp && (!previous || (previous.rank === card.rank + 1 && red(previous) !== red(card)))
          )
        })
      )
        return []
      return run
    }
  }
}

export function canMove(game: Game, source: Source, target: Target): boolean {
  if (game.phase !== 'playing') return false
  const cards = sourceCards(game, source)
  const card = cards[0]
  if (!card) return false
  if (target.kind === 'foundation') {
    const pile = game.foundations[target.pile]
    const first = pile[0]
    return (
      source.kind !== 'foundation' &&
      cards.length === 1 &&
      (!first || card.suit === first.suit) &&
      card.rank === pile.length + 1
    )
  }
  if (source.kind === 'tableau' && source.column === target.column) return false
  const column = game.tableau[target.column]
  if (!column) return false
  const top = column.at(-1)
  return top ? top.faceUp && top.rank === card.rank + 1 && red(top) !== red(card) : card.rank === 13
}

export function canRecycle(game: Game): boolean {
  return (
    game.stock.length === 0 &&
    game.waste.length > 0 &&
    (game.options.scoring !== 'vegas' || (game.options.draw === 3 && game.recycles < 2))
  )
}

function score(game: Game, standard: number, vegas = 0): number {
  switch (game.options.scoring) {
    case 'standard':
      return Math.max(0, game.score + standard)
    case 'vegas':
      return game.score + vegas
    case 'none':
      return 0
  }
}

function save(game: Game, changes: Partial<Position>): Game {
  const { options, previous: _previous, phase: _phase, ...position } = game
  return { ...game, ...changes, options, previous: position, started: true }
}

export function gameReducer(game: Game, action: Action): Game {
  if (action.type === 'undo') {
    if (!game.previous || game.phase === 'won') return game
    const timePenalty =
      game.options.timed && game.options.scoring === 'standard'
        ? 2 * (Math.floor(game.elapsed / 10) - Math.floor(game.previous.elapsed / 10))
        : 0
    return {
      ...game,
      ...game.previous,
      elapsed: game.elapsed,
      started: true,
      score:
        game.options.scoring === 'standard'
          ? Math.max(0, game.previous.score - 2 - timePenalty)
          : game.previous.score,
      previous: null,
    }
  }
  if (game.phase === 'won') return game
  switch (action.type) {
    case 'tick': {
      if (!game.started || !game.options.timed) return game
      const elapsed = game.elapsed + 1
      return { ...game, elapsed, score: elapsed % 10 === 0 ? score(game, -2) : game.score }
    }
    case 'stock': {
      if (!game.stock.length) {
        if (!canRecycle(game)) return game
        const penalty = game.options.draw === 1 ? -100 : game.recycles >= 2 ? -20 : 0
        return save(game, {
          stock: [...game.waste].reverse(),
          waste: [],
          wasteFan: 0,
          recycles: game.recycles + 1,
          score: score(game, penalty),
        })
      }
      const count = Math.min(game.options.draw, game.stock.length)
      const drawn = game.stock.slice(-count).reverse()
      return save(game, {
        stock: game.stock.slice(0, -count),
        waste: [...game.waste, ...drawn],
        wasteFan: count,
      })
    }
    case 'flip': {
      const top = game.tableau[action.column]?.at(-1)
      if (!top || top.faceUp) return game
      return save(game, {
        tableau: game.tableau.map((column, index) =>
          index === action.column
            ? column.map((card, cardIndex) =>
                cardIndex === column.length - 1 ? { ...card, faceUp: true } : card,
              )
            : column,
        ),
        score: score(game, 5),
      })
    }
    case 'move': {
      const { source, target } = action
      if (!canMove(game, source, target)) return game
      const cards = sourceCards(game, source)
      let tableau = game.tableau.map((column, index) =>
        source.kind === 'tableau' && index === source.column ? column.slice(0, source.index) : column,
      )
      const foundations: [readonly Card[], readonly Card[], readonly Card[], readonly Card[]] = [
        ...game.foundations,
      ]
      if (source.kind === 'foundation') foundations[source.pile] = foundations[source.pile].slice(0, -1)
      if (target.kind === 'tableau') {
        tableau = tableau.map((column, index) =>
          index === target.column ? [...column, ...cards.map((card) => ({ ...card, faceUp: true }))] : column,
        )
      } else {
        foundations[target.pile] = [...foundations[target.pile], ...cards]
      }
      const standard =
        target.kind === 'foundation'
          ? 10
          : source.kind === 'foundation'
            ? -15
            : source.kind === 'waste'
              ? 5
              : 0
      const vegas = target.kind === 'foundation' ? 5 : source.kind === 'foundation' ? -5 : 0
      const next = save(game, {
        tableau,
        foundations,
        waste: source.kind === 'waste' ? game.waste.slice(0, -1) : game.waste,
        wasteFan: source.kind === 'waste' ? Math.max(0, game.wasteFan - 1) : game.wasteFan,
        score: score(game, standard, vegas),
      })
      if (foundations.every((pile) => pile.length === 13)) {
        const bonus =
          game.options.scoring === 'standard' && game.options.timed && game.elapsed > 30
            ? Math.floor(700000 / game.elapsed)
            : 0
        return { ...next, phase: 'won', score: next.score + bonus }
      }
      return next
    }
  }
}
