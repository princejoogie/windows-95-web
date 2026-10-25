import { describe, expect, it } from 'vitest'
import { drivePie } from './drivePie'

const count = (cells: string[][], kind: string) => cells.flat().filter((cell) => cell === kind).length

describe('drive pie', () => {
  it('gives the used slice its share of the face, starting at three o clock', () => {
    const pie = drivePie(120, 64, 10, 0.25)
    const used = count(pie, 'used')
    const free = count(pie, 'free')
    expect(used / (used + free)).toBeCloseTo(0.25, 1)
    expect(pie[20]?.[100]).toBe('used')
    expect(pie[40]?.[100]).toBe('free')
  })
  it('draws the raised edge below the face, and outlines the disc', () => {
    const pie = drivePie(120, 64, 10, 0.75)
    expect(count(pie, 'usedSide') + count(pie, 'freeSide')).toBeGreaterThan(0)
    expect(pie[26]?.find((cell) => cell !== 'none')).toBe('edge')
    expect(pie[0]?.[0]).toBe('none')
  })
  it('shows only free space on an empty drive', () => {
    const pie = drivePie(120, 64, 10, 0)
    expect(count(pie, 'used') + count(pie, 'usedSide')).toBe(0)
  })
})
