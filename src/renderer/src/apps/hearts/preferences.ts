import type { Four } from './game'

export interface Preferences {
  readonly name: string
  readonly sound: boolean
  readonly animation: boolean
  readonly computers: Four<string>
}
export const DEFAULT_PREFERENCES: Preferences = {
  name: 'Player',
  sound: true,
  animation: true,
  computers: ['Player', 'Pauline', 'Michele', 'Ben'],
}
const KEY = 'w95.hearts.options.v1'

export function loadPreferences(): Preferences {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!value || typeof value !== 'object') return DEFAULT_PREFERENCES
    const name = 'name' in value && typeof value.name === 'string' ? value.name.trim().slice(0, 20) : ''
    const computers = 'computers' in value && Array.isArray(value.computers) ? value.computers : []
    const computer = (index: number, fallback: string): string => {
      const text: unknown = computers[index]
      return typeof text === 'string' && text.trim() ? text.trim().slice(0, 20) : fallback
    }
    return {
      name: name || 'Player',
      sound: 'sound' in value && typeof value.sound === 'boolean' ? value.sound : true,
      animation: 'animation' in value && typeof value.animation === 'boolean' ? value.animation : true,
      computers: [name || 'Player', computer(1, 'Pauline'), computer(2, 'Michele'), computer(3, 'Ben')],
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

export function savePreferences(preferences: Preferences): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(preferences))
  } catch {
    // A full or disabled browser store must not interrupt the hand.
  }
}
