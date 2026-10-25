import { pixelArt } from '../../icons/pixel'

const mineRows = [
  '................',
  '.......k........',
  '..k....k....k...',
  '...k.kkkkk.k....',
  '....kkkkkkk.....',
  '...kkwwkkkkk....',
  '...kkwwkkkkk....',
  '.kkkkkkkkkkkkk..',
  '...kkkkkkkkk....',
  '...kkkkkkkkk....',
  '....kkkkkkk.....',
  '...k.kkkkk.k....',
  '..k....k....k...',
  '.......k........',
  '................',
  '................',
]

export const mineIcon = pixelArt(mineRows)
export const wrongFlagIcon = pixelArt(
  mineRows.map((row, y) => [...row].map((pixel, x) => (x === y || x === 15 - y ? 'r' : pixel)).join('')),
)
export const largeMineIcon = pixelArt(
  mineRows.flatMap((row) => {
    const doubled = [...row].map((pixel) => pixel + pixel).join('')
    return [doubled, doubled]
  }),
)

export const flagIcon = pixelArt([
  '................',
  '................',
  '.......r........',
  '.....rrr........',
  '...rrrrr........',
  '.....rrr........',
  '.......k........',
  '.......k........',
  '.......k........',
  '.....kkkk.......',
  '...kkkkkkkk.....',
  '................',
  '................',
  '................',
  '................',
  '................',
])

const faceBase = [
  '.....kkkkkk.....',
  '...kkyyyyyykk...',
  '..kyyyyyyyyyyk..',
  '.kyyyyyyyyyyyyk.',
  '.kyyyyyyyyyyyyk.',
  'kyyykkyyyykkyyyk',
  'kyyykkyyyykkyyyk',
  'kyyyyyyyyyyyyyyk',
  'kyyyyyyyyyyyyyyk',
  'kyyyyyyyyyyyyyyk',
  'kyykyyyyyyyykyyk',
  '.kyykyyyyyykyyk.',
  '.kyyykkkkkkyyyk.',
  '..kyyyyyyyyyyk..',
  '...kkyyyyyykk...',
  '.....kkkkkk.....',
]

function face(variant: 'smile' | 'surprised' | 'dead' | 'win'): string {
  const rows = [...faceBase]
  if (variant === 'surprised' || variant === 'dead') {
    rows[10] = 'kyyyyyyyyyyyyyyk'
    rows[11] = '.kyyyyyyyyyyyyk.'
    rows[12] = '.kyyyyyyyyyyyyk.'
  }
  if (variant === 'surprised') {
    rows[9] = 'kyyyyyykkyyyyyyk'
    rows[10] = 'kyyyyykyykyyyyyk'
    rows[11] = '.kyyyykyykyyyyk.'
    rows[12] = '.kyyyyykkyyyyyk.'
  }
  if (variant === 'dead') {
    rows[4] = '.kykykyyykykyyk.'
    rows[5] = 'kyyykyyyyykyyyyk'
    rows[6] = 'kyykykyyykykyyyk'
    rows[10] = 'kyyyykkkkkkyyyyk'
    rows[11] = '.kyykyyyyyykyyk.'
  }
  if (variant === 'win') {
    rows[4] = '.kkkkkkkkkkkkkk.'
    rows[5] = 'kyykkkkyykkkkyyk'
    rows[6] = 'kyyykkyyyykkyyyk'
  }
  return pixelArt(rows)
}

export const faces = {
  smile: face('smile'),
  surprised: face('surprised'),
  dead: face('dead'),
  win: face('win'),
}
