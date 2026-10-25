import { describe, expect, it } from 'vitest'
import { bitmap, colorAt, select, stroke } from './bitmap'
import { cleared, contains, lift, type Marquee, picture, pieceOf, rectOf, reshape, turn } from './marquee'

const source = stroke(bitmap(20, 20), { x: 2, y: 2 }, { x: 5, y: 2 }, '#000000')
const region: Marquee = { kind: 'region', selection: select(source, { x: 1, y: 1 }, { x: 6, y: 3 }) }

describe('Paint selection', () => {
  it('drags a lifted region and leaves the background behind', () => {
    const floating = lift(source, region, '#00ff00')
    const moved = picture(source, { ...floating, at: { x: 10, y: 10 } })
    expect(colorAt(moved, { x: 2, y: 2 })).toBe('#00ff00')
    expect(colorAt(moved, { x: 11, y: 11 })).toBe('#000000')
    expect(rectOf({ ...floating, at: { x: 10, y: 10 } })).toEqual({ x: 10, y: 10, width: 6, height: 3 })
  })
  it('Ctrl+drag copies the region and leaves the original', () => {
    const floating = lift(source, region, '#00ff00', true)
    const moved = picture(source, { ...floating, at: { x: 10, y: 10 } })
    expect(colorAt(moved, { x: 2, y: 2 })).toBe('#000000')
    expect(colorAt(moved, { x: 11, y: 11 })).toBe('#000000')
  })
  it('Ctrl+drag of a floating piece stamps a copy where it was', () => {
    const floating = { ...lift(source, region, '#ffffff'), at: { x: 10, y: 10 } }
    const again = lift(source, floating, '#ffffff', true)
    const moved = picture(source, { ...again, at: { x: 10, y: 15 } })
    expect(colorAt(moved, { x: 11, y: 11 })).toBe('#000000')
    expect(colorAt(moved, { x: 11, y: 16 })).toBe('#000000')
    expect(colorAt(moved, { x: 2, y: 2 })).toBe('#ffffff')
  })
  it('copies the selected pixels and clears them for Cut and Delete', () => {
    const piece = pieceOf(source, region)
    expect([piece.width, piece.height]).toEqual([6, 3])
    expect(colorAt(cleared(source, region, '#ff0000'), { x: 3, y: 2 })).toBe('#ff0000')
    const floating = lift(source, region, '#ff0000')
    expect(cleared(source, floating, '#ff0000')).toBe(floating.base)
  })
  it('flips only the selection', () => {
    const wide: Marquee = { kind: 'region', selection: select(source, { x: 1, y: 1 }, { x: 10, y: 3 }) }
    const flipped = picture(source, reshape(source, wide, '#ffffff', turn('horizontal')))
    expect(colorAt(flipped, { x: 9, y: 2 })).toBe('#000000')
    expect(colorAt(flipped, { x: 15, y: 2 })).toBe('#ffffff')
    expect(colorAt(flipped, { x: 2, y: 2 })).toBe('#ffffff')
  })
  it('hit-tests the marquee rectangle', () => {
    expect(contains(region, { x: 6, y: 3 })).toBe(true)
    expect(contains(region, { x: 7, y: 3 })).toBe(false)
  })
})
