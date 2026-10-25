import { pixelArt } from '../../icons/pixel'

export class Pixels {
  readonly rows: string[][]
  constructor(
    readonly width: number,
    readonly height: number,
    fill = '.',
  ) {
    this.rows = Array.from({ length: height }, () => Array.from({ length: width }, () => fill))
  }
  dot(x: number, y: number, color: string) {
    const row = this.rows[y]
    if (row && x >= 0 && x < this.width) row[x] = color
  }
  rect(x: number, y: number, width: number, height: number, color: string) {
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) this.dot(x + dx, y + dy, color)
  }
  line(x: number, y: number, endX: number, endY: number, color: string) {
    const dx = Math.abs(endX - x)
    const dy = -Math.abs(endY - y)
    const sx = x < endX ? 1 : -1
    const sy = y < endY ? 1 : -1
    let error = dx + dy
    while (true) {
      this.dot(x, y, color)
      if (x === endX && y === endY) break
      const doubled = 2 * error
      if (doubled >= dy) {
        error += dy
        x += sx
      }
      if (doubled <= dx) {
        error += dx
        y += sy
      }
    }
  }
  oval(cx: number, cy: number, rx: number, ry: number, color: string) {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++)
        if (x * x * ry * ry + y * y * rx * rx <= rx * rx * ry * ry) this.dot(cx + x, cy + y, color)
  }
  stamp(rows: readonly string[], x: number, y: number, color?: string, inverted = false, scale = 1) {
    rows.forEach((row, dy) => {
      Array.from(row).forEach((pixel, dx) => {
        if (pixel === '.') return
        const px = inverted ? row.length - dx - 1 : dx
        const py = inverted ? rows.length - dy - 1 : dy
        this.rect(x + px * scale, y + py * scale, scale, scale, color ?? pixel)
      })
    })
  }
  image() {
    return pixelArt(this.rows.map((row) => row.join('')))
  }
}

export function cardFrame(): Pixels {
  const pixels = new Pixels(71, 96)
  pixels.rect(2, 0, 67, 96, 'k')
  pixels.rect(0, 2, 71, 92, 'k')
  pixels.rect(2, 1, 67, 94, 'w')
  pixels.rect(1, 2, 69, 92, 'w')
  return pixels
}
