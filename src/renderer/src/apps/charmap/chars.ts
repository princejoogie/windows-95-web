import { isSymbolFont } from '../wordpad/fonts'

export const COLUMNS = 32
export const ROWS = 7
export const FIRST_CODE = 33
export const LAST_CODE = 255

/** The ANSI code shown in a grid cell, or `null` for the unused last cell. */
export function cellCode(index: number): number | null {
  const code = FIRST_CODE + index
  return index >= 0 && code <= LAST_CODE ? code : null
}

export const cellIndex = (code: number): number => code - FIRST_CODE

/** Windows-1252 as a 1995 machine had it: the 0x80 to 0x9F row has typographic marks and gaps, no euro. */
const CP1252_HIGH: readonly (string | null)[] = [
  null,
  null,
  '‚',
  'ƒ',
  '„',
  '…',
  '†',
  '‡',
  'ˆ',
  '‰',
  'Š',
  '‹',
  'Œ',
  null,
  null,
  null,
  null,
  '‘',
  '’',
  '“',
  '”',
  '•',
  '–',
  '—',
  '˜',
  '™',
  'š',
  '›',
  'œ',
  null,
  null,
  'Ÿ',
]

/** The character to draw for an ANSI code in a font. Symbol fonts keep their glyphs in the private-use area. */
export function glyphFor(font: string, code: number): string {
  if (isSymbolFont(font)) return String.fromCharCode(0xf000 + code)
  if (code >= 0x80 && code <= 0x9f) return CP1252_HIGH[code - 0x80] ?? ''
  return String.fromCharCode(code)
}

/** What the status bar tells the user to type, such as `Alt+0169` for the copyright sign. */
export function keystroke(code: number): string {
  if (code === 32) return 'Space'
  if (code < 127) return String.fromCharCode(code)
  return `Alt+0${code}`
}

/** Moves the keyboard selection around the grid, staying inside it. */
export function moveSelection(index: number, key: string): number {
  const last = cellIndex(LAST_CODE)
  switch (key) {
    case 'ArrowLeft':
      return Math.max(0, index - 1)
    case 'ArrowRight':
      return Math.min(last, index + 1)
    case 'ArrowUp':
      return index - COLUMNS >= 0 ? index - COLUMNS : index
    case 'ArrowDown':
      return index + COLUMNS <= last ? index + COLUMNS : index
    case 'Home':
      return index - (index % COLUMNS)
    case 'End':
      return Math.min(last, index - (index % COLUMNS) + COLUMNS - 1)
    case 'PageUp':
      return index % COLUMNS
    case 'PageDown':
      return Math.min(last, (ROWS - 1) * COLUMNS + (index % COLUMNS))
    default:
      return index
  }
}
