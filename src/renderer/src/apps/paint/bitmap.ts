export interface Bitmap {
  readonly width: number
  readonly height: number
  readonly pixels: Uint8ClampedArray
}
export interface Point {
  x: number
  y: number
}
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}
export interface Selection extends Rect {
  readonly mask: Uint8Array
}
/** Pixels lifted off the canvas or pasted. Alpha 0 marks pixels outside the shape they were cut in. */
export type Piece = Bitmap
export type Brush = 'round' | 'square' | 'slash' | 'backslash'
export type Shape = 'line' | 'rectangle' | 'ellipse' | 'rounded'
export type FillMode = 'outline' | 'both' | 'solid'
export type Transform = 'horizontal' | 'vertical' | '90' | '180' | '270' | 'invert'
/** Bits per pixel of the four Save As types. */
export type Depth = 1 | 4 | 8 | 24
export interface Ink {
  foreground: string
  background: string
  /** Line, Curve, and shape borders, 1 to 5 pixels. */
  width: number
  fill: FillMode
}
export interface History {
  readonly past: readonly Bitmap[]
  readonly present: Bitmap
  readonly future: readonly Bitmap[]
}

export function rgb(color: string): readonly [number, number, number] {
  return [
    Number.parseInt(color.slice(1, 3), 16),
    Number.parseInt(color.slice(3, 5), 16),
    Number.parseInt(color.slice(5, 7), 16),
  ]
}
export function hex(channels: readonly number[]): string {
  return `#${channels
    .slice(0, 3)
    .map((channel) => Math.round(channel).toString(16).padStart(2, '0'))
    .join('')}`
}
export function bitmap(width: number, height: number, color = '#ffffff'): Bitmap {
  const result = { width, height, pixels: new Uint8ClampedArray(width * height * 4) }
  const channels = rgb(color)
  for (let i = 0; i < result.pixels.length; i += 4) result.pixels.set([...channels, 255], i)
  return result
}
function blank(width: number, height: number): Bitmap {
  return { width, height, pixels: new Uint8ClampedArray(width * height * 4) }
}
export function clone(image: Bitmap): Bitmap {
  return { ...image, pixels: image.pixels.slice() }
}
function pixel(image: Bitmap, x: number, y: number, channels: Iterable<number>) {
  if (x >= 0 && y >= 0 && x < image.width && y < image.height)
    image.pixels.set([...channels, 255], (y * image.width + x) * 4)
}
export function colorAt(image: Bitmap, point: Point): string {
  const offset =
    (Math.max(0, Math.min(image.height - 1, point.y)) * image.width +
      Math.max(0, Math.min(image.width - 1, point.x))) *
    4
  return hex(Array.from(image.pixels.slice(offset, offset + 3)))
}
export function bounds(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x) + 1,
    height: Math.abs(a.y - b.y) + 1,
  }
}
export function boundsOf(points: readonly Point[]): Rect {
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y)
  return bounds({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) })
}
function stamp(image: Bitmap, point: Point, color: readonly number[], width: number, brush: Brush) {
  const low = -Math.floor(width / 2)
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      if (brush === 'round' && (x - (width - 1) / 2) ** 2 + (y - (width - 1) / 2) ** 2 > (width / 2) ** 2)
        continue
      if (brush === 'slash' && x + y !== width - 1) continue
      if (brush === 'backslash' && x !== y) continue
      pixel(image, point.x + low + x, point.y + low + y, color)
    }
}
function line(target: Bitmap, from: Point, to: Point, color: readonly number[], width: number, brush: Brush) {
  let { x, y } = from
  const dx = Math.abs(to.x - x),
    dy = -Math.abs(to.y - y)
  const sx = x < to.x ? 1 : -1,
    sy = y < to.y ? 1 : -1
  let error = dx + dy
  while (true) {
    stamp(target, { x, y }, color, width, brush)
    if (x === to.x && y === to.y) break
    const twice = 2 * error
    if (twice >= dy) {
      error += dy
      x += sx
    }
    if (twice <= dx) {
      error += dx
      y += sy
    }
  }
}
export function stroke(
  image: Bitmap,
  from: Point,
  to: Point,
  color: string,
  width = 1,
  brush: Brush = 'square',
): Bitmap {
  const next = clone(image)
  line(next, from, to, rgb(color), width, brush)
  return next
}
/** The Color Eraser: along the stroke, only pixels of the `target` color change to `replacement`. */
export function recolor(
  image: Bitmap,
  from: Point,
  to: Point,
  size: number,
  target: string,
  replacement: string,
): Bitmap {
  const marks = blank(image.width, image.height)
  line(marks, from, to, [0, 0, 0], size, 'square')
  const next = clone(image),
    match = rgb(target),
    channels = rgb(replacement)
  for (let i = 0; i < next.pixels.length; i += 4)
    if (
      marks.pixels[i + 3] &&
      next.pixels[i] === match[0] &&
      next.pixels[i + 1] === match[1] &&
      next.pixels[i + 2] === match[2]
    )
      next.pixels.set(channels, i)
  return next
}
export function polyline(
  image: Bitmap,
  points: readonly Point[],
  color: string,
  width = 1,
  closed = false,
): Bitmap {
  const next = clone(image),
    channels = rgb(color)
  const path = closed ? [...points, points[0]] : points
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1],
      to = path[i]
    if (from && to) line(next, from, to, channels, width, 'square')
  }
  if (path.length === 1 && path[0]) stamp(next, path[0], channels, width, 'square')
  return next
}
/** The pixels along a cubic Bezier from `start` to `end`. One control point bends it like two equal ones. */
export function bezier(start: Point, end: Point, controls: readonly Point[]): Point[] {
  const c1 = controls[0] ?? start,
    c2 = controls[1] ?? controls[0] ?? end
  const span = [start, c1, c2, end].reduce((total, point, index, all) => {
    const previous = all[index - 1]
    return previous ? total + Math.hypot(point.x - previous.x, point.y - previous.y) : total
  }, 0)
  const steps = Math.max(1, Math.ceil(span))
  const points: Point[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      u = 1 - t
    const a = u * u * u,
      b = 3 * u * u * t,
      c = 3 * u * t * t,
      d = t * t * t
    const point = {
      x: Math.round(a * start.x + b * c1.x + c * c2.x + d * end.x),
      y: Math.round(a * start.y + b * c1.y + c * c2.y + d * end.y),
    }
    const last = points.at(-1)
    if (!last || last.x !== point.x || last.y !== point.y) points.push(point)
  }
  return points
}
export function curve(
  image: Bitmap,
  start: Point,
  end: Point,
  controls: readonly Point[],
  color: string,
  width = 1,
): Bitmap {
  return polyline(image, bezier(start, end, controls), color, width)
}
function insidePolygon(polygon: readonly Point[], px: number, py: number): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j]
    if (a && b && a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x)
      inside = !inside
  }
  return inside
}
export function polygon(image: Bitmap, vertices: readonly Point[], ink: Ink): Bitmap {
  const filled = ink.fill === 'outline' ? image : clone(image)
  if (ink.fill !== 'outline') {
    const channels = rgb(ink.fill === 'solid' ? ink.foreground : ink.background)
    const box = boundsOf(vertices)
    for (let y = box.y; y < box.y + box.height; y++)
      for (let x = box.x; x < box.x + box.width; x++)
        if (insidePolygon(vertices, x + 0.5, y + 0.5)) pixel(filled, x, y, channels)
  }
  return polyline(filled, vertices, ink.foreground, ink.fill === 'solid' ? 1 : ink.width, true)
}
export function shape(image: Bitmap, kind: Shape, from: Point, to: Point, ink: Ink): Bitmap {
  if (kind === 'line') return stroke(image, from, to, ink.foreground, ink.width)
  const next = clone(image)
  const rect = bounds(from, to)
  const foreground = rgb(ink.foreground),
    background = rgb(ink.background)
  const inside = (x: number, y: number, inset: number) => {
    const width = rect.width - 2 * inset,
      height = rect.height - 2 * inset
    if (
      width <= 0 ||
      height <= 0 ||
      x < inset ||
      y < inset ||
      x >= rect.width - inset ||
      y >= rect.height - inset
    )
      return false
    if (kind === 'rectangle') return true
    if (kind === 'ellipse')
      return (
        ((x - (rect.width - 1) / 2) / (width / 2)) ** 2 + ((y - (rect.height - 1) / 2) / (height / 2)) ** 2 <=
        1
      )
    const radius = Math.min(8, width / 3, height / 3)
    const cx = Math.max(inset + radius, Math.min(rect.width - inset - radius - 1, x))
    const cy = Math.max(inset + radius, Math.min(rect.height - inset - radius - 1, y))
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
  }
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++) {
      if (!inside(x, y, 0)) continue
      const border = !inside(x, y, ink.width)
      if (ink.fill === 'solid' || border) pixel(next, rect.x + x, rect.y + y, foreground)
      else if (ink.fill === 'both') pixel(next, rect.x + x, rect.y + y, background)
    }
  return next
}
export function flood(image: Bitmap, point: Point, color: string): Bitmap {
  if (
    point.x < 0 ||
    point.y < 0 ||
    point.x >= image.width ||
    point.y >= image.height ||
    colorAt(image, point) === color
  )
    return image
  const next = clone(image),
    channels = rgb(color),
    target = rgb(colorAt(image, point))
  const stack = [point.y * image.width + point.x]
  while (stack.length) {
    const index = stack.pop()
    if (index === undefined) break
    const offset = index * 4
    if (
      next.pixels[offset] !== target[0] ||
      next.pixels[offset + 1] !== target[1] ||
      next.pixels[offset + 2] !== target[2]
    )
      continue
    next.pixels.set([...channels, 255], offset)
    const x = index % image.width,
      y = Math.floor(index / image.width)
    if (x > 0) stack.push(index - 1)
    if (x + 1 < image.width) stack.push(index + 1)
    if (y > 0) stack.push(index - image.width)
    if (y + 1 < image.height) stack.push(index + image.width)
  }
  return next
}
export function seededRandom(seed: number): () => number {
  let value = seed || 1
  return () => {
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    return (value >>> 0) / 4294967296
  }
}
export function spray(
  image: Bitmap,
  point: Point,
  color: string,
  radius: number,
  random: () => number,
): Bitmap {
  const next = clone(image),
    channels = rgb(color)
  for (let i = 0; i < radius * 3; i++) {
    const angle = random() * Math.PI * 2,
      distance = Math.sqrt(random()) * radius
    pixel(
      next,
      point.x + Math.round(Math.cos(angle) * distance),
      point.y + Math.round(Math.sin(angle) * distance),
      channels,
    )
  }
  return next
}
export function select(image: Bitmap, from: Point, to: Point, outline?: readonly Point[]): Selection {
  const rect = bounds(from, to),
    mask = new Uint8Array(rect.width * rect.height)
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++) {
      const px = rect.x + x,
        py = rect.y + y
      const inside = outline ? insidePolygon(outline, px, py) : true
      if (inside && px >= 0 && py >= 0 && px < image.width && py < image.height) mask[y * rect.width + x] = 1
    }
  return { ...rect, mask }
}
export function selectAll(image: Bitmap): Selection {
  return {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
    mask: new Uint8Array(image.width * image.height).fill(1),
  }
}
/** Copies the selected pixels into a piece the size of the selection. */
export function cut(image: Bitmap, selection: Selection): Piece {
  const piece = blank(selection.width, selection.height)
  for (let y = 0; y < selection.height; y++)
    for (let x = 0; x < selection.width; x++) {
      if (!selection.mask[y * selection.width + x]) continue
      const from = ((selection.y + y) * image.width + selection.x + x) * 4
      piece.pixels.set(image.pixels.subarray(from, from + 4), (y * selection.width + x) * 4)
    }
  return piece
}
/** Fills the selected pixels with the background, as Clear Selection and a lifted selection leave them. */
export function erase(image: Bitmap, selection: Selection, color: string): Bitmap {
  const next = clone(image),
    channels = rgb(color)
  for (let y = 0; y < selection.height; y++)
    for (let x = 0; x < selection.width; x++)
      if (selection.mask[y * selection.width + x]) pixel(next, selection.x + x, selection.y + y, channels)
  return next
}
/**
 * Draws a piece onto a copy of `base` with its top left at `at`. With `transparent` set, pixels of that
 * color are skipped, which is how Paint draws a selection in transparent mode.
 */
