import { pixelArt } from '../../icons/pixel'

export type Tool =
  | 'freeSelect'
  | 'select'
  | 'eraser'
  | 'fill'
  | 'picker'
  | 'zoom'
  | 'pencil'
  | 'brush'
  | 'spray'
  | 'text'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'rounded'
const art: Record<Tool, string[]> = {
  freeSelect: ['...k.k.k', '.k......k', 'k...kk....k', '.k..k...k', '..k...k'],
  select: ['k.k.k.k.k.k', '', 'k.........k', '', 'k.........k', '', 'k.........k', '', 'k.k.k.k.k.k'],
  eraser: ['....kkkkkk', '...kmmmmmk', '..kmmmmmk.k', '.kmmmmmk..k', 'kkkkkkk..k', 'ksssssk.k', 'kkkkkkk'],
  fill: [
    '....kk',
    '...k..k',
    '..k....k',
    '.k......k',
    'k........k',
    '.kkkkkkkk.b',
    '..bbbbbb..bb',
    '...bbbb....b',
  ],
  picker: ['........kk', '.......kkkk', '......kkkk', '.....kkk', '....kwk', '...kwk', '..kwk', '.kkk', 'kk'],
  zoom: ['..kkkk', '.kwwwwk', 'kwwwwwwk', 'kwwwwwwk', '.kwwwwkk', '..kkkk.kk', '........kk', '.........kk'],
  pencil: [
    '........kk',
    '.......kyk',
    '......kyyk',
    '.....kyyk',
    '....kyyk',
    '...kyyk',
    '..kwkk',
    '.kwk',
    'kkk',
  ],
  brush: [
    '........kk',
    '.......kYk',
    '......kYk',
    '.....kYk',
    '....kkk',
    '...kkkk',
    '..kkkkk',
    '.kkkkk',
    'kkkkk',
  ],
  spray: [
    '......k..k',
    '.kkkk...k',
    'ksssskk...k',
    'ksssssk.k',
    'ksssssk...k',
    'ksssssk',
    'ksssssk',
    'kkkkkkk',
  ],
  text: [
    '....kkk',
    '...kk.kk',
    '..kk...kk',
    '..kk...kk',
    '.kkkkkkkkk',
    '.kk.....kk',
    'kk.......kk',
    'kk.......kk',
  ],
  line: [
    '..........k',
    '.........k',
    '........k',
    '.......k',
    '......k',
    '.....k',
    '....k',
    '...k',
    '..k',
    '.k',
    'k',
  ],
  rectangle: [
    'kkkkkkkkkkk',
    'k.........k',
    'k.........k',
    'k.........k',
    'k.........k',
    'k.........k',
    'k.........k',
    'k.........k',
    'kkkkkkkkkkk',
  ],
  ellipse: ['...kkkkk', '.kk.....kk', 'k.........k', 'k.........k', 'k.........k', '.kk.....kk', '...kkkkk'],
  rounded: [
    '..kkkkkkk',
    '.k.......k',
    'k.........k',
    'k.........k',
    'k.........k',
    'k.........k',
    '.k.......k',
    '..kkkkkkk',
  ],
}
export const tools: readonly { id: Tool; label: string; icon: string }[] = (
  [
    ['freeSelect', 'Free-Form Select'],
    ['select', 'Select'],
    ['eraser', 'Eraser'],
    ['fill', 'Fill With Color'],
    ['picker', 'Pick Color'],
    ['zoom', 'Magnifier'],
    ['pencil', 'Pencil'],
    ['brush', 'Brush'],
    ['spray', 'Airbrush'],
    ['text', 'Text'],
    ['line', 'Line'],
    ['rectangle', 'Rectangle'],
    ['ellipse', 'Ellipse'],
    ['rounded', 'Rounded Rectangle'],
  ] satisfies [Tool, string][]
).map(([id, label]) => ({
  id,
  label,
  icon: pixelArt(Array.from({ length: 16 }, (_, y) => `..${art[id][y - 2] ?? ''}`.padEnd(16, '.'))),
}))

export const palette = [
  '#000000',
  '#808080',
  '#800000',
  '#808000',
  '#008000',
  '#008080',
  '#000080',
  '#800080',
  '#808040',
  '#004040',
  '#0080ff',
  '#004080',
  '#8000ff',
  '#804000',
  '#ffffff',
  '#c0c0c0',
  '#ff0000',
  '#ffff00',
  '#00ff00',
  '#00ffff',
  '#0000ff',
  '#ff00ff',
  '#ffff80',
  '#00ff80',
  '#80ffff',
  '#8080ff',
  '#ff0080',
  '#ff8040',
]
export const paintIcon = pixelArt(
  Array.from({ length: 32 }, (_, y) =>
    Array.from({ length: 32 }, (_, x) => {
      if (x + y > 31 && x + y < 37 && x > 13 && y < 21) return x + y === 32 || x + y === 36 ? 'k' : 'Y'
      if (x > 12 && x < 19 && y > 15 && y < 25) return 'k'
      const distance = ((x - 14) / 13) ** 2 + ((y - 18) / 11) ** 2
      if (distance > 1) return '.'
      if (distance > 0.8) return 'k'
      if ((x - 7) ** 2 + (y - 16) ** 2 < 8) return 'r'
      if ((x - 12) ** 2 + (y - 11) ** 2 < 7) return 'y'
      if ((x - 20) ** 2 + (y - 13) ** 2 < 8) return 'b'
      if ((x - 7) ** 2 + (y - 23) ** 2 < 7) return 'L'
      if ((x - 19) ** 2 + (y - 23) ** 2 < 6) return '.'
      return 's'
    }).join(''),
  ),
)
