/**
 * Pixels are packed for `ImageData` on little-endian machines: 0xAABBGGRR. A pixel of 0 is transparent
 * in sprites.
 */
export const rgb = (r: number, g: number, b: number): number =>
  (0xff000000 | (clampByte(b) << 16) | (clampByte(g) << 8) | clampByte(r)) >>> 0

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0)

export const red = (c: number) => c & 0xff
export const green = (c: number) => (c >>> 8) & 0xff
export const blue = (c: number) => (c >>> 16) & 0xff

/** Scales a color's brightness. */
export const shade = (c: number, f: number): number => rgb(red(c) * f, green(c) * f, blue(c) * f)

export const mix = (a: number, b: number, t: number): number =>
  rgb(red(a) + (red(b) - red(a)) * t, green(a) + (green(b) - green(a)) * t, blue(a) + (blue(b) - blue(a)) * t)

export interface Bitmap {
  readonly width: number
  readonly height: number
  /** Row-major. */
  readonly pixels: Uint32Array
}

export const createBitmap = (width: number, height: number): Bitmap => ({
  width,
  height,
  pixels: new Uint32Array(width * height),
})

/** A small immediate-mode painter for generating textures and sprites in code. */
export class Painter {
  constructor(readonly bitmap: Bitmap) {}

  static create(width: number, height: number): Painter {
    return new Painter(createBitmap(width, height))
  }

  get width() {
    return this.bitmap.width
  }

  get height() {
    return this.bitmap.height
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0
    return this.bitmap.pixels[(y | 0) * this.width + (x | 0)] ?? 0
  }

  set(x: number, y: number, c: number): void {
    x = Math.floor(x)
    y = Math.floor(y)
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    this.bitmap.pixels[y * this.width + x] = c
  }

  rect(x: number, y: number, w: number, h: number, c: number | ((x: number, y: number) => number)): void {
    for (let j = Math.floor(y); j < y + h; j++)
      for (let i = Math.floor(x); i < x + w; i++) this.set(i, j, typeof c === 'number' ? c : c(i, j))
  }

  /** A raised or sunken box: light on two edges and dark on the other two. */
  bevel(x: number, y: number, w: number, h: number, light: number, dark: number): void {
    this.rect(x, y, w, 1, light)
    this.rect(x, y, 1, h, light)
    this.rect(x, y + h - 1, w, 1, dark)
    this.rect(x + w - 1, y, 1, h, dark)
  }

  /** A filled ellipse lit from the upper left, so blobs read as round. */
  ball(cx: number, cy: number, rx: number, ry: number, c: number, lit = true): void {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const nx = (x + 0.5 - cx) / rx
        const ny = (y + 0.5 - cy) / ry
        const d = nx * nx + ny * ny
        if (d > 1) continue
        this.set(x, y, lit ? shade(c, 0.75 + 0.45 * (-nx * 0.5 - ny * 0.6) * Math.sqrt(1 - d * 0.5)) : c)
      }
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: number): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
    for (let i = 0; i <= steps; i++) this.set(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, c)
  }

  /** A thick line made of round dabs, for limbs. */
  limb(x0: number, y0: number, x1: number, y1: number, r: number, c: number): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1) * 2
    for (let i = 0; i <= steps; i++)
      this.ball(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, r, r, c)
  }

  /** Darkens every opaque pixel that touches transparency, so sprites hold their shape against walls. */
  outline(f = 0.45): void {
    const { width, height, pixels } = this.bitmap
    const edge: number[] = []
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!pixels[y * width + x]) continue
        if (!this.get(x - 1, y) || !this.get(x + 1, y) || !this.get(x, y - 1) || !this.get(x, y + 1))
          edge.push(y * width + x)
      }
    }
    for (const i of edge) pixels[i] = shade(pixels[i] ?? 0, f)
  }

  /** Multiplies opaque pixels by a little noise. */
  grain(rng: () => number, amount: number): void {
    const { pixels } = this.bitmap
    for (let i = 0; i < pixels.length; i++) {
      const c = pixels[i] ?? 0
      if (c) pixels[i] = shade(c, 1 + (rng() - 0.5) * amount)
    }
  }
}
