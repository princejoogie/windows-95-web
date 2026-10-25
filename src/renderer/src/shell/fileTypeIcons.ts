import { large } from '../icons/art'
import { pixelArt } from '../icons/pixel'

const GEAR = [
  '.....k.....',
  '..k.kgk.k..',
  '.kgkgggkgk.',
  '..kgsssgk..',
  '.kgsswssgk.',
  'kggswwwsggk',
  '.kgsswssgk.',
  '..kgsssgk..',
  '.kgkgggkgk.',
  '..k.kgk.k..',
  '.....k.....',
]

const PICTURE = [
  'kkkkkkkkkkkk',
  'kccccccyyyck',
  'kccccccyyyck',
  'kcccccccccck',
  'kccLLcccccck',
  'kcLLLLccLLck',
  'kLLLLLLLLLLk',
  'kllllllllllk',
  'kkkkkkkkkkkk',
]

const WINDOW = [
  'kkkkkkkkkkkkkkkkkkkkkkkk',
  'kBBBBBBBBBBBBBBBBBBBBBBk',
  'kBwwBBBBBBBBBBBBBBBBBBBk',
  'kkkkkkkkkkkkkkkkkkkkkkkk',
  ...Array.from({ length: 15 }, () => 'kwwwwwwwwwwwwwwwwwwwwwwk'),
  'kkkkkkkkkkkkkkkkkkkkkkkk',
]

const blank = (size: number) => Array.from({ length: size }, () => '.'.repeat(size))

/** Draws `art` over `base` with its top-left corner at x, y. Transparent pixels in `art` let `base` show. */
function stamp(base: readonly string[], art: readonly string[], x: number, y: number): string[] {
  return base.map((row, at) => {
    const line = art[at - y]
    if (!line) return row
    return [...row]
      .map((pixel, column) => (line[column - x] && line[column - x] !== '.' ? line[column - x] : pixel))
      .join('')
  })
}

/** The 32x32 pictures Windows 95 gives registered document types that have no program of their own here. */
export const fileTypeIcons: Readonly<Record<string, string>> = (() => {
  const system = pixelArt(stamp(large.document, GEAR, 17, 18))
  const msdos = stamp(blank(32), WINDOW, 4, 6)
  return {
    txt: pixelArt(large.textDocument),
    log: pixelArt(large.textDocument),
    sys: system,
    ini: system,
    bat: pixelArt(stamp(msdos, GEAR, 19, 19)),
    com: pixelArt(msdos),
    exe: pixelArt(msdos),
    bmp: pixelArt(stamp(large.document, PICTURE, 9, 14)),
    dib: pixelArt(stamp(large.document, PICTURE, 9, 14)),
  }
})()
