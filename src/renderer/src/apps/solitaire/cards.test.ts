import { describe, expect, it } from 'vitest'
import { ANIMATED_BACKS, BACKS, backImage, cardImage, slotImage, stockImage } from './cards'
import { validateTemplates } from './court'
import { deck } from './game'

const svg = (image: string) => decodeURIComponent(image.slice(image.indexOf(',') + 1))
describe('native card artwork', () => {
  it('renders all 52 faces as distinct 71 by 96 pixel grids without font glyphs', () => {
    const faces = deck().map(cardImage)
    expect(new Set(faces).size).toBe(52)
    for (const image of faces) {
      expect(svg(image)).toContain('width="71" height="96"')
      expect(svg(image)).not.toMatch(/<text|font-family|<path|<circle/)
    }
  })
  it('provides twelve distinct backs and changing frames for the four animated designs', () => {
    expect(BACKS).toHaveLength(12)
    expect(new Set(BACKS.map((back) => backImage(back))).size).toBe(12)
    for (const back of ANIMATED_BACKS) {
      expect(new Set([0, 1, 2, 3].map((frame) => backImage(back, frame))).size).toBe(4)
    }
    expect(backImage('Blue weave', 3)).toBe(backImage('Blue weave', 0))
  })
  it('keeps every court template row exactly one half wide', () => {
    expect(validateTemplates()).toEqual([])
  })
  it('uses different pixel stock markers and an empty outline without a suit', () => {
    expect(stockImage(true)).not.toBe(stockImage(false))
    for (const image of [slotImage, stockImage(true), stockImage(false)]) {
      expect(svg(image)).toContain('width="71" height="96"')
      expect(svg(image)).not.toContain('<text')
    }
  })
})
