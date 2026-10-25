import { describe, expect, it } from 'vitest'
import {
  bitmap,
  colorAt,
  flood,
  type History,
  type Ink,
  remember,
  repeat,
  resize,
  seededRandom,
  shape,
  spray,
  stroke,
  transform,
  undo,
} from './bitmap'

const ink: Ink = { foreground: '#000000', background: '#ff0000', width: 1, fill: 'outline' }
describe('Paint bitmap', () => {
  it('draws a continuous pencil line without changing the source', () => {
    const source = bitmap(20, 20)
    const next = stroke(source, { x: 1, y: 1 }, { x: 10, y: 10 }, '#000000')
    for (let i = 1; i <= 10; i++) expect(colorAt(next, { x: i, y: i })).toBe('#000000')
    expect(colorAt(source, { x: 1, y: 1 })).toBe('#ffffff')
  })
  it('draws brush widths and erases with the background color', () => {
    const painted = stroke(bitmap(20, 20), { x: 10, y: 10 }, { x: 10, y: 10 }, '#ff0000', 5, 'round')
    expect(colorAt(painted, { x: 10, y: 8 })).toBe('#ff0000')
    const erased = stroke(painted, { x: 10, y: 10 }, { x: 10, y: 10 }, '#ffffff', 3)
    expect(colorAt(erased, { x: 10, y: 10 })).toBe('#ffffff')
  })
  it('draws outlined and filled rectangles, ellipses, and rounded rectangles', () => {
    for (const kind of ['rectangle', 'ellipse', 'rounded'] as const) {
      const outlined = shape(bitmap(30, 30), kind, { x: 2, y: 2 }, { x: 24, y: 24 }, ink)
      expect(colorAt(outlined, { x: 13, y: 2 })).toBe('#000000')
      expect(colorAt(outlined, { x: 13, y: 13 })).toBe('#ffffff')
      const filled = shape(bitmap(30, 30), kind, { x: 24, y: 24 }, { x: 2, y: 2 }, { ...ink, fill: 'both' })
      expect(colorAt(filled, { x: 13, y: 13 })).toBe('#ff0000')
    }
  })
  it('fills a closed area without leaking past its outline', () => {
    const outlined = shape(bitmap(20, 20), 'rectangle', { x: 3, y: 3 }, { x: 16, y: 16 }, ink)
    const filled = flood(outlined, { x: 5, y: 5 }, '#00ff00')
    expect(colorAt(filled, { x: 15, y: 15 })).toBe('#00ff00')
    expect(colorAt(filled, { x: 3, y: 3 })).toBe('#000000')
    expect(colorAt(filled, { x: 0, y: 0 })).toBe('#ffffff')
    expect(flood(filled, { x: 5, y: 5 }, '#00ff00')).toBe(filled)
  })
  it('flips, rotates, inverts and resizes pixels', () => {
    const source = stroke(bitmap(3, 2), { x: 0, y: 0 }, { x: 0, y: 0 }, '#ff0000')
    expect(colorAt(transform(source, 'horizontal'), { x: 2, y: 0 })).toBe('#ff0000')
    expect(colorAt(transform(source, 'vertical'), { x: 0, y: 1 })).toBe('#ff0000')
    const rotated = transform(source, '90')
    expect([rotated.width, rotated.height]).toEqual([2, 3])
    expect(colorAt(rotated, { x: 1, y: 0 })).toBe('#ff0000')
    expect(transform(rotated, '270').pixels).toEqual(source.pixels)
    expect(colorAt(transform(source, 'invert'), { x: 0, y: 0 })).toBe('#00ffff')
    expect(colorAt(resize(source, 5, 5, '#000000'), { x: 4, y: 4 })).toBe('#000000')
  })
  it('airbrush is reproducible with a seeded random source', () => {
    const source = bitmap(40, 40)
    const a = spray(source, { x: 20, y: 20 }, '#000000', 10, seededRandom(95))
    const b = spray(source, { x: 20, y: 20 }, '#000000', 10, seededRandom(95))
    expect(a.pixels).toEqual(b.pixels)
    expect(a.pixels).not.toEqual(source.pixels)
  })
})
describe('Paint three-level undo', () => {
  it('steps back through three strokes, repeats them, and drops a fourth undo', () => {
    let history: History = { past: [], present: bitmap(5, 5), future: [] }
    for (let x = 0; x < 4; x++)
      history = remember(history, stroke(history.present, { x, y: 0 }, { x, y: 0 }, '#000000'))
    const saved = history.present
    for (let x = 3; x > 0; x--) {
      history = undo(history)
      expect(colorAt(history.present, { x, y: 0 })).toBe('#ffffff')
      expect(colorAt(history.present, { x: x - 1, y: 0 })).toBe('#000000')
    }
    expect(undo(history)).toBe(history)
    for (let i = 0; i < 3; i++) history = repeat(history)
    expect(history.present.pixels).toEqual(saved.pixels)
    history = remember(undo(history), bitmap(5, 5, '#ff0000'))
    expect(repeat(history)).toBe(history)
  })
})
