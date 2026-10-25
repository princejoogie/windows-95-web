import { describe, expect, it } from 'vitest'
import { DEFAULT_OPTIONS, newGame, seededRandom } from './game'
import { loadPreferences, savePreferences } from './preferences'

function memory(initial: string | null = null) {
  let value = initial
  return {
    getItem: (_key: string) => value,
    setItem: (_key: string, next: string) => {
      value = next
    },
  }
}

describe('Solitaire preferences and Vegas balance', () => {
  it('loads accepted settings before a reopened game charges its next deal', () => {
    const storage = memory()
    const options = {
      ...DEFAULT_OPTIONS,
      draw: 1,
      scoring: 'vegas',
      timed: false,
      statusBar: false,
      outline: true,
      keepScore: true,
    } as const
    savePreferences({ options, back: 'Castle', vegasBalance: -47 }, storage)
    const loaded = loadPreferences(storage)
    expect(loaded).toEqual({ options, back: 'Castle', vegasBalance: -47 })
    expect(newGame(loaded.options, seededRandom(95), loaded.vegasBalance).score).toBe(-99)
    expect(
      newGame({ ...loaded.options, keepScore: false }, seededRandom(95), loaded.vegasBalance).score,
    ).toBe(-52)
  })

  it.each([
    null,
    '{',
    'null',
    '[]',
    '{"options":{"draw":9,"scoring":"bad"},"back":"unknown","vegasBalance":1.5}',
  ])('uses valid defaults for damaged storage %s', (value) => {
    const loaded = loadPreferences(memory(value))
    expect(loaded.options).toEqual(DEFAULT_OPTIONS)
    expect(loaded.vegasBalance).toBe(0)
  })

  it('keeps playing when browser storage is unavailable', () => {
    const storage = {
      getItem: () => {
        throw Error('disabled')
      },
      setItem: () => {
        throw Error('full')
      },
    }
    expect(loadPreferences(storage).options).toEqual(DEFAULT_OPTIONS)
    expect(() =>
      savePreferences({ options: DEFAULT_OPTIONS, back: 'Castle', vegasBalance: -52 }, storage),
    ).not.toThrow()
  })
})
