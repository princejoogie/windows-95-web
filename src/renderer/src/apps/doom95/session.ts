import { DEFAULT_SKILL, SKILLS, type Skill } from './defs'
import { step, type TickInput } from './game'
import { LEVELS } from './levels'
import { createWorld, type Loadout, loadoutOf, PISTOL_START, type Stats, type World } from './world'

export type MenuPage = 'main' | 'skill' | 'quit'

export const MAIN_ITEMS = ['New Game', 'Quit Game'] as const

export interface Menu {
  readonly page: MenuPage
  readonly cursor: number
}

export type Screen =
  | { readonly kind: 'title' }
  | { readonly kind: 'playing' }
  | {
      readonly kind: 'intermission'
      readonly level: number
      readonly stats: Readonly<Stats>
      /** Seconds since the screen opened. The tallies count up over `TALLY_TIME`. */
      time: number
    }
  | { readonly kind: 'finale'; time: number }

export interface Session {
  screen: Screen
  /** The menu draws over the title or the game, and pauses the game while open. */
  menu: Menu | null
  world: World | null
  level: number
  skill: Skill
  /** What the player carried out of the last level. */
  loadout: Loadout
  seed: number
}

export type Command = 'up' | 'down' | 'confirm' | 'back' | 'yes' | 'any'
export type SessionEffect = 'quit' | 'menuMove' | 'menuSelect' | 'menuBack'

export const TALLY_TIME = 2.2
const RESPAWN_DELAY = 1

export const createSession = (seed = 1): Session => ({
  screen: { kind: 'title' },
  menu: null,
  world: null,
  level: 0,
  skill: DEFAULT_SKILL,
  loadout: PISTOL_START,
  seed,
})

function startLevel(session: Session, level: number, loadout: Loadout): void {
  const map = LEVELS[level]
  if (!map) return
  session.level = level
  session.loadout = loadout
  session.seed = (session.seed * 1103515245 + 12345) >>> 0
  session.world = createWorld(map, session.skill, session.seed, loadout)
  session.screen = { kind: 'playing' }
  session.menu = null
}

function menuCommand(session: Session, menu: Menu, cmd: Command): SessionEffect[] {
  const count = menu.page === 'main' ? MAIN_ITEMS.length : menu.page === 'skill' ? SKILLS.length : 0
  switch (cmd) {
    case 'up':
    case 'down':
      if (!count) return []
      session.menu = { ...menu, cursor: (menu.cursor + (cmd === 'up' ? count - 1 : 1)) % count }
      return ['menuMove']
    case 'back':
      session.menu = menu.page === 'main' ? null : { page: 'main', cursor: menu.page === 'skill' ? 0 : 1 }
      return ['menuBack']
    case 'yes':
      if (menu.page === 'quit') return ['quit']
      return []
    case 'confirm':
      if (menu.page === 'main') {
        session.menu =
          menu.cursor === 0 ? { page: 'skill', cursor: session.skill } : { page: 'quit', cursor: 0 }
        return ['menuSelect']
      }
      if (menu.page === 'skill') {
        session.skill = menu.cursor as Skill
        startLevel(session, 0, PISTOL_START)
        return ['menuSelect']
      }
      session.menu = { page: 'main', cursor: 1 }
      return ['menuBack']
    case 'any':
      if (menu.page !== 'quit') return []
      session.menu = { page: 'main', cursor: 1 }
      return ['menuBack']
  }
}

/** Handles a menu or screen key. Game controls go through `tickSession` instead. */
export function command(session: Session, cmd: Command): SessionEffect[] {
  if (session.menu) return menuCommand(session, session.menu, cmd)
  const { screen } = session
  if (cmd === 'back') {
    session.menu = { page: 'main', cursor: 0 }
    return ['menuSelect']
  }
  switch (screen.kind) {
    case 'title':
      session.menu = { page: 'main', cursor: 0 }
      return ['menuSelect']
    case 'intermission':
      if (cmd !== 'confirm') return []
      if (screen.time < TALLY_TIME) {
        screen.time = TALLY_TIME
        return []
      }
      if (screen.level + 1 < LEVELS.length) startLevel(session, screen.level + 1, session.loadout)
      else session.screen = { kind: 'finale', time: 0 }
      return ['menuSelect']
    case 'finale':
      if (cmd !== 'confirm' || screen.time < 1) return []
      session.screen = { kind: 'title' }
      session.world = null
      return ['menuSelect']
    case 'playing':
      return []
  }
}

/** Advances one fixed step: the game while it is playing, and the animated screens otherwise. */
export function tickSession(session: Session, input: TickInput, dt: number): void {
  const { screen, world } = session
  if (screen.kind === 'intermission' || screen.kind === 'finale') {
    screen.time += dt
    return
  }
  if (screen.kind !== 'playing' || session.menu || !world) return
  step(world, input, dt)
  if (world.outcome === 'exited') {
    session.loadout = loadoutOf(world.player)
    session.screen = { kind: 'intermission', level: session.level, stats: { ...world.stats }, time: 0 }
  } else if (world.outcome === 'dead' && world.player.deadTime > RESPAWN_DELAY && input.use) {
    startLevel(session, session.level, PISTOL_START)
  }
}
