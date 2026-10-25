import { type BoardSize, customSize, LEVELS, type Level } from './game'

export interface BestTime {
  readonly seconds: number
  readonly name: string
}

export type Records = Record<Exclude<Level, 'custom'>, BestTime>

export interface Preferences {
  readonly level: Level
  readonly custom: BoardSize
  readonly marks: boolean
  readonly color: boolean
  readonly records: Records
}

export const STORAGE_KEY = 'win95.minesweeper'

export function emptyRecords(): Records {
  return {
    beginner: { seconds: 999, name: 'Anonymous' },
    intermediate: { seconds: 999, name: 'Anonymous' },
    expert: { seconds: 999, name: 'Anonymous' },
  }
}

function readRecord(value: unknown): BestTime {
  if (typeof value !== 'object' || value === null) return { seconds: 999, name: 'Anonymous' }
  if (!('seconds' in value) || !('name' in value)) return { seconds: 999, name: 'Anonymous' }
  if (
    typeof value.seconds !== 'number' ||
    !Number.isInteger(value.seconds) ||
    value.seconds < 0 ||
    value.seconds > 999 ||
    typeof value.name !== 'string'
  ) {
    return { seconds: 999, name: 'Anonymous' }
  }
  return { seconds: value.seconds, name: value.name.slice(0, 32) || 'Anonymous' }
}

export function parsePreferences(value: unknown): Preferences {
  const defaults: Preferences = {
    level: 'beginner',
    custom: LEVELS.beginner,
    marks: true,
    color: true,
    records: emptyRecords(),
  }
  if (typeof value !== 'object' || value === null) return defaults
  const level =
    'level' in value &&
    (value.level === 'beginner' ||
      value.level === 'intermediate' ||
      value.level === 'expert' ||
      value.level === 'custom')
      ? value.level
      : defaults.level
  let custom = defaults.custom
  if ('custom' in value && typeof value.custom === 'object' && value.custom !== null) {
    const size = value.custom
    if (
      'width' in size &&
      typeof size.width === 'number' &&
      'height' in size &&
      typeof size.height === 'number' &&
      'mines' in size &&
      typeof size.mines === 'number'
    ) {
      custom = customSize({ width: size.width, height: size.height, mines: size.mines })
    }
  }
  let records = defaults.records
  if ('records' in value && typeof value.records === 'object' && value.records !== null) {
    records = {
      beginner: readRecord('beginner' in value.records ? value.records.beginner : undefined),
      intermediate: readRecord('intermediate' in value.records ? value.records.intermediate : undefined),
      expert: readRecord('expert' in value.records ? value.records.expert : undefined),
    }
  }
  return {
    level,
    custom,
    records,
    marks: 'marks' in value && typeof value.marks === 'boolean' ? value.marks : defaults.marks,
    color: 'color' in value && typeof value.color === 'boolean' ? value.color : defaults.color,
  }
}

export function loadPreferences(): Preferences {
  try {
    return parsePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return parsePreferences(null)
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences))
  } catch {
    // Storage can be disabled; the current session still keeps settings and scores.
  }
}
