import { describe, expect, it } from 'vitest'
import {
  DEFAULT_OPTIONS,
  EMPTY_STATISTICS,
  loadPreferences,
  recordResult,
  savePreferences,
} from './preferences'

describe('FreeCell statistics and options', () => {
  it('counts results and switches between winning and losing streaks', () => {
    let stats = EMPTY_STATISTICS
    for (const won of [true, true, false, false, false, true]) stats = recordResult(stats, won)
    expect(stats).toEqual({ won: 3, lost: 3, streak: 1, bestWin: 2, bestLoss: 3 })
  })

  it('retains accepted options and statistics across reloads', () => {
    let stored = ''
    const storage = {
      getItem: () => stored,
      setItem: (_key: string, value: string) => {
        stored = value
      },
    }
    const preferences = {
      options: { illegalMessages: false, quickPlay: true },
      statistics: recordResult(EMPTY_STATISTICS, true),
    }
    savePreferences(preferences, storage)
    expect(loadPreferences(storage)).toEqual(preferences)
  })

  it('repairs damaged storage and tolerates disabled storage', () => {
    const read = (value: string) => loadPreferences({ getItem: () => value, setItem: () => {} })
    expect(read('{')).toEqual({ options: DEFAULT_OPTIONS, statistics: EMPTY_STATISTICS })
    expect(read('{"statistics":{"won":-3,"lost":"2","streak":100}}').statistics).toEqual(EMPTY_STATISTICS)
    expect(read('{"statistics":{"won":2,"lost":3,"streak":-9,"bestWin":40}}').statistics).toEqual({
      won: 2,
      lost: 3,
      streak: -3,
      bestWin: 2,
      bestLoss: 3,
    })
    const unavailable = {
      getItem: () => {
        throw new Error('Disabled')
      },
      setItem: () => {
        throw new Error('Full')
      },
    }
    expect(loadPreferences(unavailable).options).toEqual(DEFAULT_OPTIONS)
    expect(() =>
      savePreferences({ options: DEFAULT_OPTIONS, statistics: EMPTY_STATISTICS }, unavailable),
    ).not.toThrow()
  })
})
