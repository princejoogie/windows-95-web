import { describe, expect, it } from 'vitest'
import { basicColors, formatPalette, fromHsl, parsePalette, toHsl } from './colors'
import { palette } from './tools'

describe('Edit Colors', () => {
  it('reads Windows hue, saturation, and luminosity', () => {
    expect(toHsl('#ff0000')).toEqual({ hue: 0, sat: 240, lum: 120 })
    expect(toHsl('#0000ff')).toEqual({ hue: 160, sat: 240, lum: 120 })
    expect(toHsl('#808080')).toEqual({ hue: 160, sat: 0, lum: 120 })
    expect(toHsl('#ffffff').lum).toBe(240)
  })
  it('round-trips colors through HSL', () => {
    for (const color of ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#000000', '#ffffff', '#c0c0c0'])
      expect(fromHsl(toHsl(color))).toBe(color)
  })
  it('offers 48 basic colors', () => {
    expect(basicColors).toHaveLength(48)
  })
})

describe('Get Colors and Save Colors', () => {
  it('saves and reads back the color box', () => {
    const saved = formatPalette(palette)
    expect(saved.split('\r\n').slice(0, 4)).toEqual(['JASC-PAL', '0100', '28', '0 0 0'])
    expect(parsePalette(saved)).toEqual(palette)
  })
  it('rejects files that are not palettes', () => {
    expect(parsePalette('hello')).toBeNull()
    expect(parsePalette('JASC-PAL\r\n0100\r\n2\r\n0 0 0\r\n')).toBeNull()
    expect(parsePalette('JASC-PAL\r\n0100\r\n1\r\n0 0 300')).toBeNull()
  })
})
