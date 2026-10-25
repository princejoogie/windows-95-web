import { describe, expect, it } from 'vitest'
import { COLUMNS, cellCode, cellIndex, glyphFor, keystroke, moveSelection, ROWS } from './chars'

describe('Character Map grid', () => {
  it('shows ANSI 33 to 255 in a 32 by 7 grid with one spare cell', () => {
    expect(COLUMNS * ROWS).toBe(224)
    expect(cellCode(0)).toBe(33)
    expect(cellCode(222)).toBe(255)
    expect(cellCode(223)).toBe(null)
    expect(cellIndex(169)).toBe(136)
  })

  it('tells the user the keystroke for each character', () => {
    expect(keystroke(65)).toBe('A')
    expect(keystroke(33)).toBe('!')
    expect(keystroke(169)).toBe('Alt+0169')
    expect(keystroke(255)).toBe('Alt+0255')
  })

  it('draws Windows-1252 glyphs for text fonts and private-use glyphs for symbol fonts', () => {
    expect(glyphFor('Arial', 65)).toBe('A')
    expect(glyphFor('Arial', 169)).toBe('©')
    expect(glyphFor('Arial', 0x85)).toBe('…')
    expect(glyphFor('Arial', 0x81)).toBe('')
    expect(glyphFor('Wingdings', 0x4a)).toBe('')
    expect(glyphFor('Symbol', 0x61)).toBe('')
  })

  it('moves the keyboard selection inside the grid', () => {
    expect(moveSelection(0, 'ArrowLeft')).toBe(0)
    expect(moveSelection(0, 'ArrowRight')).toBe(1)
    expect(moveSelection(222, 'ArrowRight')).toBe(222)
    expect(moveSelection(5, 'ArrowUp')).toBe(5)
    expect(moveSelection(5, 'ArrowDown')).toBe(37)
    expect(moveSelection(200, 'ArrowDown')).toBe(200)
    expect(moveSelection(37, 'Home')).toBe(32)
    expect(moveSelection(37, 'End')).toBe(63)
    expect(moveSelection(200, 'End')).toBe(222)
    expect(moveSelection(37, 'PageUp')).toBe(5)
    expect(moveSelection(5, 'PageDown')).toBe(197)
  })
})
