import { describe, expect, it } from 'vitest'
import {
  advanceTime,
  chord,
  counterDigits,
  createGame,
  customSize,
  LEVELS,
  mark,
  minesLeft,
  neighbors,
  reveal,
  seconds,
} from './game'

describe('Minesweeper rules', () => {
  it('uses the Windows 95 field sizes and accepts an 8 by 8 custom field', () => {
    expect(LEVELS).toEqual({
      beginner: { width: 8, height: 8, mines: 10 },
      intermediate: { width: 16, height: 16, mines: 40 },
      expert: { width: 30, height: 16, mines: 99 },
    })
    expect(customSize({ width: 8, height: 8, mines: 10 })).toEqual(LEVELS.beginner)
  })

  it('keeps the first square safe without reserving its neighbors at every preset level', () => {
    for (const size of Object.values(LEVELS)) {
      let numberedStarts = 0
      let zeroStarts = 0
      for (let seed = 0; seed < 20; seed++) {
        const index = (seed * 37) % (size.width * size.height)
        const game = reveal(createGame(size, seed), index)
        expect(game.cells[index]).toMatchObject({ mine: false, cover: 'open' })
        expect(game.phase.kind).not.toBe('lost')
        if (game.cells[index]?.adjacent) {
          numberedStarts++
          expect(game.cells.filter((cell) => cell.cover === 'open')).toHaveLength(1)
        } else {
          zeroStarts++
          expect(game.cells.filter((cell) => cell.cover === 'open').length).toBeGreaterThan(1)
        }
        expect(game.cells.filter((cell) => cell.mine)).toHaveLength(size.mines)
        for (const [i, cell] of game.cells.entries()) {
          expect(cell.adjacent).toBe(neighbors(size, i).filter((next) => game.cells[next]?.mine).length)
        }
      }
      expect(numberedStarts).toBeGreaterThan(0)
      expect(zeroStarts).toBeGreaterThan(0)
    }
  })

  it('keeps the first click safe even at the maximum custom density', () => {
    const size = customSize({ width: 8, height: 8, mines: 999 })
    for (let seed = 0; seed < 20; seed++) {
      const game = reveal(createGame(size, seed), 27)
      expect(game.cells[27]?.mine).toBe(false)
      expect(game.cells.filter((cell) => cell.mine)).toHaveLength(49)
    }
  })

  it('reproduces a board from its seed without mutating the ready board', () => {
    const ready = createGame(LEVELS.beginner, 42)
    expect(reveal(ready, 40)).toEqual(reveal(ready, 40))
    expect(ready.phase.kind).toBe('ready')
    expect(ready.cells.every((cell) => cell.cover === 'hidden')).toBe(true)
  })

  it('flood fills connected zeros and their border without opening flags', () => {
    let game = reveal(mark(createGame(LEVELS.beginner, 42), 39, true), 40)
    const zero = game.cells.findIndex((cell, index) => !cell.mine && cell.adjacent === 0 && index !== 39)
    expect(zero).toBeGreaterThanOrEqual(0)
    game = reveal(game, zero)
    expect(game.cells[zero]).toMatchObject({ adjacent: 0, cover: 'open' })
    expect(game.cells[39]?.cover).toBe('flag')
    for (const [index, cell] of game.cells.entries()) {
      if (cell.cover === 'open' && cell.adjacent === 0) {
        for (const next of neighbors(game.size, index)) {
          expect(['flag', 'open']).toContain(game.cells[next]?.cover)
        }
      }
    }
    expect(game.cells.some((cell) => cell.cover === 'open' && cell.mine)).toBe(false)
  })

  it('cycles flags and questions, skips questions when disabled, and allows a negative counter', () => {
    const ready = createGame(LEVELS.beginner, 1)
    const flag = mark(ready, 0, true)
    expect(minesLeft(flag)).toBe(9)
    expect(flag.phase.kind).toBe('ready')
    const question = mark(flag, 0, true)
    expect(question.cells[0]?.cover).toBe('question')
    expect(minesLeft(question)).toBe(10)
    expect(mark(question, 0, true).cells[0]?.cover).toBe('hidden')
    expect(mark(flag, 0, false).cells[0]?.cover).toBe('hidden')
    expect(reveal(flag, 0)).toBe(flag)
    let manyFlags = ready
    for (let i = 0; i < 11; i++) manyFlags = mark(manyFlags, i, false)
    expect(minesLeft(manyFlags)).toBe(-1)
    expect(counterDigits(-1)).toBe('-01')
  })

  it('chords only when adjacent flags match, and opens the remaining neighbors', () => {
    let game = reveal(createGame(LEVELS.beginner, 42), 40)
    const index = game.cells.findIndex(
      (cell, i) =>
        cell.cover === 'open' &&
        cell.adjacent > 0 &&
        neighbors(game.size, i).some(
          (next) => game.cells[next]?.cover === 'hidden' && !game.cells[next]?.mine,
        ),
    )
    expect(index).toBeGreaterThanOrEqual(0)
    expect(chord(game, index)).toBe(game)
    for (const next of neighbors(game.size, index)) {
      if (game.cells[next]?.mine) game = mark(game, next, true)
    }
    game = chord(game, index)
    expect(game.phase.kind).not.toBe('lost')
    for (const next of neighbors(game.size, index)) {
      expect(game.cells[next]?.cover).toBe(game.cells[next]?.mine ? 'flag' : 'open')
    }
  })

  it('loses when chording with the correct count of incorrectly placed flags', () => {
    let game = reveal(createGame(LEVELS.beginner, 42), 40)
    const index = game.cells.findIndex(
      (cell, i) =>
        cell.cover === 'open' &&
        cell.adjacent === 1 &&
        neighbors(game.size, i).some(
          (next) => !game.cells[next]?.mine && game.cells[next]?.cover === 'hidden',
        ),
    )
    const wrong = neighbors(game.size, index).find(
      (next) => !game.cells[next]?.mine && game.cells[next]?.cover === 'hidden',
    )
    expect(wrong).toBeDefined()
    if (wrong === undefined) return
    game = chord(mark(game, wrong, true), index)
    expect(game.phase.kind).toBe('lost')
  })

  it('wins by opening every safe cell, flags every mine, and freezes play and time', () => {
    let game = advanceTime(reveal(createGame(LEVELS.beginner, 42), 40), 12345)
    for (const [index, cell] of game.cells.entries()) {
      if (!cell.mine) game = reveal(game, index)
    }
    expect(game.phase.kind).toBe('won')
    expect(game.cells.filter((cell) => cell.cover === 'flag')).toHaveLength(10)
    expect(minesLeft(game)).toBe(0)
    expect(advanceTime(game, 1000)).toBe(game)
    expect(mark(game, 0, true)).toBe(game)
    expect(seconds(game)).toBe(12)
  })

  it('records the exploded mine and freezes a lost game', () => {
    let game = reveal(createGame(LEVELS.beginner, 42), 40)
    const index = game.cells.findIndex((cell) => cell.mine)
    game = reveal(game, index)
    expect(game.phase).toEqual({ kind: 'lost', exploded: index })
    expect(reveal(game, 0)).toBe(game)
    expect(chord(game, 40)).toBe(game)
    expect(advanceTime(game, 1000)).toBe(game)
  })

  it('starts the clock on reveal and caps it at 999 seconds', () => {
    const ready = createGame(LEVELS.beginner, 42)
    expect(advanceTime(ready, 1000)).toBe(ready)
    const running = reveal(ready, 40)
    expect(seconds(advanceTime(running, 1000))).toBe(1)
    expect(seconds(advanceTime(running, 1000000))).toBe(999)
    expect(counterDigits(0)).toBe('000')
  })

  it('clamps custom dimensions and mine count', () => {
    expect(customSize({ width: 100, height: -1, mines: 999 })).toEqual({ width: 30, height: 8, mines: 203 })
    expect(customSize({ width: 0, height: 100, mines: 0 })).toEqual({ width: 8, height: 24, mines: 10 })
    expect(customSize({ width: Number.NaN, height: Number.NaN, mines: Number.NaN })).toEqual(LEVELS.beginner)
  })
})
