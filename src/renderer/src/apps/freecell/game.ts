import { type Card, RANKS, red, SUITS } from '../solitaire/game'

export const CELLS = [0, 1, 2, 3] as const
export const COLUMNS = [0, 1, 2, 3, 4, 5, 6, 7] as const
export type Cell = (typeof CELLS)[number]
export type Column = (typeof COLUMNS)[number]
export type GameNumber = number & { readonly __brand: 'FreeCellGameNumber' }
export type Source =
  | { readonly kind: 'column'; readonly column: Column; readonly index: number }
  | { readonly kind: 'cell'; readonly cell: Cell }
export type Target =
  | { readonly kind: 'column'; readonly column: Column }
  | { readonly kind: 'cell'; readonly cell: Cell }
  | { readonly kind: 'home'; readonly cell: Cell }
export interface Position {
  readonly columns: readonly (readonly Card[])[]
  readonly cells: readonly [Card | null, Card | null, Card | null, Card | null]
  readonly homes: readonly [readonly Card[], readonly Card[], readonly Card[], readonly Card[]]
  readonly moves: number
}
export interface Game {
  readonly number: GameNumber
  readonly position: Position
  readonly previous: Position | null
  readonly phase: 'playing' | 'won'
}

export function isGameNumber(value: number): value is GameNumber {
  return Number.isInteger(value) && value >= 1 && value <= 32000
}

export function gameNumber(text: string): GameNumber | null {
  if (!/^\d+$/.test(text.trim())) return null
  const value = Number(text)
  return isGameNumber(value) ? value : null
}

export function randomGameNumber(): GameNumber {
  const value = Math.floor(Math.random() * 32000) + 1
  if (!isGameNumber(value)) throw new Error('Invalid random game number')
  return value
}

export function newGame(number: GameNumber): Game {
  let seed: number = number
  const deck = RANKS.flatMap((rank) => SUITS.map((suit) => ({ rank, suit })))
  const columns: Card[][] = COLUMNS.map(() => [])
  for (let dealt = 0; deck.length; dealt++) {
    seed = (Math.imul(seed, 214013) + 2531011) >>> 0
    const pick = ((seed >>> 16) & 0x7fff) % deck.length
    const card = deck[pick]
    const last = deck.pop()
    if (card) columns[dealt % 8]?.push(card)
    if (pick < deck.length && last) deck[pick] = last
  }
  return {
    number,
    position: { columns, cells: [null, null, null, null], homes: [[], [], [], []], moves: 0 },
    previous: null,
    phase: 'playing',
  }
}

export function sourceCards(position: Position, source: Source): readonly Card[] {
  if (source.kind === 'cell') {
    const card = position.cells[source.cell]
    return card ? [card] : []
  }
  if (!Number.isInteger(source.index) || source.index < 0) return []
  const cards = position.columns[source.column]?.slice(source.index) ?? []
  return cards.every((card, index) => {
    const before = cards[index - 1]
    return !before || (before.rank === card.rank + 1 && red(before) !== red(card))
  })
    ? cards
    : []
}

export function moveLimit(position: Position, target: Column): number {
  const free = position.cells.filter((card) => card === null).length
  const empty = position.columns.filter((cards, index) => cards.length === 0 && index !== target).length
  return (free + 1) * 2 ** empty
}

export function canMove(position: Position, source: Source, target: Target): boolean {
  const cards = sourceCards(position, source)
  const first = cards[0]
  if (!first) return false
  switch (target.kind) {
    case 'cell':
      return cards.length === 1 && position.cells[target.cell] === null
    case 'home': {
      const home = position.homes[target.cell]
      return cards.length === 1 && first.rank === home.length + 1 && (!home[0] || home[0].suit === first.suit)
    }
    case 'column': {
      if (source.kind === 'column' && source.column === target.column) return false
      const column = position.columns[target.column]
      if (!column || cards.length > moveLimit(position, target.column)) return false
      const top = column.at(-1)
      return !top || (top.rank === first.rank + 1 && red(top) !== red(first))
    }
  }
}

function transfer(position: Position, source: Source, target: Target): Position {
  const cards = sourceCards(position, source)
  const first = cards[0]
  if (!first) return position
  const columns = position.columns.map((column, index) =>
    source.kind === 'column' && source.column === index ? column.slice(0, source.index) : [...column],
  )
  const cells: [Card | null, Card | null, Card | null, Card | null] = [...position.cells]
  const homes: [readonly Card[], readonly Card[], readonly Card[], readonly Card[]] = [...position.homes]
  if (source.kind === 'cell') cells[source.cell] = null
  switch (target.kind) {
    case 'cell':
      cells[target.cell] = first
      break
    case 'home':
      homes[target.cell] = [...homes[target.cell], first]
      break
    case 'column':
      columns[target.column]?.push(...cards)
      break
  }
  return { ...position, columns, cells, homes }
}

export function exposedSources(position: Position): Source[] {
  return [
    ...COLUMNS.flatMap((column): Source[] => {
      const length = position.columns[column]?.length ?? 0
      return length ? [{ kind: 'column', column, index: length - 1 }] : []
    }),
    ...CELLS.flatMap((cell): Source[] => (position.cells[cell] ? [{ kind: 'cell', cell }] : [])),
  ]
}

export function safeHome(position: Position, card: Card): boolean {
  if (card.rank <= 2) return true
  return SUITS.every((suit) => {
    if (suit === card.suit) return true
    const rank = position.homes.find((pile) => pile[0]?.suit === suit)?.length ?? 0
    return rank >= card.rank - (red({ suit, rank: 1 }) === red(card) ? 2 : 1)
  })
}

export function autoHome(position: Position): Position {
  let current = position
  for (;;) {
    let moved = false
    for (const source of exposedSources(current)) {
      const card = sourceCards(current, source)[0]
      if (!card || !safeHome(current, card)) continue
      const cell = CELLS.find((cell) => canMove(current, source, { kind: 'home', cell }))
      if (cell === undefined) continue
      current = transfer(current, source, { kind: 'home', cell })
      moved = true
      break
    }
    if (!moved) return current
  }
}

export function move(game: Game, source: Source, target: Target): Game {
  if (game.phase === 'won' || !canMove(game.position, source, target)) return game
  const position = autoHome({ ...transfer(game.position, source, target), moves: game.position.moves + 1 })
  return {
    ...game,
    position,
    previous: game.position,
    phase: position.homes.every((home) => home.length === 13) ? 'won' : 'playing',
  }
}

export function undo(game: Game): Game {
  if (!game.previous || game.phase === 'won') return game
  return { ...game, position: game.previous, previous: null }
}

export function movableColumn(position: Position, column: Column, target: Target): Source | null {
  const cards = position.columns[column] ?? []
  for (let index = 0; index < cards.length; index++) {
    const source: Source = { kind: 'column', column, index }
    if (canMove(position, source, target)) return source
  }
  return null
}

export function hasLegalMove(position: Position): boolean {
  const targets: Target[] = [
    ...COLUMNS.map((column): Target => ({ kind: 'column', column })),
    ...CELLS.flatMap((cell): Target[] => [
      { kind: 'cell', cell },
      { kind: 'home', cell },
    ]),
  ]
  return exposedSources(position).some((source) =>
    targets.some((target) => canMove(position, source, target)),
  )
}
