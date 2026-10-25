import { pixelArt } from './pixel'

const SIZE = 32

type Grid = string[][]

const blank = (): Grid => Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => '.'))

function stamp(grid: Grid, rows: readonly string[], left: number, top: number): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const key = row[x]
      const line = grid[top + y]
      if (key && key !== '.' && line) line[left + x] = key
    }
  })
}

function disc(grid: Grid, cx: number, cy: number, r: number, fill: string, edge: string): void {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      const line = grid[y]
      if (!line) continue
      if (d <= r - 1) line[x] = fill
      else if (d <= r) line[x] = edge
    }
  }
}

const render = (grid: Grid) => pixelArt(grid.map((row) => row.join('')))

const X_MARK = [
  'ww......ww',
  'www....www',
  '.www..www.',
  '..wwwwww..',
  '...wwww...',
  '...wwww...',
  '..wwwwww..',
  '.www..www.',
  'www....www',
  'ww......ww',
]

const BANG = ['.kk.', 'kkkk', 'kkkk', 'kkkk', '.kk.', '.kk.', '.kk.', '.kk.', '....', '.kk.', 'kkkk', '.kk.']

const INFO = ['.bb.', '.bb.', '....', 'bbb.', '.bb.', '.bb.', '.bb.', '.bb.', '.bb.', 'bbbb']

const QUESTION = [
  '.bbbbb.',
  'bbb.bbb',
  'bb...bb',
  '.....bb',
  '....bbb',
  '...bbb.',
  '..bbb..',
  '..bb...',
  '.......',
  '..bb...',
  '..bb...',
]

function errorIcon(): string {
  const grid = blank()
  disc(grid, 17, 17, 13, 'g', 'g')
  disc(grid, 15, 15, 13, 'r', 'k')
  stamp(grid, X_MARK, 10, 10)
  return render(grid)
}

function warningIcon(): string {
  const grid = blank()
  for (let y = 3; y < 29; y++) {
    const half = ((y - 3) / 26) * 14
    for (let x = 0; x < SIZE; x++) {
      const dx = Math.abs(x + 0.5 - 16)
      const line = grid[y]
      if (!line) continue
      if (dx <= half - 1.2 && y < 28) line[x] = 'y'
      else if (dx <= half) line[x] = 'k'
    }
  }
  stamp(grid, BANG, 14, 12)
  return render(grid)
}

function balloon(glyph: readonly string[], left: number): string {
  const grid = blank()
  disc(grid, 17, 15, 13, 'g', 'g')
  disc(grid, 15, 13, 13, 'w', 'k')
  stamp(grid, ['kk', 'wk', 'wwk', 'wwwk', 'kkkkk'].map((row) => row.padEnd(6, '.')), 8, 25)
  stamp(grid, glyph, left, 8)
  return render(grid)
}

export const messageBoxIcons = {
  error: errorIcon(),
  warning: warningIcon(),
  info: balloon(INFO, 14),
  question: balloon(QUESTION, 12),
} as const

export type MessageBoxIcon = keyof typeof messageBoxIcons
