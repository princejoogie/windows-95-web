import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fontBytes, fontCharacterRanges, fontData, inspectFont } from '../src/renderer/src/fonts/sfnt'

const font = new Uint8Array(
  readFileSync(new URL('../src/renderer/src/assets/fonts/micross.ttf', import.meta.url)),
)
describe('virtual font input', () => {
  it('reads the family and actual byte size from a real local font', () => {
    expect(inspectFont(font)).toEqual({
      name: 'Microsoft Sans Serif',
      format: 'TrueType',
      byteLength: 652664,
    })
  })
  it('preserves every font byte through persisted virtual file content', () => {
    expect(fontBytes(fontData(font))).toEqual(font)
  })
  it('uses actual cmap coverage to distinguish supported and missing glyphs', () => {
    const ranges = fontCharacterRanges(font)
    const has = (code) => ranges.some(([first, last]) => code >= first && code <= last)
    expect(has(65)).toBe(true)
    expect(has(0x10ffff)).toBe(false)
    expect(ranges.every(([first, last]) => first <= last)).toBe(true)
  })
  it('rejects renamed text, external URLs, truncated tables, and missing font outlines', () => {
    expect(() => fontBytes('not a font')).toThrow()
    expect(() => fontBytes('https://example.invalid/font.ttf')).toThrow()
    expect(() => inspectFont(font.subarray(0, 32))).toThrow()
    const damaged = font.slice()
    const view = new DataView(damaged.buffer)
    view.setUint32(20, damaged.length + 1)
    expect(() => inspectFont(damaged)).toThrow()
    const outline = font.slice()
    const tables = new DataView(outline.buffer).getUint16(4)
    for (let index = 0; index < tables; index++) {
      const offset = 12 + index * 16
      if (String.fromCharCode(...outline.subarray(offset, offset + 4)) === 'glyf')
        outline.set([98, 97, 100, 33], offset)
    }
    expect(() => inspectFont(outline)).toThrow()
  })
})