export function place(base: Bitmap, piece: Piece, at: Point, transparent?: string): Bitmap {
  const next = clone(base)
  const skip = transparent ? rgb(transparent) : null
  for (let y = 0; y < piece.height; y++)
    for (let x = 0; x < piece.width; x++) {
      const from = (y * piece.width + x) * 4
      if (!piece.pixels[from + 3]) continue
      const p = piece.pixels
      if (skip && p[from] === skip[0] && p[from + 1] === skip[1] && p[from + 2] === skip[2]) continue
      pixel(next, at.x + x, at.y + y, p.subarray(from, from + 3))
    }
  return next
}
export function resize(image: Bitmap, width: number, height: number, background: string): Bitmap {
  const next = bitmap(width, height, background)
  for (let y = 0; y < Math.min(height, image.height); y++)
    next.pixels.set(
      image.pixels.subarray(y * image.width * 4, (y * image.width + Math.min(width, image.width)) * 4),
      y * width * 4,
    )
  return next
}
export function transform(image: Bitmap, kind: Transform): Bitmap {
  const quarter = kind === '90' || kind === '270'
  const next = blank(quarter ? image.height : image.width, quarter ? image.width : image.height)
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const offset = (y * image.width + x) * 4
      let tx = x,
        ty = y
      if (kind === 'horizontal' || kind === '180') tx = image.width - 1 - x
      if (kind === 'vertical' || kind === '180') ty = image.height - 1 - y
      if (kind === '90') {
        tx = image.height - 1 - y
        ty = x
      }
      if (kind === '270') {
        tx = y
        ty = image.width - 1 - x
      }
      const channels = image.pixels.slice(offset, offset + 4)
      if (kind === 'invert') for (let c = 0; c < 3; c++) channels[c] = 255 - (channels[c] ?? 0)
      next.pixels.set(channels, (ty * next.width + tx) * 4)
    }
  return next
}
/** Scales by percentages, nearest neighbour, as Stretch does. */
export function stretch(image: Bitmap, horizontal: number, vertical: number): Bitmap {
  const width = Math.max(1, Math.round((image.width * horizontal) / 100)),
    height = Math.max(1, Math.round((image.height * vertical) / 100))
  const next = blank(width, height)
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const from =
        (Math.floor((y * image.height) / height) * image.width + Math.floor((x * image.width) / width)) * 4
      next.pixels.set(image.pixels.subarray(from, from + 4), (y * width + x) * 4)
    }
  return next
}
export function skewSize(width: number, height: number, horizontal: number, vertical: number) {
  const h = Math.tan((horizontal * Math.PI) / 180),
    v = Math.tan((vertical * Math.PI) / 180)
  const skewedWidth = width + Math.round((height - 1) * Math.abs(h))
  return { width: skewedWidth, height: height + Math.round((skewedWidth - 1) * Math.abs(v)) }
}
/**
 * Slants rows by `horizontal` degrees, then columns by `vertical` degrees. The picture grows to hold the
 * slant, and the new corners take `fill`, or stay transparent for a piece.
 */
