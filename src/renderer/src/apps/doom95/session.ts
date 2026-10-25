import { type AutomapView, createAutomap, followOff, zoomed } from './automap'
import { DEFAULT_SKILL, type Skill } from './defs'
import { step, type TickInput } from './game'
import { LEVELS } from './levels'
import {
  hitMenu,
  itemCount,
  MAIN_ITEMS,
  type MenuPage,
  OPTION_ITEMS,
  optionStep,
  optionSteps,
  QUIT_NO,
  withOptionStep,
} from './menus'
import { DEFAULT_OPTIONS, type Options } from './options'
import { EMPTY_SLOTS, latestSlot, restoreWorld, SAVE_NAME_LENGTH, type SaveSlots, snapshot } from './savegame'
import { createWorld, type Loadout, loadoutOf, PISTOL_START, type Stats, say, type World } from './world'

export interface Menu {
  readonly page: MenuPage
  readonly cursor: number
  /** The page Back returns to. Null closes the menu. */
  readonly parent: Menu | null
  /** The name being typed into the save slot under the cursor. */
  readonly typing: string | null
  /** The notice page's message, one line per entry. */
  readonly text: readonly string[]
  /** The row the left button went down on, which confirms if the button comes up on it too. */
  readonly pressed: number | null
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
  /** The episode's closing text, then the end screen with the episode's totals. */
  | { readonly kind: 'finale'; readonly page: 'text' | 'end'; time: number }

export interface Session {
  screen: Screen
  /** The menu draws over the title or the game, and pauses the game while open. */
  menu: Menu | null
  world: World | null
  level: number
  skill: Skill
  /** What the player carried into the current level. */
  loadout: Loadout
  seed: number
  /** The Pause key froze the game. The view stays up, unlike the menu. */
  paused: boolean
  automap: AutomapView
  options: Options
  slots: SaveSlots
  /** The slot the Load and Save pages open on. */
  lastSlot: number
  /** The finished levels' tallies this episode. */
  episode: Stats
}

export type Command = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'erase' | 'yes' | 'no' | 'any'
export type SessionEffect =
  | 'quit'
  | 'menuMove'
  | 'menuSelect'
  | 'menuBack'
  /** The save slots changed and should be written to storage. */
  | 'storeSlots'
  /** The options changed and should be written to storage and applied. */
  | 'storeOptions'

export type MenuKey = 'help' | 'save' | 'load' | 'options' | 'quit'

export const TALLY_TIME = 2.2
const RESPAWN_DELAY = 1
const SAVE_CHAR = /^[A-Za-z0-9 .,!?'-]$/

const NO_STATS: Stats = {
  kills: 0,
  totalKills: 0,
  items: 0,
  totalItems: 0,
  secrets: 0,
  totalSecrets: 0,
  time: 0,
}

const addStats = (a: Stats, b: Stats): Stats => ({
  kills: a.kills + b.kills,
  totalKills: a.totalKills + b.totalKills,
  items: a.items + b.items,
  totalItems: a.totalItems + b.totalItems,
  secrets: a.secrets + b.secrets,
  totalSecrets: a.totalSecrets + b.totalSecrets,
  time: a.time + b.time,
})

export const createSession = (
  seed = 1,
  options: Options = DEFAULT_OPTIONS,
  slots: SaveSlots = EMPTY_SLOTS,
): Session => ({
  screen: { kind: 'title' },
  menu: null,
  world: null,
  level: 0,
  skill: DEFAULT_SKILL,
  loadout: PISTOL_START,
  seed,
  paused: false,
  automap: createAutomap(),
  options,
  slots,
  lastSlot: latestSlot(slots),
  episode: NO_STATS,
})

const page = (page: MenuPage, cursor: number, parent: Menu | null, text: readonly string[] = []): Menu => ({
  page,
  cursor,
  parent,
  typing: null,
  text,
  pressed: null,
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
  session.paused = false
  session.automap = { ...session.automap, open: false }
}

const canSave = (session: Session): boolean =>
  session.screen.kind === 'playing' && session.world !== null && !session.world.player.dead

function saveTo(session: Session, slot: number, name: string): SessionEffect[] {
  const { world } = session
  if (!world || !canSave(session)) return []
  const save = snapshot(name.trim() || `SAVE ${slot + 1}`, {
    level: session.level,
    skill: session.skill,
    seed: session.seed,
    loadout: session.loadout,
    episode: session.episode,
    world,
  })
  session.slots = session.slots.map((existing, i) => (i === slot ? save : existing))
  session.lastSlot = slot
  session.menu = null
  say(world, 'Game saved.')
  return ['storeSlots', 'menuSelect']
}

function loadFrom(session: Session, menu: Menu, slot: number): SessionEffect[] {
  const save = session.slots[slot]
  if (!save) return []
  const world = restoreWorld(save)
  if (!world) {
    session.menu = page('notice', 0, menu, ["THAT SAVE DOESN'T FIT THIS", 'VERSION OF THE MAP.'])
    return ['menuSelect']
  }
  session.world = world
  session.level = save.level
  session.skill = save.skill
  session.seed = save.seed
  session.loadout = save.loadout
  session.episode = save.episode
  session.screen = { kind: 'playing' }
  session.menu = null
  session.paused = false
  session.automap = { ...session.automap, open: false }
  session.lastSlot = slot
  return ['menuSelect']
}

function savePage(session: Session, parent: Menu | null): Menu {
  return canSave(session)
    ? page('save', session.lastSlot, parent)
    : page('notice', 0, parent, ["YOU CAN'T SAVE IF YOU", "AREN'T PLAYING!"])
}

function confirm(session: Session, menu: Menu): SessionEffect[] {
  switch (menu.page) {
    case 'main': {
      const action = MAIN_ITEMS[menu.cursor]?.action
      if (action === 'newGame') session.menu = page('skill', session.skill, menu)
      else if (action === 'options') session.menu = page('options', 0, menu)
      else if (action === 'load') session.menu = page('load', session.lastSlot, menu)
      else if (action === 'save') session.menu = savePage(session, menu)
      else if (action === 'help') session.menu = page('help', 0, menu)
      else if (action === 'quit') session.menu = page('quit', QUIT_NO, menu)
      return ['menuSelect']
    }
    case 'skill':
      session.skill = menu.cursor as Skill
      session.episode = NO_STATS
      startLevel(session, 0, PISTOL_START)
      return ['menuSelect']
    case 'options': {
      const item = OPTION_ITEMS[menu.cursor]
      if (item?.kind !== 'toggle') return []
      session.options = withOptionStep(session.options, item, 1 - optionStep(session.options, item))
      return ['storeOptions', 'menuMove']
    }
    case 'load':
      return loadFrom(session, menu, menu.cursor)
    case 'save':
      session.menu = { ...menu, typing: session.slots[menu.cursor]?.name ?? '' }
      return ['menuSelect']
    case 'quit':
      if (menu.cursor === 0) return ['quit']
      session.menu = menu.parent
      return ['menuBack']
    case 'help':
    case 'notice':
      session.menu = menu.parent
      return ['menuBack']
  }
}

function adjust(session: Session, menu: Menu, delta: number): SessionEffect[] {
  if (menu.page === 'quit') {
    session.menu = { ...menu, cursor: (menu.cursor + 1) % 2 }
    return ['menuMove']
  }
  const item = menu.page === 'options' ? OPTION_ITEMS[menu.cursor] : undefined
  if (!item) return []
  const steps = optionSteps(item)
  const now = optionStep(session.options, item)
  const next =
    item.kind === 'toggle' ? (now + delta + steps) % steps : Math.max(0, Math.min(steps - 1, now + delta))
  if (next === now) return []
  session.options = withOptionStep(session.options, item, next)
  return ['storeOptions', 'menuMove']
}

function menuCommand(session: Session, menu: Menu, cmd: Command): SessionEffect[] {
  const back = (): SessionEffect[] => {
    session.menu = menu.parent
    return ['menuBack']
  }
  if (menu.page === 'help' || menu.page === 'notice') return back()
  if (menu.typing !== null) {
    if (cmd === 'confirm') return saveTo(session, menu.cursor, menu.typing)
    if (cmd === 'back') {
      session.menu = { ...menu, typing: null }
      return ['menuBack']
    }
    if (cmd === 'erase') session.menu = { ...menu, typing: menu.typing.slice(0, -1) }
    return []
  }
  const count = itemCount(menu.page)
  switch (cmd) {
    case 'up':
    case 'down':
      if (!count) return []
      session.menu = { ...menu, cursor: (menu.cursor + (cmd === 'up' ? count - 1 : 1)) % count }
      return ['menuMove']
    case 'left':
    case 'right':
      return adjust(session, menu, cmd === 'left' ? -1 : 1)
    case 'back':
    case 'erase':
      return back()
    case 'yes':
      return menu.page === 'quit' ? ['quit'] : []
    case 'no':
    case 'any':
      return menu.page === 'quit' ? back() : []
    case 'confirm':
      return confirm(session, menu)
  }
}

/** Handles a menu or screen key. Game controls go through `tickSession` instead. */
export function command(session: Session, cmd: Command): SessionEffect[] {
  if (session.menu) return menuCommand(session, session.menu, cmd)
  const { screen } = session
  if (cmd === 'back') {
    session.menu = page('main', 0, null)
    return ['menuSelect']
  }
  switch (screen.kind) {
    case 'title':
      session.menu = page('main', 0, null)
      return ['menuSelect']
    case 'intermission':
      if (cmd !== 'confirm') return []
      if (screen.time < TALLY_TIME) {
        screen.time = TALLY_TIME
        return []
      }
      if (screen.level + 1 < LEVELS.length) startLevel(session, screen.level + 1, session.loadout)
      else session.screen = { kind: 'finale', page: 'text', time: 0 }
      return ['menuSelect']
    case 'finale':
      if (cmd !== 'confirm' || screen.time < 1) return []
      if (screen.page === 'text') session.screen = { kind: 'finale', page: 'end', time: 0 }
      else {
        session.screen = { kind: 'title' }
        session.world = null
      }
      return ['menuSelect']
    case 'playing':
      return []
  }
}

/** Types into the save slot being named. Returns false when no name is being typed. */
export function typeChar(session: Session, char: string): boolean {
  const menu = session.menu
  if (menu?.typing == null) return false
  if (SAVE_CHAR.test(char) && menu.typing.length < SAVE_NAME_LENGTH)
    session.menu = { ...menu, typing: menu.typing + char.toUpperCase() }
  return true
}

/** The function keys: F1 help, F2 save, F3 load, F4 options, and F10 quit. They work while no menu is up. */
export function menuKey(session: Session, key: MenuKey): SessionEffect[] {
  if (session.menu) return []
  if (key === 'help') session.menu = page('help', 0, null)
  else if (key === 'save') session.menu = savePage(session, null)
  else if (key === 'load') session.menu = page('load', session.lastSlot, null)
  else if (key === 'options') session.menu = page('options', 0, null)
  else session.menu = page('quit', QUIT_NO, null)
  return ['menuSelect']
}

/**
 * The mouse in the menus. Moving over a row selects it, and a left click confirms the row it went down
 * and came up on. Clicking a slider step or a toggle value sets it. The right button backs out.
 */
export function menuPointer(
  session: Session,
  kind: 'move' | 'down' | 'up',
  x: number,
  y: number,
  button = 0,
): SessionEffect[] {
  const menu = session.menu
  if (!menu) {
    if (kind !== 'down' || button !== 0) return []
    return command(session, session.screen.kind === 'title' ? 'any' : 'confirm')
  }
  if (kind === 'down' && button === 2) return menuCommand(session, menu, 'back')
  if (button !== 0) return []
  if (menu.page === 'help' || menu.page === 'notice')
    return kind === 'down' ? menuCommand(session, menu, 'any') : []
  if (menu.typing !== null) return []
  const hit = hitMenu(menu.page, x, y)
  const moved: SessionEffect[] = hit && hit.index !== menu.cursor ? ['menuMove'] : []
  switch (kind) {
    case 'move':
      if (!moved.length || !hit) return []
      session.menu = { ...menu, cursor: hit.index }
      return moved
    case 'down': {
      if (!hit) return []
      const item = menu.page === 'options' ? OPTION_ITEMS[hit.index] : undefined
      if (item && hit.choice !== null) {
        session.options = withOptionStep(session.options, item, hit.choice)
        session.menu = { ...menu, cursor: hit.index, pressed: null }
        return ['storeOptions', 'menuMove']
      }
      session.menu = { ...menu, cursor: hit.index, pressed: hit.index }
      return moved
    }
    case 'up': {
      const pressed = menu.pressed
      session.menu = { ...menu, pressed: null }
      if (!hit || pressed !== hit.index) return []
      return menuCommand(session, session.menu, 'confirm')
    }
  }
}

/** The Pause key. It works only in play with no menu up, and the same key resumes. */
export function togglePause(session: Session): boolean {
  if (session.screen.kind !== 'playing' || session.menu || !session.world) return false
  session.paused = !session.paused
  return true
}

export type AutomapCommand = 'toggle' | 'follow' | 'zoomIn' | 'zoomOut'

export function automapCommand(session: Session, cmd: AutomapCommand): boolean {
  const { world, automap } = session
  if (session.screen.kind !== 'playing' || session.menu || !world) return false
  if (cmd === 'toggle') {
    session.automap = { ...automap, open: !automap.open }
    return true
  }
  if (!automap.open) return false
  if (cmd === 'follow') {
    session.automap = automap.follow ? followOff(automap, world.player) : { ...automap, follow: true }
    say(world, session.automap.follow ? 'Follow mode on' : 'Follow mode off')
  } else session.automap = zoomed(automap, cmd === 'zoomIn' ? 1 : -1)
  return true
}

/** Scrolls the automap by cells. It scrolls only with follow mode off, like Doom's. */
export function panAutomap(session: Session, dx: number, dy: number): void {
  const { automap, world } = session
  if (!automap.open || automap.follow || !world || session.paused || session.menu) return
  const x = Math.max(0, Math.min(world.level.width, automap.x + dx))
  const y = Math.max(0, Math.min(world.level.height, automap.y + dy))
  session.automap = { ...automap, x, y }
}

/** Advances one fixed step: the game while it is playing, and the animated screens otherwise. */
export function tickSession(session: Session, input: TickInput, dt: number): void {
  const { screen, world } = session
  if (screen.kind === 'intermission' || screen.kind === 'finale') {
    screen.time += dt
    return
  }
  if (screen.kind !== 'playing' || session.menu || session.paused || !world) return
  step(world, input, dt)
  if (world.outcome === 'exited') {
    session.loadout = loadoutOf(world.player)
    session.episode = addStats(session.episode, world.stats)
    session.screen = { kind: 'intermission', level: session.level, stats: { ...world.stats }, time: 0 }
  } else if (world.outcome === 'dead' && world.player.deadTime > RESPAWN_DELAY && input.use) {
    startLevel(session, session.level, PISTOL_START)
  }
}
