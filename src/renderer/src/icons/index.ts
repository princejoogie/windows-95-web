import binEmpty from '../assets/win-icons/bin-empty.ico'
import binFull from '../assets/win-icons/bin-full.ico'
import calculator from '../assets/win-icons/calculator.ico'
import folderClosed from '../assets/win-icons/folder-closed.ico'
import folderOpened from '../assets/win-icons/folder-opened.ico'
import games from '../assets/win-icons/games.ico'
import myComputer from '../assets/win-icons/my-computer.ico'
import windowsLogo from '../assets/win-icons/windows-logo.ico'
import { pixelArt } from './pixel'

function grid(width: number, height: number, paint: (x: number, y: number) => string): string[] {
  return Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => paint(x, y)).join(''))
}

/** A dog-eared white page with ruled lines. */
const document = pixelArt(
  grid(32, 32, (x, y) => {
    const [left, right, top, bottom, fold] = [6, 25, 1, 30, 7]
    const foldX = right - fold
    const foldY = top + fold
    if (x < left || x > right + 1 || y < top || y > bottom + 1) return '.'
    if (x === right + 1 || y === bottom + 1) return x > left && y > foldY ? 'g' : '.'
    if (x >= foldX && y <= foldY) {
      const along = x - foldX
      const down = y - top
      if (along > down) return '.'
      if (along === down || x === foldX || y === foldY) return 'k'
      return 's'
    }
    if (x === left || x === right || y === top || y === bottom) return 'k'
    return y > 10 && y < bottom - 2 && y % 3 === 0 && x > left + 2 && x < right - 2 ? 'g' : 'w'
  }),
)

/** A small application window: a navy title bar over a white client area. */
const program = pixelArt(
  grid(32, 32, (x, y) => {
    if (x < 2 || x > 29 || y < 5 || y > 26) return '.'
    if (x === 2 || x === 29 || y === 5 || y === 26) return 'k'
    if (y <= 9) return x >= 25 && x <= 27 && y >= 7 && y <= 8 ? 's' : 'B'
    if (y === 10) return 'k'
    return 'w'
  }),
)

/** The curved arrow in the corner of a shortcut's icon. */
const shortcutArrow = pixelArt([
  'kkkkkkkkkk',
  'kwwwwwwwwk',
  'kwwkkkkkwk',
  'kwwwkkkkwk',
  'kwwkkkkkwk',
  'kwkkkwkkwk',
  'kwkkwwwkwk',
  'kwwwwwwwwk',
  'kwwwwwwwwk',
  'kkkkkkkkkk',
])

export const icons = {
  binEmpty,
  binFull,
  calculator,
  document,
  drive: program,
  folderClosed,
  folderOpened,
  games,
  myComputer,
  program,
  shortcutArrow,
  windowsLogo,
  start: {
    programs: folderClosed,
    documents: folderOpened,
    settings: folderClosed,
    find: document,
    help: document,
    run: program,
    shutDown: myComputer,
  },
} as const
