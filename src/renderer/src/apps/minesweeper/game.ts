export type Level = 'beginner' | 'intermediate' | 'expert' | 'custom'

export interface BoardSize {
  readonly width: number
  readonly height: number
  readonly mines: number
}

export const LEVELS = {
  beginner: { width: 9, height: 9, mines: 10 },
  intermediate: { width: 16, height: 16, mines: 40 },
  expert: { width: 30, height: 16, mines: 99 },
} satisfies Record<Exclude<Level, 'custom'>, BoardSize>

export const LEVEL_NAMES = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  expert: 'Expert',
  custom: 'Custom',
}

export interface Cell {
  readonly mine: boolean
  readonly adjacent: number
  readonly cover: 'hidden' | 'flag' | 'question' | 'open'
}

type Phase =
  | { readonly kind: 'ready' }
  | { readonly kind: 'running' }
  | { readonly kind: 'won' }
  | { readonly kind: 'lost'; readonly exploded: number }

export interface Game {
  readonly size: BoardSize
  readonly cells: readonly Cell[]
  readonly phase: Phase
  readonly seed: number
  readonly elapsedMs: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? Math.trunc(value) : min))
}

export function customSize(size: BoardSize): BoardSize {
  const width = clamp(size.width, 9, 30)
  const height = clamp(size.height, 9, 24)
  return { width, height, mines: clamp(size.mines, 10, (width - 1) * (height - 1)) }
}

export function createGame(size: BoardSize, seed: number): Game {
  return {
    size,
    seed,
    cells: Array.from({ length: size.width * size.height }, () => ({
      mine: false,
      adjacent: 0,
      cover: 'hidden',
    })),
    phase: { kind: 'ready' },
    elapsedMs: 0,
  }
}

export function neighbors(size: BoardSize, index: number): number[] {
  const x = index % size.width
  const y = Math.floor(index / size.width)
  const result: number[] = []
  for (let row = Math.max(0, y - 1); row <= Math.min(size.height - 1, y + 1); row++) {
    for (let col = Math.max(0, x - 1); col <= Math.min(size.width - 1, x + 1); col++) {
      const next = row * size.width + col
      if (next !== index) result.push(next)
    }
  }
  return result
}

function placeMines(game: Game, first: number): Game {
  let seed = game.seed >>> 0
  const safe = new Set([first, ...neighbors(game.size, first)])
  if (game.cells.length - safe.size < game.size.mines) {
    safe.clear()
    safe.add(first)
  }
  const candidates = game.cells.flatMap((_, index) => (safe.has(index) ? [] : [index]))
  const mines = new Set<number>()
  for (let count = 0; count < game.size.mines; count++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const position = Math.floor((seed / 4294967296) * candidates.length)
    const [chosen] = candidates.splice(position, 1)
    if (chosen !== undefined) mines.add(chosen)
  }
  return {
    ...game,
    phase: { kind: 'running' },
    cells: game.cells.map((cell, index) => ({
      ...cell,
      mine: mines.has(index),
      adjacent: neighbors(game.size, index).filter((next) => mines.has(next)).length,
    })),
  }
}

function openCells(game: Game, indices: readonly number[]): Game {
  const cells = [...game.cells]
  const pending = [...indices]
  let exploded: number | undefined
  while (pending.length) {
    const index = pending.pop()
    if (index === undefined) break
    const cell = cells[index]
    if (!cell || cell.cover === 'flag' || cell.cover === 'open') continue
    cells[index] = { ...cell, cover: 'open' }
    if (cell.mine) {
      exploded ??= index
    } else if (cell.adjacent === 0) {
      pending.push(...neighbors(game.size, index))
    }
  }
  if (exploded !== undefined) return { ...game, cells, phase: { kind: 'lost', exploded } }
  if (cells.every((cell) => cell.mine || cell.cover === 'open')) {
    return {
      ...game,
      cells: cells.map((cell) => (cell.mine ? { ...cell, cover: 'flag' } : cell)),
      phase: { kind: 'won' },
    }
  }
  return { ...game, cells }
}

export function reveal(game: Game, index: number): Game {
  const cell = game.cells[index]
  if (!cell || cell.cover === 'flag' || cell.cover === 'open') return game
  if (game.phase.kind === 'lost' || game.phase.kind === 'won') return game
  return openCells(game.phase.kind === 'ready' ? placeMines(game, index) : game, [index])
}

export function mark(game: Game, index: number, questions: boolean): Game {
  if (game.phase.kind === 'lost' || game.phase.kind === 'won') return game
  const cell = game.cells[index]
  if (!cell || cell.cover === 'open') return game
  const cover = cell.cover === 'hidden' ? 'flag' : cell.cover === 'flag' && questions ? 'question' : 'hidden'
  return { ...game, cells: game.cells.map((cell, i) => (i === index ? { ...cell, cover } : cell)) }
}

export function chord(game: Game, index: number): Game {
  const cell = game.cells[index]
  if (game.phase.kind !== 'running' || !cell || cell.cover !== 'open' || cell.adjacent === 0) return game
  const adjacent = neighbors(game.size, index)
  if (adjacent.filter((next) => game.cells[next]?.cover === 'flag').length !== cell.adjacent) return game
  return openCells(game, adjacent)
}

export function advanceTime(game: Game, milliseconds: number): Game {
  if (game.phase.kind !== 'running') return game
  return { ...game, elapsedMs: Math.min(999000, game.elapsedMs + Math.max(0, milliseconds)) }
}

export function minesLeft(game: Game): number {
  return game.size.mines - game.cells.filter((cell) => cell.cover === 'flag').length
}

export function seconds(game: Game): number {
  return Math.floor(game.elapsedMs / 1000)
}

export function counterDigits(value: number): string {
  return value < 0
    ? `-${String(Math.min(99, -value)).padStart(2, '0')}`
    : String(Math.min(999, value)).padStart(3, '0')
}
