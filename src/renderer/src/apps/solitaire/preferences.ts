import { BACKS, type Back } from './cards'
import { DEFAULT_OPTIONS, type Options } from './game'

export interface Preferences {
  readonly options: Options
  readonly back: Back
  readonly vegasBalance: number
}
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>
export const PREFERENCES_KEY = 'w95.solitaire.preferences'
const defaults: Preferences = { options: DEFAULT_OPTIONS, back: BACKS[0], vegasBalance: 0 }

export function loadPreferences(storage?: StorageAccess): Preferences {
  try {
    const data: unknown = JSON.parse((storage ?? localStorage).getItem(PREFERENCES_KEY) ?? 'null')
    if (!data || typeof data !== 'object') return defaults
    const raw = 'options' in data ? data.options : null
    const options: Options =
      raw && typeof raw === 'object'
        ? {
            draw: 'draw' in raw && raw.draw === 1 ? 1 : 3,
            scoring:
              'scoring' in raw && (raw.scoring === 'none' || raw.scoring === 'vegas')
                ? raw.scoring
                : 'standard',
            timed: 'timed' in raw && typeof raw.timed === 'boolean' ? raw.timed : DEFAULT_OPTIONS.timed,
            statusBar:
              'statusBar' in raw && typeof raw.statusBar === 'boolean'
                ? raw.statusBar
                : DEFAULT_OPTIONS.statusBar,
            outline:
              'outline' in raw && typeof raw.outline === 'boolean' ? raw.outline : DEFAULT_OPTIONS.outline,
            keepScore: 'keepScore' in raw && raw.keepScore === true,
          }
        : DEFAULT_OPTIONS
    return {
      options,
      back: BACKS.find((back) => 'back' in data && back === data.back) ?? defaults.back,
      vegasBalance:
        'vegasBalance' in data &&
        typeof data.vegasBalance === 'number' &&
        Number.isSafeInteger(data.vegasBalance)
          ? data.vegasBalance
          : 0,
    }
  } catch {
    return defaults
  }
}

export function savePreferences(preferences: Preferences, storage?: StorageAccess): void {
  try {
    ;(storage ?? localStorage).setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // A full or disabled store must not interrupt the current game.
  }
}
