import { type Bitmap, clone, type Rect, rgb } from './bitmap'

export interface TextStyle {
  font: string
  /** Points, as the Fonts toolbar lists them. */
  size: number
  bold: boolean
  italic: boolean
  underline: boolean
}

export const fonts = [
  'Arial',
  'Courier New',
  'MS Sans Serif',
  'Times New Roman',
  'Symbol',
  'Wingdings',
] as const
export const sizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72] as const
export const defaultTextStyle: TextStyle = {
  font: 'Arial',
  size: 10,
  bold: false,
  italic: false,
  underline: false,
}

/** Pixel size at 96 DPI. */
export const pixels = (style: TextStyle) => Math.round((style.size * 96) / 72)
export const lineHeight = (style: TextStyle) => Math.ceil(pixels(style) * 1.15)
export const cssFont = (style: TextStyle, zoom = 1) =>
  `${style.italic ? 'italic ' : ''}${style.bold ? 'bold ' : ''}${pixels(style) * zoom}px "${style.font}"`

/** Breaks text into lines no wider than `width`, at spaces where it can and mid-word where it must. */
export function wrap(text: string, width: number, measure: (line: string) => number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    for (const word of paragraph.split(/(?<= )/)) {
      if (measure(line + word) <= width || !line) line += word
      else {
        lines.push(line)
        line = word
      }
      while (line.length > 1 && measure(line.trimEnd()) > width) {
        let split = line.length - 1
        while (split > 1 && measure(line.slice(0, split)) > width) split--
        lines.push(line.slice(0, split))
        line = line.slice(split)
      }
    }
    lines.push(line)
  }
  return lines
}

/**
 * Stamps text into the frame without antialiasing, as Windows 95 drew it: a glyph pixel is ink when the
 * browser covers at least half of it.
 */
export function drawText(
  image: Bitmap,
  frame: Rect,
  text: string,
  style: TextStyle,
  color: string,
  background: string | null,
): Bitmap {
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  const context = canvas.getContext('2d')
  if (!context) return image
  context.font = cssFont(style)
  context.textBaseline = 'top'
  context.fillStyle = '#000'
  const height = lineHeight(style),
    size = pixels(style)
  wrap(text, frame.width, (line) => context.measureText(line).width).forEach((line, index) => {
    const top = index * height + Math.floor((height - size) / 2)
    context.fillText(line, 0, top)
    if (style.underline && line.trim())
      context.fillRect(
        0,
        top + size,
        context.measureText(line.trimEnd()).width,
        Math.max(1, Math.round(size / 14)),
      )
  })
  const glyphs = context.getImageData(0, 0, frame.width, frame.height).data
  const next = clone(image),
    ink = rgb(color),
    paper = background ? rgb(background) : null
  for (let y = 0; y < frame.height; y++)
    for (let x = 0; x < frame.width; x++) {
      const tx = frame.x + x,
        ty = frame.y + y
      if (tx < 0 || ty < 0 || tx >= image.width || ty >= image.height) continue
      const channels = (glyphs[(y * frame.width + x) * 4 + 3] ?? 0) >= 128 ? ink : paper
      if (channels) next.pixels.set([...channels, 255], (ty * image.width + tx) * 4)
    }
  return next
}
