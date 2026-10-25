import { expect, it } from 'vitest'
import { markedText, nextPage, print, wrap } from './screen'

it('wraps text at 80 columns, preserves blank lines, and expands tab stops', () => {
  expect(wrap(['A'.repeat(81), '', 'a\tb'])).toEqual(['A'.repeat(80), 'A', '', 'a       b'])
})

it('fills the current screen, pauses, advances a page or line, and finishes', () => {
  const screen = print(
    ['C:\\WINDOWS>DIR /P'],
    Array.from({ length: 50 }, (_, i) => `file ${i}`),
    true,
  )
  expect(screen.lines).toHaveLength(24)
  expect(screen.queue).toHaveLength(27)
  const page = nextPage(screen)
  expect(page.lines[0]).toBe('file 23')
  expect(page.queue).toHaveLength(3)
  const line = nextPage(page, true)
  expect(line.queue).toHaveLength(2)
  expect(nextPage(line).queue).toEqual([])
})

it('scrolls a normal command and copies a rectangular mark in either direction', () => {
  expect(
    print(
      [],
      Array.from({ length: 30 }, (_, i) => `${i}`),
      false,
    ).lines[0],
  ).toBe('6')
  const lines = ['C:\\WINDOWS>DIR', '123456789', 'abcdefghi']
  expect(markedText(lines, { anchor: { row: 1, column: 2 }, end: { row: 2, column: 5 } })).toBe(
    '3456\r\ncdef',
  )
  expect(markedText(lines, { end: { row: 1, column: 2 }, anchor: { row: 2, column: 5 } })).toBe(
    '3456\r\ncdef',
  )
})
