import { describe, expect, it } from 'vitest'
import { cssFont, defaultTextStyle, lineHeight, wrap } from './text'

const measure = (line: string) => line.length * 10

describe('Paint text frame', () => {
  it('wraps at spaces inside the frame width', () => {
    expect(wrap('hello big world', 100, measure)).toEqual(['hello big ', 'world'])
  })
  it('keeps typed line breaks and empty lines', () => {
    expect(wrap('one\n\ntwo', 100, measure)).toEqual(['one', '', 'two'])
  })
  it('breaks a word longer than the frame', () => {
    expect(wrap('abcdefghijkl', 50, measure)).toEqual(['abcde', 'fghij', 'kl'])
  })
  it('sizes points at 96 DPI and builds the CSS font', () => {
    expect(cssFont({ ...defaultTextStyle, size: 12, bold: true, italic: true })).toBe(
      'italic bold 16px "Arial"',
    )
    expect(cssFont(defaultTextStyle, 4)).toBe('52px "Arial"')
    expect(lineHeight({ ...defaultTextStyle, size: 12 })).toBe(19)
  })
})
