import { describe, expect, it } from 'vitest'
import { arranged, layout, neighbor, pointOf, spanned, touched, typeAhead } from './desktopModel'
import type { Point } from './types'

const desktop = { width: 800, height: 4 + 75 * 3 }

describe('desktop layout', () => {
  it('fills columns top to bottom around saved spots', () => {
    const placed = layout(['a', 'b', 'c', 'd'], { b: pointOf(0, 0) }, desktop)
    expect(placed.get('b')).toEqual(pointOf(0, 0))
    expect(placed.get('a')).toEqual(pointOf(0, 1))
    expect(placed.get('c')).toEqual(pointOf(0, 2))
    expect(placed.get('d')).toEqual(pointOf(1, 0))
  })

  it('arranges in the given order', () => {
    expect(arranged(['z', 'y', 'x', 'w'], desktop)).toEqual({
      z: pointOf(0, 0),
      y: pointOf(0, 1),
      x: pointOf(0, 2),
      w: pointOf(1, 0),
    })
  })
})

describe('arrow keys', () => {
  const grid = new Map<string, Point>([
    ['computer', pointOf(0, 0)],
    ['network', pointOf(0, 1)],
    ['bin', pointOf(0, 2)],
    ['notes', pointOf(1, 0)],
    ['far', pointOf(3, 2)],
  ])
  it('moves within a column and across columns', () => {
    expect(neighbor(grid, 'computer', 'down')).toBe('network')
    expect(neighbor(grid, 'bin', 'up')).toBe('network')
    expect(neighbor(grid, 'computer', 'right')).toBe('notes')
    expect(neighbor(grid, 'notes', 'left')).toBe('computer')
  })
  it('stays put at an edge and starts from the first icon', () => {
    expect(neighbor(grid, 'computer', 'up')).toBe('computer')
    expect(neighbor(grid, null, 'down')).toBe('computer')
  })
  it('reaches an icon off the row when nothing lies straight ahead', () => {
    expect(neighbor(grid, 'bin', 'right')).toBe('far')
  })
})

describe('type-ahead', () => {
  const items = [
    { key: 'mc', label: 'My Computer' },
    { key: 'nn', label: 'Network Neighborhood' },
    { key: 'rb', label: 'Recycle Bin' },
    { key: 'md', label: 'My Documents' },
    { key: 'rd', label: 'Readme.txt' },
  ]
  it('jumps to the next label with that letter and cycles on repeats', () => {
    expect(typeAhead(items, 'mc', 'r')).toBe('rb')
    expect(typeAhead(items, 'rb', 'rr')).toBe('rd')
    expect(typeAhead(items, 'rd', 'r')).toBe('rb')
  })
  it('matches a longer prefix, staying on the current item when it still matches', () => {
    expect(typeAhead(items, 'mc', 'my d')).toBe('md')
    expect(typeAhead(items, 'md', 'my d')).toBe('md')
    expect(typeAhead(items, 'mc', 'rea')).toBe('rd')
    expect(typeAhead(items, 'mc', 'q')).toBeNull()
  })
})

describe('rubber band', () => {
  const rects = new Map([
    ['a', [{ x: 23, y: 6, width: 32, height: 32 }]],
    ['b', [{ x: 23, y: 81, width: 32, height: 32 }]],
    ['c', [{ x: 98, y: 6, width: 32, height: 32 }]],
  ])
  it('selects every item the band touches, whichever way it was dragged', () => {
    expect(touched(spanned({ x: 60, y: 0 }, { x: 0, y: 90 }), rects)).toEqual(['a', 'b'])
    expect(touched(spanned({ x: 140, y: 10 }, { x: 50, y: 20 }), rects)).toEqual(['a', 'c'])
    expect(touched(spanned({ x: 60, y: 50 }, { x: 90, y: 70 }), rects)).toEqual([])
  })
})
