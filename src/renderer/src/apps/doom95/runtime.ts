import { createBitmap } from './art'
import { drawAutomap } from './automap'
import {
  BACK,
  codeOf,
  FIRE,
  FORWARD,
  RUN,
  readControls,
  SLOTS,
  STRAFE_LEFT,
  STRAFE_ON,
  STRAFE_RIGHT,
  TURN_LEFT,
  TURN_RIGHT,
  USE,
} from './controls'
import type { WeaponId } from './defs'
import { TICK, type TickInput } from './game'
import { buildStatusBackground, drawStatusBar } from './hud'
import { toFramebuffer } from './menus'
import { loadOptions, masterGain, mouseScale, storeOptions } from './options'
import { type Assets, buildLut, renderView, SCREEN_H, SCREEN_W, VIEW_H } from './render'
import { loadSlots, storeSlots } from './savegame'
import {
  buildBackdrop,
  drawFinale,
  drawIntermission,
  drawMenu,
  drawMessage,
  drawPaused,
  drawStats,
  drawTitle,
} from './screens'
import {
  automapCommand,
  type Command,
  command,
  createSession,
  type MenuKey,
  menuKey,
  menuPointer,
  panAutomap,
  type Session,
  type SessionEffect,
  tickSession,
  togglePause,
  typeChar,
} from './session'
import { type AnySound, SoundBoard } from './sound'
import { buildSprites } from './sprites'
import { buildTextures } from './textures'
import { say } from './world'

const SAMPLES = 600
/** Automap scroll speed in screen pixels per second, so it feels the same at every zoom. */
const PAN_SPEED = 160

/** Keys the game owns while it has focus, so the page never scrolls or acts on them. */
const GAME_KEYS = new Set([
  ...FORWARD,
  ...BACK,
  ...STRAFE_LEFT,
  ...STRAFE_RIGHT,
  ...TURN_LEFT,
  ...TURN_RIGHT,
  ...STRAFE_ON,
  ...RUN,
  ...USE,
  ...FIRE,
  'Enter',
  'Escape',
  'Backquote',
  'Pause',
  'Tab',
  ...Object.keys(SLOTS),
])

const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])

const MENU_KEYS: Readonly<Record<string, Command>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  KeyE: 'confirm',
  Escape: 'back',
  Backspace: 'erase',
  KeyY: 'yes',
  KeyN: 'no',
}

/** Menu keys that act again while held, for sliders, the cursor, and erasing a save name. */
const REPEATING = new Set([...ARROWS, 'Backspace'])

const FUNCTION_KEYS: Readonly<Record<string, MenuKey>> = {
  F1: 'help',
  F2: 'save',
  F3: 'load',
  F4: 'options',
  F10: 'quit',
}

const AUTOMAP_KEYS: Readonly<Record<string, 'follow' | 'zoomIn' | 'zoomOut'>> = {
  KeyF: 'follow',
  Equal: 'zoomIn',
  NumpadAdd: 'zoomIn',
  Minus: 'zoomOut',
  NumpadSubtract: 'zoomOut',
}

let shared: Assets | null = null
/** Textures and sprites are generated once per page, then shared by every Doom window. */
const assets = (): Assets => {
  shared ??= { textures: buildTextures(), sprites: buildSprites(), lut: buildLut() }
  return shared
}

