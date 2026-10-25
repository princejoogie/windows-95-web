import { pixelArt } from '../../icons/pixel'
import type { Brush, FillMode } from './bitmap'

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
  | 'curve'
  | 'rectangle'
  | 'polygon'
  | 'ellipse'
  | 'rounded'

/** What the box under the tools offers for each tool. */
export type OptionKind = 'none' | 'opaque' | 'eraser' | 'zoom' | 'brush' | 'spray' | 'width' | 'fill'

export interface Options {
  /** Line, Curve, and shape borders. */
  width: number
  eraser: number
  brush: Brush
  brushSize: number
  spray: number
  fill: FillMode
  /** Select tools and Text draw the background color too, unless transparent. */
  opaque: boolean
}

export const defaultOptions: Options = {
  width: 1,
  eraser: 8,
  brush: 'round',
  brushSize: 4,
  spray: 4,
  fill: 'outline',
  opaque: true,
}

export const widths = [1, 2, 3, 4, 5] as const
export const eraserSizes = [4, 6, 8, 10] as const
export const zoomLevels = [1, 2, 6, 8] as const
export const sprayRadii = [4, 8, 12] as const
export const brushes: readonly { brush: Brush; size: number }[] = (
  ['round', 'square', 'slash', 'backslash'] as const
).flatMap((brush) => (brush === 'round' ? [7, 4, 1] : [8, 5, 2]).map((size) => ({ brush, size })))

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
  curve: [
    '..kk',
    '.k..k',
    'k....k',
    'k.....k',
    '.......k',
    '........k....k',
    '.........k..k',
    '..........kk',
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
  polygon: [
    '...kkkkkk',
    '..k.....k',
    '.k......k',
    'k.......kkkk',
    'k..........k',
    '.k.........k',
    '..k........k',
    '...kkkkkkkkk',
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

export interface ToolInfo {
  readonly id: Tool
  readonly label: string
  /** The status bar text while the pointer is over the tool. */
  readonly help: string
  readonly options: OptionKind
  readonly icon: string
}

/** The Windows 95 tool box, two columns of eight, in reading order. */
export const tools: readonly ToolInfo[] = (
  [
    [
      'freeSelect',
      'Free-Form Select',
      'Selects a free-form part of the picture to move, copy, or edit.',
      'opaque',
    ],
    ['select', 'Select', 'Selects a rectangular part of the picture to move, copy, or edit.', 'opaque'],
    [
      'eraser',
      'Eraser/Color Eraser',
      'Erases a portion of the picture, using the selected eraser shape.',
      'eraser',
    ],
    ['fill', 'Fill With Color', 'Fills an area with the current drawing color.', 'none'],
    ['picker', 'Pick Color', 'Picks up a color from the picture for drawing.', 'none'],
    ['zoom', 'Magnifier', 'Changes the magnification.', 'zoom'],
    ['pencil', 'Pencil', 'Draws a free-form line one pixel wide.', 'none'],
    ['brush', 'Brush', 'Draws using a brush with the selected shape and size.', 'brush'],
    ['spray', 'Airbrush', 'Draws using an airbrush of the selected size.', 'spray'],
    ['text', 'Text', 'Inserts text into the picture.', 'opaque'],
    ['line', 'Line', 'Draws a straight line with the selected line width.', 'width'],
    ['curve', 'Curve', 'Draws a curved line with the selected line width.', 'width'],
    ['rectangle', 'Rectangle', 'Draws a rectangle with the selected fill style.', 'fill'],
    ['polygon', 'Polygon', 'Draws a polygon with the selected fill style.', 'fill'],
    ['ellipse', 'Ellipse', 'Draws an ellipse with the selected fill style.', 'fill'],
    ['rounded', 'Rounded Rectangle', 'Draws a rounded rectangle with the selected fill style.', 'fill'],
  ] satisfies [Tool, string, string, OptionKind][]
).map(([id, label, help, options]) => ({
  id,
  label,
  help,
  options,
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
