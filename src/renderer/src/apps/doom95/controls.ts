import type { WeaponId } from './defs'

/** Doom's default keyboard: arrows to move and turn, Alt to strafe with them, Ctrl to fire, Space to use. */
export const FORWARD = ['KeyW', 'ArrowUp']
export const BACK = ['KeyS', 'ArrowDown']
export const STRAFE_LEFT = ['KeyA', 'Comma']
export const STRAFE_RIGHT = ['KeyD', 'Period']
export const TURN_LEFT = ['ArrowLeft']
export const TURN_RIGHT = ['ArrowRight']
/** Held, it turns the turn keys into strafe keys. */
export const STRAFE_ON = ['AltLeft', 'AltRight']
export const RUN = ['ShiftLeft', 'ShiftRight']
export const FIRE = ['ControlLeft', 'ControlRight']
export const USE = ['Space', 'KeyE']
export const SLOTS: Readonly<Record<string, WeaponId>> = {
  Digit1: 'fist',
  Digit2: 'pistol',
  Digit3: 'shotgun',
}

export interface HeldControls {
  readonly forward: number
  readonly strafe: number
  readonly turn: number
  readonly run: boolean
  readonly fire: boolean
}

export function readControls(held: ReadonlySet<string>): HeldControls {
  const down = (codes: readonly string[]) => (codes.some((code) => held.has(code)) ? 1 : 0)
  const turn = down(TURN_RIGHT) - down(TURN_LEFT)
  const strafeOn = down(STRAFE_ON) === 1
  const strafe = down(STRAFE_RIGHT) - down(STRAFE_LEFT) + (strafeOn ? turn : 0)
  return {
    forward: down(FORWARD) - down(BACK),
    strafe: Math.max(-1, Math.min(1, strafe)),
    turn: strafeOn ? 0 : turn,
    run: down(RUN) === 1,
    fire: down(FIRE) === 1,
  }
}

/** Alt chords the shell answers: the task switcher, Alt+F4, the system menu, and Alt+Esc. */
const SHELL_ALT_KEYS = new Set(['Tab', 'F4', 'Space', 'Escape', 'Backquote'])

/** Whether a key event belongs to the shell rather than the game. Alt with the arrows is Doom's strafe. */
export const shellOwnsKey = (event: {
  readonly code: string
  readonly key: string
  readonly altKey: boolean
  readonly metaKey: boolean
}): boolean => event.metaKey || (event.altKey && SHELL_ALT_KEYS.has(codeOf(event)))

const NAMED_KEYS: Readonly<Record<string, string>> = {
  ' ': 'Space',
  Control: 'ControlLeft',
  Shift: 'ShiftLeft',
  Alt: 'AltLeft',
  ',': 'Comma',
  '.': 'Period',
  '`': 'Backquote',
  '=': 'Equal',
  '+': 'Equal',
  '-': 'Minus',
}

/** The physical key. Some synthetic and remote-desktop input leaves `code` empty, so derive it. */
export function codeOf(event: { readonly code: string; readonly key: string }): string {
  if (event.code) return event.code
  const { key } = event
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`
  if (/^[0-9]$/.test(key)) return `Digit${key}`
  return NAMED_KEYS[key] ?? key
}