const percentile = (sorted: Float32Array, p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0

/**
 * Owns one game: the fixed-step loop, input, sound, and drawing into a 320x200 canvas. The React
 * component only starts, stops, and forwards events.
 */
export class DoomRuntime {
  private readonly ctx: CanvasRenderingContext2D
  private readonly image: ImageData
  private readonly frame = createBitmap(SCREEN_W, SCREEN_H)
  private readonly zbuf = new Float32Array(SCREEN_W)
  private readonly assets = assets()
  private readonly bar = buildStatusBackground()
  private readonly backdrop = buildBackdrop()
  private readonly sound = new SoundBoard()
  private readonly session: Session = createSession((Date.now() & 0xffff) + 1, loadOptions(), loadSlots())
  private readonly held = new Set<string>()
  private mouseTurn = 0
  private mouseFire = false
  private useQueued = false
  private weaponQueued: WeaponId | null = null
  private raf = 0
  private last = 0
  private accumulator = 0
  private clock = 0
  private frames = 0
  private showStats = false
  private lockLostAt = 0
  private readonly intervals = new Float32Array(SAMPLES)
  private readonly work = new Float32Array(SAMPLES)
  private readonly sorted = new Float32Array(SAMPLES)
  private timing = { p50: 0, p95: 0, work50: 0, work95: 0 }

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly onQuit: () => void,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('Canvas 2D is unavailable')
    this.ctx = ctx
    this.image = ctx.createImageData(SCREEN_W, SCREEN_H)
    this.sound.setGain(masterGain(this.session.options))
    // Dev builds expose the session so proof scripts can read where things are. Input still goes through keys.
    if (import.meta.env.DEV) Object.assign(canvas, { doom: this.session })
    this.draw()
    this.present()
  }

  get running(): boolean {
    return this.raf !== 0
  }

  start(): void {
    if (this.raf) return
    // Another Doom window may have saved or changed options since this one last had focus.
    this.session.slots = loadSlots()
    this.last = performance.now()
    this.accumulator = 0
    this.raf = requestAnimationFrame(this.loop)
  }

  /** Stops the loop and leaves a paused frame on screen. */
  stop(): void {
    if (!this.raf) return
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.releaseKeys()
    this.releaseMouse()
    this.draw(true)
    this.present()
  }

  dispose(): void {
    this.stop()
    this.sound.close()
  }

  private readonly loop = (now: number): void => {
    const interval = now - this.last
    this.last = now
    const started = performance.now()
    this.accumulator = Math.min(this.accumulator + interval / 1000, 0.25)
    while (this.accumulator >= TICK) {
      tickSession(this.session, this.input(), TICK)
      this.accumulator -= TICK
      this.clock += TICK
    }
    this.playEvents()
    this.draw()
    this.present()
    this.record(interval, performance.now() - started)
    this.raf = requestAnimationFrame(this.loop)
  }

  /**
   * Builds one tick's controls, consuming the one-shot presses and mouse motion. With the automap up and
   * follow mode off, the arrows scroll the map instead of moving the player, as in Doom.
   */
  private input(): TickInput {
    const { automap } = this.session
    let held: ReadonlySet<string> = this.held
    if (automap.open && !automap.follow) {
      const on = (code: string) => (this.held.has(code) ? 1 : 0)
      const step = (PAN_SPEED / automap.zoom) * TICK
      panAutomap(
        this.session,
        (on('ArrowRight') - on('ArrowLeft')) * step,
        (on('ArrowDown') - on('ArrowUp')) * step,
      )
      held = new Set([...this.held].filter((code) => !ARROWS.has(code)))
    }
    const controls = readControls(held)
    const input: TickInput = {
      ...controls,
      mouseTurn: this.mouseTurn,
      fire: controls.fire || this.mouseFire,
      use: this.useQueued,
      weapon: this.weaponQueued,
    }
    this.mouseTurn = 0
    this.useQueued = false
    this.weaponQueued = null
    return input
  }

  private playEvents(): void {
    const world = this.session.world
    if (!world) return
    const { player } = world
    for (const event of world.events) {
      const dx = event.x - player.x
      const dy = event.y - player.y
      const dist = Math.hypot(dx, dy)
      const pan = dist < 0.5 ? 0 : Math.sin(Math.atan2(dy, dx) - player.angle) * 0.8
      this.sound.play(event.sound, Math.max(0, Math.min(1, 1.25 - dist / 18)), pan)
    }
    world.events.length = 0
  }

  private apply(effects: readonly SessionEffect[]): void {
    const { session } = this
    for (const effect of effects) {
      if (effect === 'quit') this.onQuit()
      else if (effect === 'storeSlots') {
        if (!storeSlots(session.slots) && session.world) say(session.world, 'The game could not be saved.')
      } else if (effect === 'storeOptions') {
        storeOptions(session.options)
        this.sound.setGain(masterGain(session.options))
      } else this.sound.play(effect as AnySound)
    }
    if (session.menu) this.releaseMouse()
  }

  /** Returns whether the key belongs to the game, so the caller can prevent its default. */
  keyDown(event: KeyboardEvent): boolean {
    this.sound.unlock()
    const code = codeOf(event)
    const { session } = this
    if (code === 'Backquote') {
      this.showStats = !this.showStats
      return true
    }
    const menuKeyFor = FUNCTION_KEYS[code]
    if (menuKeyFor) {
      if (!event.repeat) {
        const effects = menuKey(session, menuKeyFor)
        if (effects.length) this.releaseKeys()
        this.apply(effects)
      }
      return true
    }
    if (session.menu || session.screen.kind !== 'playing') {
      if (code === 'Escape' && performance.now() - this.lockLostAt < 150) return true
      if (session.menu?.typing != null && event.key.length === 1 && typeChar(session, event.key)) return true
      if (event.repeat && !REPEATING.has(code)) return true
      this.apply(command(session, MENU_KEYS[code] ?? 'any'))
      return true
    }
    if (code === 'Pause') {
      if (!event.repeat && togglePause(session)) this.releaseKeys()
      return true
    }
    if (code === 'Escape') {
      if (performance.now() - this.lockLostAt < 150) return true
      this.releaseMouse()
      this.apply(command(session, 'back'))
      return true
    }
    if (code === 'Tab') {
      if (!event.repeat) automapCommand(session, 'toggle')
      return true
    }
    const mapKey = session.automap.open ? AUTOMAP_KEYS[code] : undefined
    if (mapKey) {
      if (!event.repeat) automapCommand(session, mapKey)
      return true
    }
    if (!event.repeat) {
      if (USE.includes(code)) this.useQueued = true
      const slot = SLOTS[code]
      if (slot) this.weaponQueued = slot
    }
    this.held.add(code)
    return GAME_KEYS.has(code)
  }

  keyUp(event: KeyboardEvent): void {
    this.held.delete(codeOf(event))
  }

  /** Clears held keys, for when the window loses focus and key-ups go elsewhere, and on pause. */
  releaseKeys(): void {
    this.held.clear()
    this.mouseFire = false
    this.mouseTurn = 0
    this.useQueued = false
  }

  private point(clientX: number, clientY: number) {
    return toFramebuffer(this.canvas.getBoundingClientRect(), clientX, clientY, SCREEN_W, SCREEN_H)
  }

  private get inMenus(): boolean {
    return this.session.menu !== null || this.session.screen.kind !== 'playing'
  }

  mouseDown(button: number, clientX: number, clientY: number): void {
    this.sound.unlock()
    if (this.inMenus) {
      const { x, y } = this.point(clientX, clientY)
      this.apply(menuPointer(this.session, 'down', x, y, button))
      return
    }
    if (document.pointerLockElement !== this.canvas) {
      void this.canvas.requestPointerLock()
      return
    }
    if (button === 0) this.mouseFire = true
    if (button === 2) this.useQueued = true
  }

  mouseUp(button: number, clientX: number, clientY: number): void {
    if (button === 0) this.mouseFire = false
    if (!this.session.menu || document.pointerLockElement === this.canvas) return
    const { x, y } = this.point(clientX, clientY)
    this.apply(menuPointer(this.session, 'up', x, y, button))
  }

  /** Turns with the locked mouse in play, and moves the menu selection with the free pointer. */
  mouseMove(event: MouseEvent): void {
    if (document.pointerLockElement === this.canvas) {
      this.mouseTurn += event.movementX * mouseScale(this.session.options)
      return
    }
    if (!this.session.menu || event.target !== this.canvas) return
    const { x, y } = this.point(event.clientX, event.clientY)
    this.apply(menuPointer(this.session, 'move', x, y))
  }

  /** Esc releases pointer lock before the page sees the key, so losing the lock opens the menu. */
  pointerLockChanged(): void {
    if (document.pointerLockElement === this.canvas) return
    this.lockLostAt = performance.now()
    this.mouseFire = false
    if (this.running && this.session.screen.kind === 'playing' && !this.session.menu)
      this.apply(command(this.session, 'back'))
  }

  private releaseMouse(): void {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
  }

  private draw(inactive = false): void {
    const { session, frame, assets } = this
    const { screen, world, automap } = session
    const viewH = session.options.statusBar || automap.open ? VIEW_H : SCREEN_H
    if (screen.kind === 'title') {
      if (session.menu) frame.pixels.set(this.backdrop.pixels)
      else drawTitle(frame, this.backdrop, this.clock)
    } else if (screen.kind === 'intermission') drawIntermission(frame, this.backdrop, screen)
    else if (screen.kind === 'finale')
      drawFinale(frame, this.backdrop, screen, session.episode, session.skill)
    else if (world) {
      if (automap.open) drawAutomap(frame, world, automap, viewH)
      else renderView(frame, world, assets, this.zbuf, viewH)
      if (viewH === VIEW_H) drawStatusBar(frame, this.bar, world, assets.sprites)
      drawMessage(frame, world, viewH)
      if ((inactive || session.paused) && !session.menu) drawPaused(frame, viewH)
    }
    drawMenu(frame, session, this.clock)
    if (this.showStats) drawStats(frame, this.statsLines())
  }

  private statsLines(): string[] {
    const { p50, p95, work50, work95 } = this.timing
    const lines = [
      `FRAME ${this.frames}`,
      `MS ${p50.toFixed(1)} P95 ${p95.toFixed(1)}`,
      `WORK ${work50.toFixed(1)} P95 ${work95.toFixed(1)}`,
    ]
    const world = this.session.world
    if (world) {
      const { stats } = world
      lines.push(
        `K ${stats.kills}/${stats.totalKills} I ${stats.items}/${stats.totalItems} S ${stats.secrets}/${stats.totalSecrets}`,
      )
    }
    return lines
  }

  private present(): void {
    new Uint32Array(this.image.data.buffer).set(this.frame.pixels)
    this.ctx.putImageData(this.image, 0, 0)
  }

  /** Publishes the frame timing and what is on screen as data attributes, for the proof scripts. */
  private record(interval: number, work: number): void {
    const i = this.frames % SAMPLES
    this.intervals[i] = interval
    this.work[i] = work
    this.frames++
    const { canvas, session } = this
    const { world, menu, automap } = session
    const data = canvas.dataset
    data.frame = String(this.frames)
    data.screen = menu ? `menu-${menu.page}` : session.screen.kind
    data.cursor = menu ? String(menu.cursor) : ''
    data.typing = menu?.typing ?? ''
    data.paused = String(session.paused)
    data.automap = automap.open ? (automap.follow ? 'follow' : 'free') : 'off'
    data.options = JSON.stringify(session.options)
    data.slots = session.slots.map((save) => save?.name ?? '').join('|')
    if (world) {
      data.level = String(session.level + 1)
      data.kills = `${world.stats.kills}/${world.stats.totalKills}`
      data.player = `${world.player.x.toFixed(2)},${world.player.y.toFixed(2)},${world.player.angle.toFixed(3)}`
      data.time = world.time.toFixed(3)
      data.hp = String(world.player.hp)
      data.message = world.message?.text ?? ''
    }
    if (this.frames % 30 !== 0) return
    const n = Math.min(this.frames, SAMPLES)
    const pick = (source: Float32Array) => {
      const view = this.sorted.subarray(0, n)
      view.set(source.subarray(0, n))
      view.sort()
      return [percentile(view, 0.5), percentile(view, 0.95)] as const
    }
    const [p50, p95] = pick(this.intervals)
    const [work50, work95] = pick(this.work)
    this.timing = { p50, p95, work50, work95 }
    data.frameP50 = p50.toFixed(2)
    data.frameP95 = p95.toFixed(2)
    data.workP50 = work50.toFixed(2)
    data.workP95 = work95.toFixed(2)
    data.samples = String(n)
  }
}
