import { expect, it } from 'vitest'
import { emptyRecords, parsePreferences } from './preferences'

it('restores the chosen level, custom size, options, and best times', () => {
  const stored = {
    level: 'expert',
    custom: { width: 20, height: 24, mines: 80 },
    marks: false,
    color: false,
    records: { ...emptyRecords(), expert: { name: 'Ada', seconds: 145 } },
  }
  expect(parsePreferences(JSON.parse(JSON.stringify(stored)))).toEqual(stored)
})

it('recovers defaults from corrupt storage and validates each record separately', () => {
  expect(parsePreferences(null).level).toBe('beginner')
  expect(
    parsePreferences({
      level: 'impossible',
      records: { beginner: { name: 'Ada', seconds: 12 }, intermediate: { seconds: -1, name: 'Bad' } },
    }).records,
  ).toEqual({ ...emptyRecords(), beginner: { name: 'Ada', seconds: 12 } })
  expect(parsePreferences({ custom: { width: 999, height: 1, mines: 999 } }).custom).toEqual({
    width: 30,
    height: 9,
    mines: 232,
  })
})
