import { describe, expect, it } from 'vitest'
import { readControls, shellOwnsKey } from './controls'
import { IDLE, step, TICK } from './game'
import { LEVELS } from './levels'
import { createWorld } from './world'

const held = (...codes: string[]) => new Set(codes)

const hold = (codes: string[], seconds: number) => {
  const level = LEVELS[0]
  if (!level) throw new Error('no level')
  const world = createWorld(level, 2, 1)
  const start = { x: world.player.x, y: world.player.y, angle: world.player.angle }
  for (let t = 0; t < seconds; t += TICK) step(world, { ...IDLE, ...readControls(held(...codes)) }, TICK)
  return { start, end: world.player }
}

describe('controls', () => {
  it('turns with the arrows, and strafes with them while Alt is held', () => {
    expect(readControls(held('ArrowLeft'))).toMatchObject({ turn: -1, strafe: 0 })
    expect(readControls(held('AltLeft', 'ArrowLeft'))).toMatchObject({ turn: 0, strafe: -1 })
    expect(readControls(held('AltRight', 'ArrowRight'))).toMatchObject({ turn: 0, strafe: 1 })
  })

  it('keeps A, D, comma, and period as strafe keys, and never strafes faster than one key', () => {
    expect(readControls(held('KeyA')).strafe).toBe(-1)
    expect(readControls(held('Period')).strafe).toBe(1)
    expect(readControls(held('KeyA', 'AltLeft', 'ArrowLeft')).strafe).toBe(-1)
  })

  it('moves the player sideways without turning for Alt+Left', () => {
    const { start, end } = hold(['AltLeft', 'ArrowLeft'], 0.6)
    expect(end.angle).toBe(start.angle)
    expect(end.x).toBeCloseTo(start.x, 5)
    expect(end.y).toBeLessThan(start.y - 0.5)
  })

  it('leaves the shell its Alt chords and gives the game Alt with the arrows', () => {
    const key = (code: string, altKey = true) => ({ code, key: '', altKey, metaKey: false })
    for (const code of ['Tab', 'F4', 'Space', 'Escape']) expect(shellOwnsKey(key(code))).toBe(true)
    for (const code of ['ArrowLeft', 'ArrowRight', 'AltLeft', 'ControlLeft'])
      expect(shellOwnsKey(key(code))).toBe(false)
    expect(shellOwnsKey(key('Space', false))).toBe(false)
  })
})
