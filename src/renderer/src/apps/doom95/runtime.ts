import { createBitmap } from './art'
import type { WeaponId } from './defs'
import { TICK, type TickInput } from './game'
import { buildStatusBackground, drawStatusBar } from './hud'
import { type Assets, buildLut, renderView, SCREEN_H, SCREEN_W } from './render'
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
  type Command,
  command,
  createSession,
  type Session,
  type SessionEffect,
  tickSession,
} from './session'
import { type AnySound, SoundBoard } from './sound'
import { buildSprites } from './sprites'
import { buildTextures } from './textures'

const MOUSE_SENSITIVITY = 0.0032
const SAMPLES = 600

const FORWARD = ['KeyW', 'ArrowUp']
const BACK = ['KeyS', 'ArrowDown']
const STRAFE_LEFT = ['KeyA', 'Comma']
const STRAFE_RIGHT = ['KeyD', 'Period']
const TURN_LEFT = ['ArrowLeft']
const TURN_RIGHT = ['ArrowRight']
const RUN = ['ShiftLeft', 'ShiftRight']
const FIRE = ['ControlLeft', 'ControlRight']
const USE = ['Space', 'KeyE']
const SLOTS: Readonly<Record<string, WeaponId>> = { Digit1: 'fist', Digit2: 'pistol', Digit3: 'shotgun' }
/** Keys the game owns while it has focus, so the page never scrolls or acts on them. */
const GAME_KEYS = new Set([
  ...FORWARD,
  ...BACK,
  ...STRAFE_LEFT,
  ...STRAFE_RIGHT,
  ...TURN_LEFT,
  ...TURN_RIGHT,
  ...USE,
  ...FIRE,
  'Enter',
  'Escape',
  'Backquote',
  ...Object.keys(SLOTS),
])

const MENU_KEYS: Readonly<Record<string, Command>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  Enter: 'confirm',
  Space: 'confirm',
  KeyE: 'confirm',
  Escape: 'back',
  Backspace: 'back',
  KeyY: 'yes',
}

const NAMED_KEYS: Readonly<Record<string, string>> = {
  ' ': 'Space',
  Control: 'ControlLeft',
  Shift: 'ShiftLeft',
  ',': 'Comma',
  '.': 'Period',
  '`': 'Backquote',
}

