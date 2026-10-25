import { describe, expect, it } from 'vitest'
import {
  bezier,
  bitmap,
  bmpBytes,
  colorAt,
  curve,
  cut,
  erase,
  type Ink,
  place,
  polygon,
  quantize,
  select,
  selectAll,
  skew,
  skewSize,
  stretch,
  stroke,
  transform,
} from './bitmap'

const ink: Ink = { foreground: '#000000', background: '#ff0000', width: 1, fill: 'outline' }

describe('Curve tool', () => {
  it('draws a straight line before any bend', () => {
    const drawn = curve(bitmap(20, 20), { x: 2, y: 10 }, { x: 17, y: 10 }, [], '#000000')
    for (let x = 2; x <= 17; x++) expect(colorAt(drawn, { x, y: 10 })).toBe('#000000')
  })
  it('bends toward one control point and passes through both ends', () => {
    const points = bezier({ x: 0, y: 20 }, { x: 40, y: 20 }, [{ x: 20, y: 0 }])
    expect(points[0]).toEqual({ x: 0, y: 20 })
    expect(points.at(-1)).toEqual({ x: 40, y: 20 })
    expect(Math.min(...points.map((p) => p.y))).toBe(5)
    const drawn = curve(bitmap(41, 21), { x: 0, y: 20 }, { x: 40, y: 20 }, [{ x: 20, y: 0 }], '#000000')
    expect(colorAt(drawn, { x: 20, y: 5 })).toBe('#000000')
    expect(colorAt(drawn, { x: 20, y: 20 })).toBe('#ffffff')
  })
  it('makes an S with two control points on opposite sides', () => {
    const points = bezier({ x: 0, y: 20 }, { x: 40, y: 20 }, [
      { x: 13, y: 0 },
      { x: 27, y: 40 },
    ])
    expect(points.some((p) => p.y < 15)).toBe(true)
    expect(points.some((p) => p.y > 25)).toBe(true)
  })
  it('draws a curve with no gaps', () => {
    const drawn = curve(bitmap(61, 51), { x: 0, y: 0 }, { x: 60, y: 5 }, [{ x: 10, y: 50 }], '#000000')
    for (let x = 0; x <= 60; x++) {
      const column = Array.from({ length: 51 }, (_, y) => colorAt(drawn, { x, y }))
      expect(column).toContain('#000000')
    }
  })
})

describe('Polygon tool', () => {
  const triangle = [
    { x: 2, y: 2 },
    { x: 17, y: 2 },
    { x: 2, y: 17 },
  ]
  it('closes the outline back to the first vertex', () => {
    const drawn = polygon(bitmap(20, 20), triangle, ink)
    expect(colorAt(drawn, { x: 2, y: 10 })).toBe('#000000')
    expect(colorAt(drawn, { x: 10, y: 9 })).toBe('#000000')
    expect(colorAt(drawn, { x: 5, y: 5 })).toBe('#ffffff')
  })
  it('fills with the background color inside a foreground border', () => {
    const drawn = polygon(bitmap(20, 20), triangle, { ...ink, fill: 'both' })
    expect(colorAt(drawn, { x: 5, y: 5 })).toBe('#ff0000')
    expect(colorAt(drawn, { x: 2, y: 2 })).toBe('#000000')
    expect(colorAt(drawn, { x: 15, y: 15 })).toBe('#ffffff')
  })
  it('fills solid with the foreground color', () => {
    const drawn = polygon(bitmap(20, 20), triangle, { ...ink, fill: 'solid' })
    expect(colorAt(drawn, { x: 5, y: 5 })).toBe('#000000')
  })
})