export function skew(image: Bitmap, horizontal: number, vertical: number, fill?: string): Bitmap {
  const pass = (source: Bitmap, degrees: number, rows: boolean): Bitmap => {
    if (!degrees) return source
    const slope = Math.tan((degrees * Math.PI) / 180)
    const along = rows ? source.width : source.height,
      across = rows ? source.height : source.width
    const extra = Math.round((across - 1) * Math.abs(slope))
    const width = rows ? source.width + extra : source.width,
      height = rows ? source.height : source.height + extra
    const next = fill ? bitmap(width, height, fill) : blank(width, height)
    for (let a = 0; a < across; a++) {
      const shift = slope >= 0 ? Math.round(a * slope) : Math.round((across - 1 - a) * -slope)
      for (let i = 0; i < along; i++) {
        const sx = rows ? i : a,
          sy = rows ? a : i
        const tx = rows ? i + shift : a,
          ty = rows ? a : i + shift
        const from = (sy * source.width + sx) * 4
        next.pixels.set(source.pixels.subarray(from, from + 4), (ty * width + tx) * 4)
      }
    }
    return next
  }
  return pass(pass(image, horizontal, true), vertical, false)
}
const VGA = [
  '#000000',
  '#800000',
  '#008000',
  '#808000',
  '#000080',
  '#800080',
  '#008080',
  '#c0c0c0',
  '#808080',
  '#ff0000',
  '#00ff00',
  '#ffff00',
  '#0000ff',
  '#ff00ff',
  '#00ffff',
  '#ffffff',
].map(rgb)
const CUBE = Array.from({ length: 216 }, (_, i) => [
  Math.floor(i / 36) * 51,
  (Math.floor(i / 6) % 6) * 51,
  (i % 6) * 51,
])
export const palettes: Record<Exclude<Depth, 24>, readonly (readonly number[])[]> = {
  1: [
    [0, 0, 0],
    [255, 255, 255],
  ],
  4: VGA,
  8: [...VGA, ...CUBE],
}
/** Reduces the picture to the colors a bitmap of `depth` bits per pixel can hold. */
export function quantize(image: Bitmap, depth: Depth): Bitmap {
  if (depth === 24) return image
  const next = clone(image),
    colors = palettes[depth],
    cache = new Map<number, readonly number[]>()
  for (let i = 0; i < next.pixels.length; i += 4) {
    const r = next.pixels[i] ?? 0,
      g = next.pixels[i + 1] ?? 0,
      b = next.pixels[i + 2] ?? 0
    const key = (r << 16) | (g << 8) | b
    let best = cache.get(key)
    if (!best) {
      if (depth === 1) best = colors[r * 0.299 + g * 0.587 + b * 0.114 >= 128 ? 1 : 0]
      else {
        let distance = Number.POSITIVE_INFINITY
        for (const color of colors) {
          const d = ((color[0] ?? 0) - r) ** 2 + ((color[1] ?? 0) - g) ** 2 + ((color[2] ?? 0) - b) ** 2
          if (d < distance) {
            distance = d
            best = color
          }
        }
      }
      cache.set(key, best ?? [0, 0, 0])
    }
    next.pixels.set(best ?? [0, 0, 0], i)
  }
  return next
}
/** The size of a Windows .bmp file of this picture: headers, color table, and rows padded to 4 bytes. */
export function bmpBytes(width: number, height: number, depth: Depth): number {
  const table = depth === 24 ? 0 : 4 * 2 ** depth
  return 14 + 40 + table + Math.ceil((width * depth) / 32) * 4 * height
}
export function remember(history: History, image: Bitmap): History {
  if (image === history.present) return history
  return { past: [...history.past, history.present].slice(-3), present: image, future: [] }
}
export function undo(history: History): History {
  const previous = history.past.at(-1)
  return previous
    ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future] }
    : history
}
export function repeat(history: History): History {
  const next = history.future[0]
  return next
    ? { past: [...history.past, history.present].slice(-3), present: next, future: history.future.slice(1) }
    : history
}