/** The physical key. Some synthetic and remote-desktop input leaves `code` empty, so derive it. */
function codeOf(event: KeyboardEvent): string {
  if (event.code) return event.code
  const { key } = event
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`
  if (/^[0-9]$/.test(key)) return `Digit${key}`
  return NAMED_KEYS[key] ?? key
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
  private readonly session: Session = createSession((Date.now() & 0xffff) + 1)
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
    this.last = performance.now()
    this.accumulator = 0
    this.raf = requestAnimationFrame(this.loop)
  }

  /** Stops the loop and leaves a paused frame on screen. */
  stop(): void {
    if (!this.raf) return
    cancelAnimationFrame(this.raf)
    this.raf = 0
    this.held.clear()
    this.mouseFire = false
    if (document.pointerLockElement === this.canvas) document.exitPointerLock()
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

  /** Builds one tick's controls, consuming the one-shot presses and mouse motion. */
  private input(): TickInput {
    const down = (codes: readonly string[]) => (codes.some((code) => this.held.has(code)) ? 1 : 0)
    const input: TickInput = {
      forward: down(FORWARD) - down(BACK),
      strafe: down(STRAFE_RIGHT) - down(STRAFE_LEFT),
      turn: down(TURN_RIGHT) - down(TURN_LEFT),
      mouseTurn: this.mouseTurn,
      run: down(RUN) === 1,
      fire: down(FIRE) === 1 || this.mouseFire,
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
    for (const effect of effects) {
      if (effect === 'quit') this.onQuit()
      else this.sound.play(effect as AnySound)
    }
  }

  /** Returns whether the key belongs to the game, so the caller can prevent its default. */
  keyDown(event: KeyboardEvent): boolean {
    this.sound.unlock()
    const code = codeOf(event)
    if (code === 'Backquote') {
      this.showStats = !this.showStats
      return true
    }
    const { session } = this
    const playing = session.screen.kind === 'playing' && !session.menu
    if (!playing) {
      if (event.repeat) return GAME_KEYS.has(code)
      if (code === 'Escape' && performance.now() - this.lockLostAt < 150) return true
      this.apply(command(session, MENU_KEYS[code] ?? 'any'))
      return true
    }
    if (code === 'Escape') {
      if (performance.now() - this.lockLostAt < 150) return true
      this.releaseMouse()
      this.apply(command(session, 'back'))
      return true
    }
    if (!event.repeat) {
      if (USE.includes(code)) this.useQueued = true
      const slot = SLOTS[code]
      if (slot) this.weaponQueued = slot
    }
    this.held.add(code)
    return GAME_KEYS.has(code) || RUN.includes(code)
  }

  keyUp(event: KeyboardEvent): void {
    this.held.delete(codeOf(event))
  }

  /** Clears held keys, for when the window loses focus and key-ups go elsewhere. */
  releaseKeys(): void {
    this.held.clear()
    this.mouseFire = false
  }

  mouseDown(button: number): void {
    this.sound.unlock()
    const { session } = this
    if (session.screen.kind !== 'playing' || session.menu) {
      if (button === 0) this.apply(command(session, session.menu ? 'confirm' : 'any'))
      return
    }
    if (document.pointerLockElement !== this.canvas) {
      void this.canvas.requestPointerLock()
      return
    }
    if (button === 0) this.mouseFire = true
    if (button === 2) this.useQueued = true
  }

  mouseUp(button: number): void {
    if (button === 0) this.mouseFire = false
  }

  mouseMove(dx: number): void {
    if (document.pointerLockElement === this.canvas) this.mouseTurn += dx * MOUSE_SENSITIVITY
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

  private draw(paused = false): void {
    const { session, frame, assets } = this
    const { screen, world } = session
    if (screen.kind === 'title') {
      if (session.menu) frame.pixels.set(this.backdrop.pixels)
      else drawTitle(frame, this.backdrop, this.clock)
    } else if (screen.kind === 'intermission') drawIntermission(frame, this.backdrop, screen)
    else if (screen.kind === 'finale') drawFinale(frame, this.backdrop, screen.time)
    else if (world) {
      renderView(frame, world, assets, this.zbuf)
      drawStatusBar(frame, this.bar, world, assets.sprites)
      drawMessage(frame, world)
    }
    if (session.menu) drawMenu(frame, session.menu, session.skill, this.clock)
    if (paused && screen.kind === 'playing' && !session.menu) drawPaused(frame)
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

  private record(interval: number, work: number): void {
    const i = this.frames % SAMPLES
    this.intervals[i] = interval
    this.work[i] = work
    this.frames++
    const { canvas, session } = this
    const world = session.world
    canvas.dataset.frame = String(this.frames)
    canvas.dataset.screen = session.menu ? `menu-${session.menu.page}` : session.screen.kind
    if (world) {
      canvas.dataset.level = String(session.level + 1)
      canvas.dataset.kills = `${world.stats.kills}/${world.stats.totalKills}`
      canvas.dataset.player = `${world.player.x.toFixed(2)},${world.player.y.toFixed(2)},${world.player.angle.toFixed(3)}`
      canvas.dataset.hp = String(world.player.hp)
      canvas.dataset.message = world.message?.text ?? ''
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
    canvas.dataset.frameP50 = p50.toFixed(2)
    canvas.dataset.frameP95 = p95.toFixed(2)
    canvas.dataset.workP50 = work50.toFixed(2)
    canvas.dataset.workP95 = work95.toFixed(2)
    canvas.dataset.samples = String(n)
  }
}