describe('Selections', () => {
  const source = stroke(bitmap(20, 20), { x: 2, y: 2 }, { x: 5, y: 2 }, '#000000')
  it('lifts the selected pixels and clears their old place to the background', () => {
    const selection = select(source, { x: 1, y: 1 }, { x: 6, y: 6 })
    const piece = cut(source, selection)
    expect([piece.width, piece.height]).toEqual([6, 6])
    const hole = erase(source, selection, '#00ff00')
    expect(colorAt(hole, { x: 2, y: 2 })).toBe('#00ff00')
    const moved = place(hole, piece, { x: 10, y: 10 })
    expect(colorAt(moved, { x: 11, y: 11 })).toBe('#000000')
    expect(colorAt(moved, { x: 10, y: 10 })).toBe('#ffffff')
  })
  it('free-form pieces carry only the pixels inside the outline', () => {
    const black = bitmap(10, 10, '#000000')
    const selection = select(black, { x: 0, y: 0 }, { x: 4, y: 4 }, [
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 0, y: 4 },
    ])
    const moved = place(bitmap(10, 10), cut(black, selection), { x: 5, y: 5 })
    expect(colorAt(moved, { x: 6, y: 6 })).toBe('#000000')
    expect(colorAt(moved, { x: 8, y: 8 })).toBe('#ffffff')
  })
  it('skips the background color in transparent mode', () => {
    const piece = cut(source, selectAll(source))
    const under = bitmap(20, 20, '#0000ff')
    expect(colorAt(place(under, piece, { x: 0, y: 0 }), { x: 10, y: 10 })).toBe('#ffffff')
    expect(colorAt(place(under, piece, { x: 0, y: 0 }, '#ffffff'), { x: 10, y: 10 })).toBe('#0000ff')
    expect(colorAt(place(under, piece, { x: 0, y: 0 }, '#ffffff'), { x: 3, y: 2 })).toBe('#000000')
  })
  it('clips pieces moved past the edges', () => {
    const piece = cut(source, select(source, { x: 2, y: 2 }, { x: 5, y: 2 }))
    const moved = place(bitmap(20, 20), piece, { x: -2, y: 19 })
    expect(colorAt(moved, { x: 0, y: 19 })).toBe('#000000')
    expect(colorAt(moved, { x: 2, y: 19 })).toBe('#ffffff')
  })
  it('keeps a free-form outline through flips', () => {
    const black = bitmap(4, 1, '#000000')
    const piece = cut(black, select(black, { x: 0, y: 0 }, { x: 3, y: 0 }, undefined))
    const half = { ...piece, pixels: piece.pixels.slice() }
    half.pixels[3] = 0
    expect(transform(half, 'horizontal').pixels[15]).toBe(0)
    expect(transform(half, 'horizontal').pixels[3]).toBe(255)
  })
})

describe('Stretch and Skew', () => {
  it('stretches by percentages', () => {
    const source = stroke(bitmap(10, 10), { x: 0, y: 0 }, { x: 0, y: 0 }, '#000000')
    const wide = stretch(source, 200, 50)
    expect([wide.width, wide.height]).toEqual([20, 5])
    expect(colorAt(wide, { x: 1, y: 0 })).toBe('#000000')
    expect(colorAt(wide, { x: 2, y: 0 })).toBe('#ffffff')
  })
  it('slants rows and grows the picture to hold them', () => {
    const source = bitmap(10, 10, '#000000')
    const slanted = skew(source, 45, 0, '#ffffff')
    expect([slanted.width, slanted.height]).toEqual([19, 10])
    expect(skewSize(10, 10, 45, 0)).toEqual({ width: 19, height: 10 })
    expect(colorAt(slanted, { x: 0, y: 0 })).toBe('#000000')
    expect(colorAt(slanted, { x: 0, y: 9 })).toBe('#ffffff')
    expect(colorAt(slanted, { x: 9, y: 9 })).toBe('#000000')
    expect(colorAt(slanted, { x: 18, y: 0 })).toBe('#ffffff')
  })
  it('slants columns for a vertical skew', () => {
    const slanted = skew(bitmap(10, 10, '#000000'), 0, -45, '#ffffff')
    expect([slanted.width, slanted.height]).toEqual([10, 19])
    expect(colorAt(slanted, { x: 0, y: 18 })).toBe('#000000')
    expect(colorAt(slanted, { x: 9, y: 18 })).toBe('#ffffff')
  })
})

describe('Save As types', () => {
  const colorful = bitmap(2, 1, '#f01010')
  it('reduces a monochrome bitmap to black and white', () => {
    expect(colorAt(quantize(bitmap(1, 1, '#ffff80'), 1), { x: 0, y: 0 })).toBe('#ffffff')
    expect(colorAt(quantize(bitmap(1, 1, '#404040'), 1), { x: 0, y: 0 })).toBe('#000000')
  })
  it('reduces a 16 color bitmap to the VGA palette', () => {
    expect(colorAt(quantize(colorful, 4), { x: 0, y: 0 })).toBe('#ff0000')
    expect(colorAt(quantize(bitmap(1, 1, '#c0c0c0'), 4), { x: 0, y: 0 })).toBe('#c0c0c0')
  })
  it('reduces a 256 color bitmap to the halftone cube and keeps 24-bit as is', () => {
    expect(colorAt(quantize(bitmap(1, 1, '#ff8040'), 8), { x: 0, y: 0 })).toBe('#ff9933')
    expect(colorAt(quantize(colorful, 8), { x: 0, y: 0 })).toBe('#ff0000')
    expect(quantize(colorful, 24)).toBe(colorful)
  })
  it('reports Windows bitmap file sizes with headers, color tables, and padded rows', () => {
    expect(bmpBytes(440, 280, 24)).toBe(54 + 1320 * 280)
    expect(bmpBytes(440, 280, 8)).toBe(54 + 1024 + 440 * 280)
    expect(bmpBytes(440, 280, 4)).toBe(54 + 64 + 220 * 280)
    expect(bmpBytes(440, 280, 1)).toBe(54 + 8 + 56 * 280)
  })
})
