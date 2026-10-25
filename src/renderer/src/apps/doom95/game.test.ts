import { describe, expect, it } from 'vitest'
import { damagePlayer, wake } from './combat'
import { IDLE, step, TICK, type TickInput } from './game'
import { parseLevel, TEX } from './map'
import { createWorld, type World } from './world'

const level = (...rows: string[]) => parseLevel({ name: 'test', par: 30, rows })
const world = (rows: string[], seed = 7) => createWorld(level(...rows), 2, seed)

/** Runs the simulation for `seconds` with the same controls each tick. */
function run(w: World, seconds: number, input: Partial<TickInput> = {}) {
  for (let t = 0; t < seconds; t += TICK) step(w, { ...IDLE, ...input })
}

const press = (w: World, input: Partial<TickInput>) => step(w, { ...IDLE, ...input })

describe('combat', () => {
  it('kills a trooper with the pistol and counts the kill', () => {
    const w = world(['##########', '#>.....t.#', '##########'])
    const trooper = w.actors[0]
    expect(w.stats).toMatchObject({ kills: 0, totalKills: 1 })
    run(w, 4, { fire: true })
    expect(trooper?.state).toMatch(/dying|dead/)
    expect(w.stats.kills).toBe(1)
    expect(w.player.ammo.bullets).toBeLessThan(50)
  })

  it('spends a shell per shotgun blast and puts down a demon faster than the pistol', () => {
    const rows = ['##########', '#>....d..#', '##########']
    const ticksToKill = (weapon: 'pistol' | 'shotgun') => {
      const w = world(rows, 3)
      w.player.owned.shotgun = true
      w.player.ammo.shells = 20
      press(w, { weapon })
      run(w, 0.5)
      let ticks = 0
      while (w.actors[0]?.state !== 'dying' && w.actors[0]?.state !== 'dead' && ticks < 6000) {
        press(w, { fire: true })
        ticks++
      }
      return { ticks, w }
    }
    const shotgun = ticksToKill('shotgun')
    const pistol = ticksToKill('pistol')
    expect(shotgun.w.player.ammo.shells).toBeLessThan(20)
    expect(shotgun.ticks).toBeLessThan(pistol.ticks)
  })

  it('switches to the fist when the pistol runs dry', () => {
    const w = world(['##########', '#>.......#', '##########'])
    w.player.ammo.bullets = 1
    run(w, 2, { fire: true })
    expect(w.player.ammo.bullets).toBe(0)
    expect(w.player.weapon).toBe('fist')
  })

  it('blows up a barrel and the blast kills a trooper beside it', () => {
    const w = world(['############', '#>.....ot..#', '############'])
    const trooper = w.actors.find((actor) => actor.kind === 'trooper')
    run(w, 2, { fire: true })
    expect(w.actors.find((actor) => actor.kind === 'barrel')?.state).toBe('dead')
    expect(trooper?.state).toMatch(/dying|dead/)
  })

  it('lets green armor soak a third of the damage', () => {
    const w = world(['#####', '#>..#', '#####'])
    w.player.armor = 100
    damagePlayer(w, 30)
    expect(w.player).toMatchObject({ hp: 80, armor: 90 })
  })

  it('ends the level for a dead player', () => {
    const w = world(['#####', '#>..#', '#####'])
    damagePlayer(w, 500)
    expect(w.player.dead).toBe(true)
    expect(w.outcome).toBe('dead')
  })
})

describe('monsters', () => {
  it('spot the player, chase, and shoot', () => {
    const w = world(
      ['################', '#>.............#', '#..............#', '#............t.#', '################'],
      11,
    )
    const trooper = w.actors[0]
    if (!trooper) throw new Error('no trooper')
    trooper.angle = Math.PI
    run(w, 0.1)
    expect(trooper.state).not.toBe('idle')
    expect(w.events.some((event) => event.sound === 'trooperSight')).toBe(true)
    const startX = trooper.x
    run(w, 10)
    expect(trooper.x).toBeLessThan(startX)
    expect(w.player.hp).toBeLessThan(100)
  })

  it('do not see through a closed door, but hear gunfire around corners', () => {
    const w = world(['#########', '#>..#...#', '#...D.t.#', '#...#...#', '#########'])
    const trooper = w.actors[0]
    if (!trooper) throw new Error('no trooper')
    trooper.angle = Math.PI
    run(w, 1)
    expect(trooper.state).toBe('idle')
    const open = createWorld(w.level, 2, 7)
    const door = open.grid.doors[0]
    if (!door) throw new Error('no door')
    door.open = 1
    door.phase = 'open'
    door.wait = 99
    const listener = open.actors[0]
    if (!listener) throw new Error('no trooper')
    listener.angle = 0
    press(open, { fire: true })
    expect(listener.state).toBe('chase')
  })

  it('open plain doors to reach the player, but not locked ones', () => {
    const chaseThrough = (door: string) => {
      const w = world(['###########', `#>...${door}..t.#`, '###########'], 3)
      const trooper = w.actors[0]
      if (!trooper) throw new Error('no trooper')
      w.player.hp = 1000
      wake(w, trooper)
      run(w, 4)
      return { w, trooper }
    }
    const plain = chaseThrough('D')
    expect(plain.w.events.some((event) => event.sound === 'doorOpen')).toBe(true)
    expect(plain.trooper.x).toBeLessThan(5)
    const locked = chaseThrough('R')
    expect(locked.w.grid.doors[0]?.phase).toBe('closed')
    expect(locked.trooper.x).toBeGreaterThan(6)
  })

  it('demons throw fireballs that hurt', () => {
    const w = world(['################', '#>............d#', '################'], 5)
    const demon = w.actors[0]
    if (!demon) throw new Error('no demon')
    demon.angle = Math.PI
    let sawFireball = false
    for (let t = 0; t < 10 && w.player.hp === 100; t += TICK) {
      press(w, {})
      sawFireball ||= w.projectiles.length > 0
    }
    expect(sawFireball).toBe(true)
    expect(w.player.hp).toBeLessThan(100)
  })
})

