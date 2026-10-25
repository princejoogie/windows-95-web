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
export type Brush = 'square' | 'round' | 'diagonal'
export type Shape = 'line' | 'rectangle' | 'ellipse' | 'rounded'
export type FillMode = 'outline' | 'both' | 'solid'
export interface Ink {
  foreground: string
  background: string
  width: number
  brush: Brush
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
export function bitmap(width: number, height: number, color = '#ffffff'): Bitmap {
  const result = { width, height, pixels: new Uint8ClampedArray(width * height * 4) }
  const channels = rgb(color)
  for (let i = 0; i < result.pixels.length; i += 4) result.pixels.set([...channels, 255], i)
  return result
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
  return `#${Array.from(image.pixels.slice(offset, offset + 3), (channel) => channel.toString(16).padStart(2, '0')).join('')}`
}
export function bounds(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x) + 1,
    height: Math.abs(a.y - b.y) + 1,
  }
}
function stamp(image: Bitmap, point: Point, color: readonly number[], width: number, brush: Brush) {
  const low = -Math.floor(width / 2)
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) {
      if (brush === 'round' && (x - (width - 1) / 2) ** 2 + (y - (width - 1) / 2) ** 2 > (width / 2) ** 2)
        continue
      if (brush === 'diagonal' && x + y !== width - 1) continue
      pixel(image, point.x + low + x, point.y + low + y, color)
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
  const channels = rgb(color)
  let { x, y } = from
  const dx = Math.abs(to.x - x),
    dy = -Math.abs(to.y - y)
  const sx = x < to.x ? 1 : -1,
    sy = y < to.y ? 1 : -1
  let error = dx + dy
  while (true) {
    stamp(next, { x, y }, channels, width, brush)
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
  return next
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
export function select(image: Bitmap, from: Point, to: Point, polygon?: readonly Point[]): Selection {
  const rect = bounds(from, to),
    mask = new Uint8Array(rect.width * rect.height)
  for (let y = 0; y < rect.height; y++)
    for (let x = 0; x < rect.width; x++) {
      const px = rect.x + x,
        py = rect.y + y
      let inside = !polygon
      if (polygon)
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const a = polygon[i],
            b = polygon[j]
          if (a && b && a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x)
            inside = !inside
        }
      if (inside && px >= 0 && py >= 0 && px < image.width && py < image.height) mask[y * rect.width + x] = 1
    }
  return { ...rect, mask }
}
export function moveSelection(
  image: Bitmap,
  selection: Selection,
  destination: Point,
  background: string,
): Bitmap {
  const next = clone(image),
    channels = rgb(background)
  for (let y = 0; y < selection.height; y++)
    for (let x = 0; x < selection.width; x++) {
      if (selection.mask[y * selection.width + x]) pixel(next, selection.x + x, selection.y + y, channels)
    }
  for (let y = 0; y < selection.height; y++)
    for (let x = 0; x < selection.width; x++) {
      if (!selection.mask[y * selection.width + x]) continue
      const offset = ((selection.y + y) * image.width + selection.x + x) * 4
      pixel(next, destination.x + x, destination.y + y, image.pixels.subarray(offset, offset + 3))
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
export function transform(
  image: Bitmap,
  kind: 'horizontal' | 'vertical' | '90' | '180' | '270' | 'invert',
): Bitmap {
  const quarter = kind === '90' || kind === '270'
  const next = bitmap(quarter ? image.height : image.width, quarter ? image.width : image.height)
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
      const channels = image.pixels.slice(offset, offset + 3)
      pixel(next, tx, ty, kind === 'invert' ? channels.map((channel) => 255 - channel) : channels)
    }
  return next
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
