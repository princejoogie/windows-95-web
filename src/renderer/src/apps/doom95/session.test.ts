import { describe, expect, it } from 'vitest'
import { damagePlayer } from './combat'
import { IDLE, TICK } from './game'
import { LEVELS } from './levels'
import { command, createSession, type Session, TALLY_TIME, tickSession, togglePause } from './session'

const playing = (skill = 2): Session => {
  const s = createSession(9)
  command(s, 'any')
  command(s, 'confirm')
  for (let i = 2; i > skill; i--) command(s, 'up')
  command(s, 'confirm')
  return s
}

const exitLevel = (s: Session) => {
  if (!s.world) throw new Error('no world')
  s.world.outcome = 'exited'
  tickSession(s, IDLE, TICK)
}

describe('session', () => {
  it('goes from the title through the menu and skill choice into level 1', () => {
    const s = createSession(9)
    expect(s.screen.kind).toBe('title')
    expect(command(s, 'any')).toEqual(['menuSelect'])
    expect(s.menu).toMatchObject({ page: 'main', cursor: 0 })
    command(s, 'confirm')
    expect(s.menu?.page).toBe('skill')
    command(s, 'up')
    command(s, 'confirm')
    expect(s.screen.kind).toBe('playing')
    expect(s.menu).toBeNull()
    expect(s.skill).toBe(1)
    expect(s.world?.level.name).toBe(LEVELS[0]?.name)
  })

  it('freezes the game while the menu is open', () => {
    const s = playing()
    command(s, 'back')
    const time = s.world?.time
    for (let i = 0; i < 30; i++) tickSession(s, { ...IDLE, forward: 1 }, TICK)
    expect(s.world?.time).toBe(time)
    command(s, 'back')
    tickSession(s, IDLE, TICK)
    expect(s.world?.time).toBeGreaterThan(time ?? 0)
  })

  it('shows the intermission, then loads the next level with the same weapons and health', () => {
    const s = playing()
    if (!s.world) throw new Error('no world')
    s.world.player.hp = 64
    s.world.player.owned.shotgun = true
    s.world.player.keys.red = true
    exitLevel(s)
    expect(s.screen.kind).toBe('intermission')
    command(s, 'confirm')
    expect(s.screen.kind).toBe('intermission')
    for (let t = 0; t < TALLY_TIME; t += TICK) tickSession(s, IDLE, TICK)
    command(s, 'confirm')
    expect(s.screen.kind).toBe('playing')
    expect(s.world?.level.name).toBe(LEVELS[1]?.name)
    expect(s.world?.player).toMatchObject({ hp: 64, owned: { shotgun: true }, keys: { red: false } })
  })

  it('restarts the level from a pistol start when a dead player presses use', () => {
    const s = playing()
    const world = s.world
    if (!world) throw new Error('no world')
    world.player.owned.shotgun = true
    damagePlayer(world, 1000)
    tickSession(s, { ...IDLE, use: true }, TICK)
    expect(s.world).toBe(world)
    for (let t = 0; t < 1.1; t += TICK) tickSession(s, IDLE, TICK)
    tickSession(s, { ...IDLE, use: true }, TICK)
    expect(s.world).not.toBe(world)
    expect(s.world?.level.name).toBe(LEVELS[0]?.name)
    expect(s.world?.player).toMatchObject({ hp: 100, dead: false, owned: { shotgun: false } })
  })

  it('ends the episode after the last level and returns to the title', () => {
    const s = playing()
    for (let level = 0; level < LEVELS.length; level++) {
      exitLevel(s)
      command(s, 'confirm')
      command(s, 'confirm')
    }
    expect(s.screen).toMatchObject({ kind: 'finale', page: 'text' })
    for (let t = 0; t < 1.2; t += TICK) tickSession(s, IDLE, TICK)
    command(s, 'confirm')
    expect(s.screen).toMatchObject({ kind: 'finale', page: 'end' })
    command(s, 'confirm')
    expect(s.screen.kind).toBe('finale')
    for (let t = 0; t < 1.2; t += TICK) tickSession(s, IDLE, TICK)
    command(s, 'confirm')
    expect(s.screen.kind).toBe('title')
  })

  it('quits only on Y, and any other key backs out of the prompt', () => {
    const s = createSession(9)
    command(s, 'any')
    command(s, 'up')
    command(s, 'confirm')
    expect(s.menu?.page).toBe('quit')
    expect(command(s, 'any')).toEqual(['menuBack'])
    expect(s.menu?.page).toBe('main')
    command(s, 'confirm')
    expect(command(s, 'yes')).toEqual(['quit'])
  })
})

describe('pause', () => {
  it('freezes play on Pause and resumes on the same key, with the view still up', () => {
    const s = playing()
    const world = s.world
    if (!world) throw new Error('no world')
    expect(togglePause(s)).toBe(true)
    const before = { time: world.time, x: world.player.x }
    for (let i = 0; i < 30; i++) tickSession(s, { ...IDLE, forward: 1, fire: true }, TICK)
    expect({ time: world.time, x: world.player.x }).toEqual(before)
    expect(world.player.ammo.bullets).toBe(50)
    expect(s.menu).toBeNull()
    togglePause(s)
    for (let i = 0; i < 30; i++) tickSession(s, { ...IDLE, forward: 1 }, TICK)
    expect(world.player.x).toBeGreaterThan(before.x)
  })

  it('stays paused under the menu, and only works in play', () => {
    const s = playing()
    togglePause(s)
    command(s, 'back')
    expect(togglePause(s)).toBe(false)
    command(s, 'back')
    expect(s.paused).toBe(true)
    expect(togglePause(createSession(1))).toBe(false)
  })
})