describe('doors and keys', () => {
  const rows = ['##########', '#.>R...r.#', '##########']

  it('refuses a locked door without its key and opens it with the key', () => {
    const w = world(rows)
    press(w, { use: true })
    expect(w.message?.text).toMatch(/red keycard/)
    expect(w.grid.doors[0]?.phase).toBe('closed')
    w.player.keys.red = true
    press(w, { use: true })
    expect(w.grid.doors[0]?.phase).toBe('opening')
  })

  it('walks through the opened door and picks up the key on the other side', () => {
    const w = world(['##########', '#.>D...r.#', '##########'])
    press(w, { use: true })
    run(w, 0.6)
    run(w, 2.5, { forward: 1 })
    expect(w.player.x).toBeGreaterThan(6)
    expect(w.player.keys.red).toBe(true)
    expect(w.stats.items).toBe(1)
  })

  it('keeps the player out of a closed door', () => {
    const w = world(['##########', '#>.D.....#', '##########'])
    run(w, 2, { forward: 1 })
    expect(w.player.x).toBeLessThan(3)
  })
})

describe('pickups and level flow', () => {
  it('heals only when hurt, and the shotgun is raised as soon as it is picked up', () => {
    const w = world(['#########', '#>hg....#', '#########'])
    run(w, 1.5, { forward: 1 })
    expect(w.items.find((item) => item.kind === 'health')?.taken).toBe(false)
    expect(w.player.owned.shotgun).toBe(true)
    expect(w.player.ammo.shells).toBe(8)
    run(w, 0.5)
    expect(w.player.weapon).toBe('shotgun')
    w.player.hp = 50
    w.player.x = 2.5
    run(w, 0.1)
    expect(w.player.hp).toBe(75)
  })

  it('counts a secret the first time the player steps on it', () => {
    const w = world(['#######', '#>S...#', '#######'])
    run(w, 1.2, { forward: 1 })
    expect(w.stats.secrets).toBe(1)
    expect(w.stats.totalSecrets).toBe(1)
  })

  it('ends the level a moment after the exit switch is thrown', () => {
    const w = world(['#####', '#>.E#', '#####'])
    run(w, 0.5, { forward: 1 })
    press(w, { use: true })
    expect(w.grid.walls[3 + 5]).toBe(TEX.exitOn)
    expect(w.outcome).toBe('playing')
    run(w, 1)
    expect(w.outcome).toBe('exited')
  })
})

describe('bumping into things', () => {
  const barrels = () =>
    world(['########', '#......#', '#......#', '#.oo...#', '#......#', '#..^...#', '########'])

  it('lets the player walk between two barrels a cell apart', () => {
    const w = barrels()
    Object.assign(w.player, { x: 3.05, y: 5.5, angle: -Math.PI / 2 })
    run(w, 1.2, { forward: 1 })
    expect(w.player.y).toBeLessThan(2.5)
  })

  it('never pins a player who ended up overlapping a barrel', () => {
    const w = barrels()
    Object.assign(w.player, { x: 2.7, y: 3.55, angle: Math.PI / 2 })
    run(w, 0.5, { forward: 1 })
    expect(w.player.y).toBeGreaterThan(4.3)
    Object.assign(w.player, { x: 2.7, y: 3.55, angle: 0, vx: 0, vy: 0 })
    run(w, 0.3, { forward: 1 })
    expect(w.player.x).toBeGreaterThan(2.95)
  })

  it('still stops the player at a barrel it walks straight into', () => {
    const w = barrels()
    Object.assign(w.player, { x: 2.5, y: 5.5, angle: -Math.PI / 2 })
    run(w, 1, { forward: 1 })
    expect(w.player.y).toBeGreaterThan(3.5 + 0.25)
  })
})
