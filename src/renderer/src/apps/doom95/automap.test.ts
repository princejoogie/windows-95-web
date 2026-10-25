import { describe, expect, it } from 'vitest'
import { createBitmap } from './art'
import { automapLines } from './automap'
import { LEVELS } from './levels'
import { buildLut, renderView } from './render'
import { automapCommand, command, createSession, panAutomap, type Session } from './session'
import { buildSprites } from './sprites'
import { buildTextures } from './textures'
import { createWorld, type World } from './world'

const outpost = (): World => {
  const level = LEVELS[0]
  if (!level) throw new Error('no level')
  return createWorld(level, 2, 1)
}

const playing = (): Session => {
  const s = createSession(4)
  command(s, 'any')
  command(s, 'confirm')
  command(s, 'confirm')
  return s
}

describe('automap', () => {
  it('shows nothing of a level the player has not looked at yet', () => {
    expect(automapLines(outpost())).toEqual([])
  })

  it('maps the walls the 3D view draws, and only those', () => {
    const world = outpost()
    const assets = { textures: buildTextures(), sprites: buildSprites(), lut: buildLut() }
    renderView(createBitmap(320, 200), world, assets, new Float32Array(320))
    const lines = automapLines(world)
    expect(lines.length).toBeGreaterThan(4)
    const east = lines.filter((line) => line.x0 === 12 && line.x1 === 12)
    expect(east.length).toBeGreaterThan(0)
    expect(lines.some((line) => line.x0 === 1 && line.x1 === 1)).toBe(false)
  })

  it('draws a wall face only where it borders open floor', () => {
    const world = outpost()
    world.seen[1 * world.level.width + 12] = 1
    const lines = automapLines(world)
    expect(lines).toHaveLength(2)
    expect(lines).toEqual(
      expect.arrayContaining([
        { x0: 12, y0: 1, x1: 12, y1: 2, kind: 'wall' },
        { x0: 13, y0: 1, x1: 13, y1: 2, kind: 'wall' },
      ]),
    )
  })

  it('colors a door by the key it needs once its jamb has been seen', () => {
    const world = outpost()
    const red = world.grid.doors.find((door) => door.key === 'red')
    if (!red) throw new Error('no red door')
    world.seen[red.y * world.level.width + red.x - 1] = 1
    expect(automapLines(world)).toContainEqual({
      x0: red.x,
      y0: red.y + 0.5,
      x1: red.x + 1,
      y1: red.y + 0.5,
      kind: 'red',
    })
  })

  it('opens on Tab, follows the player, and scrolls only with follow mode off', () => {
    const s = playing()
    expect(automapCommand(s, 'toggle')).toBe(true)
    expect(s.automap).toMatchObject({ open: true, follow: true })
    panAutomap(s, 3, 0)
    expect(s.automap.x).toBe(0)
    automapCommand(s, 'follow')
    expect(s.automap).toMatchObject({ follow: false, x: s.world?.player.x, y: s.world?.player.y })
    expect(s.world?.message?.text).toBe('Follow mode off')
    panAutomap(s, 3, 0)
    expect(s.automap.x).toBeCloseTo((s.world?.player.x ?? 0) + 3)
    const zoom = s.automap.zoom
    automapCommand(s, 'zoomIn')
    expect(s.automap.zoom).toBeGreaterThan(zoom)
    automapCommand(s, 'toggle')
    expect(s.automap.open).toBe(false)
  })
})
