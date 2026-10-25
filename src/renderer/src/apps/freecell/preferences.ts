export interface Options {
  readonly illegalMessages: boolean
  readonly quickPlay: boolean
}
export interface Statistics {
  readonly won: number
  readonly lost: number
  readonly streak: number
  readonly bestWin: number
  readonly bestLoss: number
}
export interface Preferences {
  readonly options: Options
  readonly statistics: Statistics
}
export const EMPTY_STATISTICS: Statistics = { won: 0, lost: 0, streak: 0, bestWin: 0, bestLoss: 0 }
export const DEFAULT_OPTIONS: Options = { illegalMessages: true, quickPlay: false }
export const PREFERENCES_KEY = 'w95.freecell.preferences'
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>

function count(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

export function loadPreferences(storage?: StorageAccess): Preferences {
  const defaults = { options: DEFAULT_OPTIONS, statistics: EMPTY_STATISTICS }
  try {
    const value: unknown = JSON.parse((storage ?? localStorage).getItem(PREFERENCES_KEY) ?? 'null')
    if (!value || typeof value !== 'object') return defaults
    const rawOptions = 'options' in value ? value.options : null
    const rawStats = 'statistics' in value ? value.statistics : null
    const options: Options =
      rawOptions && typeof rawOptions === 'object'
        ? {
            illegalMessages: !('illegalMessages' in rawOptions && rawOptions.illegalMessages === false),
            quickPlay: 'quickPlay' in rawOptions && rawOptions.quickPlay === true,
          }
        : DEFAULT_OPTIONS
    if (!rawStats || typeof rawStats !== 'object') return { options, statistics: EMPTY_STATISTICS }
    const won = count('won' in rawStats ? rawStats.won : 0)
    const lost = count('lost' in rawStats ? rawStats.lost : 0)
    const streak =
      'streak' in rawStats && typeof rawStats.streak === 'number' && Number.isSafeInteger(rawStats.streak)
        ? Math.max(-lost, Math.min(won, rawStats.streak))
        : 0
    return {
      options,
      statistics: {
        won,
        lost,
        streak,
        bestWin: Math.max(streak, Math.min(won, count('bestWin' in rawStats ? rawStats.bestWin : 0))),
        bestLoss: Math.max(-streak, Math.min(lost, count('bestLoss' in rawStats ? rawStats.bestLoss : 0))),
      },
    }
  } catch {
    return defaults
  }
}

export function savePreferences(preferences: Preferences, storage?: StorageAccess): void {
  try {
    ;(storage ?? localStorage).setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // Storage failure must not interrupt a move.
  }
}

export function recordResult(statistics: Statistics, won: boolean): Statistics {
  const streak = won ? Math.max(0, statistics.streak) + 1 : Math.min(0, statistics.streak) - 1
  return {
    won: statistics.won + Number(won),
    lost: statistics.lost + Number(!won),
    streak,
    bestWin: Math.max(statistics.bestWin, streak),
    bestLoss: Math.max(statistics.bestLoss, -streak),
  }
}
