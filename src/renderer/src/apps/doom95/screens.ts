import { type Bitmap, mix, Painter, rgb, shade } from './art'
import { SKILLS } from './defs'
import { drawCentered, drawText, textWidth } from './font'
import { LEVELS } from './levels'
import {
  MAIN_ITEMS,
  type MenuRow,
  menuRows,
  OPTION_ITEMS,
  optionStep,
  QUIT_ITEMS,
  SLOT_H,
  SLOT_W,
  SLOT_X,
} from './menus'
import { SCREEN_H, SCREEN_W } from './render'
import { createRng } from './rng'
import { type Menu, type Screen, type Session, TALLY_TIME } from './session'
import type { Stats, World } from './world'

const RED = rgb(220, 30, 20)
const GOLD = rgb(240, 200, 60)
const PALE = rgb(230, 226, 210)
const GRAY = rgb(150, 146, 136)
const DIM = rgb(96, 92, 84)

/** The rock backdrop behind the title, intermission, and finale, built once. */
export function buildBackdrop(): Bitmap {
  const p = Painter.create(SCREEN_W, SCREEN_H)
  const rng = createRng(666)
  p.rect(0, 0, SCREEN_W, SCREEN_H, (_, y) => shade(rgb(64, 22, 14), 0.7 + rng() * 0.3 - (y / SCREEN_H) * 0.3))
  for (let i = 0; i < 160; i++) {
    const x = rng() * SCREEN_W
    const y = rng() * SCREEN_H
    p.ball(x, y, 4 + rng() * 14, 3 + rng() * 8, mix(rgb(90, 34, 20), rgb(36, 12, 8), rng()))
  }
  p.grain(rng, 0.25)
  for (let x = 0; x < SCREEN_W; x++) {
    const h = 18 + Math.sin(x * 0.07) * 6 + Math.sin(x * 0.23) * 3
    for (let y = SCREEN_H - Math.floor(h); y < SCREEN_H; y++)
      p.set(x, y, mix(rgb(250, 120, 20), rgb(120, 20, 10), (SCREEN_H - y) / h))
  }
  return p.bitmap
}

function darken(frame: Bitmap, f: number, height = SCREEN_H): void {
  const end = height * SCREEN_W
  for (let i = 0; i < end; i++) frame.pixels[i] = shade(frame.pixels[i] ?? 0, f)
}

function fill(frame: Bitmap, x: number, y: number, w: number, h: number, color: number): void {
  for (let j = Math.max(0, y); j < Math.min(frame.height, y + h); j++)
    frame.pixels.fill(color, j * frame.width + Math.max(0, x), j * frame.width + Math.min(frame.width, x + w))
}

function logo(frame: Bitmap, y: number, scale: number, text = 'DOOM 95'): void {
  const x = Math.round(SCREEN_W / 2 - textWidth(text, scale) / 2)
  drawText(frame, text, x + 2, y + 2, { color: rgb(20, 4, 2), scale })
  drawText(frame, text, x, y, { color: rgb(200, 190, 170), scale, gradient: true })
}

export function drawTitle(frame: Bitmap, backdrop: Bitmap, time: number): void {
  frame.pixels.set(backdrop.pixels)
  logo(frame, 34, 6)
  drawCentered(frame, 'A WINDOWS 95 ORIGINAL', 86, { color: GOLD, shadow: true })
  if (Math.floor(time * 2) % 2 === 0) drawCentered(frame, 'PRESS ANY KEY', 150, { color: PALE, shadow: true })
  drawCentered(frame, 'F1: READ THIS!', 164, { color: GRAY, shadow: true })
}

const title = (frame: Bitmap, text: string) =>
  drawCentered(frame, text, 18, { color: RED, scale: 2, shadow: true })
const hint = (frame: Bitmap, text: string) => drawCentered(frame, text, 156, { color: GRAY, shadow: true })

function cursor(frame: Bitmap, row: MenuRow, on: boolean): void {
  if (!on) return
  const { x, y, scale } = row.label
  drawText(frame, '>', x - 6 * scale - 4, y, { color: GOLD, scale, shadow: true })
}

function labels(frame: Bitmap, menu: Menu, texts: readonly string[], on: boolean): void {
  for (const row of menuRows(menu.page)) {
    const { x, y, scale } = row.label
    drawText(frame, texts[row.index] ?? '', x, y, { color: RED, scale, shadow: true })
    cursor(frame, row, on && row.index === menu.cursor)
  }
}

function drawOptions(frame: Bitmap, session: Session, menu: Menu, on: boolean): void {
  title(frame, 'OPTIONS')
  for (const row of menuRows('options')) {
    const item = OPTION_ITEMS[row.index]
    if (!item) continue
    const { x, y, scale } = row.label
    drawText(frame, item.label, x, y, { color: RED, scale, shadow: true })
    cursor(frame, row, on && row.index === menu.cursor)
    const value = optionStep(session.options, item)
    if (item.kind === 'toggle') {
      row.choices.forEach((box, i) => {
        const chosen = i === value
        if (chosen) fill(frame, box.x, box.y + box.h, box.w, 1, GOLD)
        drawText(frame, item.values[i] ?? '', box.x + 3, box.y + 2, {
          color: chosen ? GOLD : DIM,
          shadow: true,
        })
      })
      continue
    }
    const first = row.choices[0]
    const last = row.choices[row.choices.length - 1]
    if (!first || !last) continue
    fill(frame, first.x - 2, first.y - 2, last.x + last.w - first.x + 4, first.h + 4, rgb(70, 66, 60))
    fill(frame, first.x - 1, first.y - 1, last.x + last.w - first.x + 2, first.h + 2, rgb(16, 12, 10))
    row.choices.forEach((box, i) => {
      fill(frame, box.x + box.w - 1, box.y + 3, 1, box.h - 6, rgb(70, 66, 60))
      if (i === value) fill(frame, box.x + 1, box.y + 1, box.w - 2, box.h - 2, RED)
    })
    drawText(frame, String(value), last.x + last.w + 8, first.y + 2, { color: PALE, shadow: true })
  }
  hint(frame, 'LEFT AND RIGHT CHANGE A SETTING')
}

function drawSlots(frame: Bitmap, session: Session, menu: Menu, on: boolean, time: number): void {
  title(frame, menu.page === 'save' ? 'SAVE GAME' : 'LOAD GAME')
  for (const row of menuRows(menu.page)) {
    const save = session.slots[row.index]
    const top = row.box.y + 2
    fill(frame, SLOT_X, top, SLOT_W, SLOT_H, rgb(70, 66, 60))
    fill(frame, SLOT_X + 1, top + 1, SLOT_W - 2, SLOT_H - 2, rgb(16, 12, 10))
    const typing = menu.typing !== null && row.index === menu.cursor
    const { x, y } = row.label
    if (typing) {
      const caret = Math.floor(time * 3) % 2 === 0 ? '_' : ''
      drawText(frame, `${menu.typing}${caret}`, x, y, { color: GOLD })
    } else if (save) {
      drawText(frame, save.name, x, y, { color: PALE })
      const code = (LEVELS[save.level]?.name ?? '').split(':')[0] ?? ''
      drawText(frame, code, SLOT_X + SLOT_W - 4 - textWidth(code), y, { color: GRAY })
    } else drawText(frame, 'EMPTY SLOT', x, y, { color: DIM })
    if (on && row.index === menu.cursor) drawText(frame, '>', SLOT_X - 10, y, { color: GOLD, shadow: true })
  }
  hint(
    frame,
    menu.page === 'load'
      ? 'ENTER LOADS THE SLOT. ESC GOES BACK.'
      : menu.typing !== null
        ? 'TYPE A NAME, THEN PRESS ENTER.'
        : 'ENTER NAMES THE SLOT. ESC GOES BACK.',
  )
}

const HELP: readonly (readonly [string, string])[] = [
  ['MOVE', 'ARROWS UP AND DOWN, OR W AND S'],
  ['TURN', 'ARROWS LEFT AND RIGHT, OR MOUSE'],
  ['STRAFE', 'ALT + ARROWS, OR A AND D'],
  ['RUN', 'HOLD SHIFT'],
  ['FIRE', 'CTRL, OR THE LEFT MOUSE BUTTON'],
  ['USE, OPEN', 'SPACE, OR THE RIGHT MOUSE BUTTON'],
  ['WEAPONS', '1 FIST   2 PISTOL   3 SHOTGUN'],
  ['AUTOMAP', 'TAB.  F FOLLOWS,  + AND - ZOOM'],
  ['PAUSE', 'PAUSE'],
  ['MENU', 'ESC'],
]

function drawHelp(frame: Bitmap): void {
  darken(frame, 0.2)
  title(frame, 'READ THIS!')
  HELP.forEach(([label, keys], i) => {
    const y = 38 + i * 11
    drawText(frame, label, 22, y, { color: GOLD, shadow: true })
    drawText(frame, keys, 100, y, { color: PALE, shadow: true })
  })
  drawCentered(frame, 'F1 HELP  F2 SAVE  F3 LOAD  F4 OPTIONS  F10 QUIT', 154, { color: GRAY, shadow: true })
  drawCentered(frame, 'FIND THE EXIT SWITCH AND PRESS SPACE ON IT.', 166, { color: RED, shadow: true })
  drawCentered(frame, 'A COLORED DOOR NEEDS ITS KEYCARD.', 176, { color: RED, shadow: true })
  drawCentered(frame, 'PRESS ANY KEY', 189, { color: GRAY, shadow: true })
}

function drawNotice(frame: Bitmap, menu: Menu): void {
  const lines = [...menu.text, '', 'PRESS A KEY.']
  lines.forEach((line, i) => {
    drawCentered(frame, line, 84 + i * 12, { color: i < menu.text.length ? PALE : GRAY, shadow: true })
  })
}

export function drawMenu(frame: Bitmap, session: Session, time: number): void {
  const menu = session.menu
  if (!menu) return
  if (menu.page === 'help') {
    drawHelp(frame)
    return
  }
  darken(frame, 0.45)
  const on = Math.floor(time * 3) % 2 === 0
  switch (menu.page) {
    case 'main':
      logo(frame, 8, 4)
      labels(
        frame,
        menu,
        MAIN_ITEMS.map((item) => item.label),
        on,
      )
      drawCentered(frame, `SKILL: ${SKILLS[session.skill]?.name ?? ''}`.toUpperCase(), 158, { color: GRAY })
      return
    case 'skill':
      drawCentered(frame, 'NEW GAME', 36, { color: PALE, shadow: true })
      drawCentered(frame, 'CHOOSE SKILL LEVEL:', 48, { color: GRAY, shadow: true })
      labels(
        frame,
        menu,
        SKILLS.map((skill) => skill.name),
        on,
      )
      return
    case 'options':
      drawOptions(frame, session, menu, on)
      return
    case 'load':
    case 'save':
      drawSlots(frame, session, menu, on, time)
      return
    case 'quit':
      drawCentered(frame, 'ARE YOU SURE YOU WANT TO', 84, { color: PALE, shadow: true })
      drawCentered(frame, 'QUIT THIS GREAT GAME?', 96, { color: PALE, shadow: true })
      labels(frame, menu, QUIT_ITEMS, on)
      drawCentered(frame, '(PRESS Y TO QUIT)', 150, { color: GRAY, shadow: true })
      return
    case 'notice':
      drawNotice(frame, menu)
      return
  }
}

const clock = (seconds: number) => {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const percent = (have: number, total: number) => (total === 0 ? 100 : Math.floor((have / total) * 100))

function tallyRows(frame: Bitmap, rows: readonly (readonly [string, string])[], top: number): void {
  rows.forEach(([label, value], i) => {
    const y = top + i * 20
    drawText(frame, label, 70, y, { color: RED, scale: 2, shadow: true })
    drawText(frame, value, 250 - textWidth(value, 2), y, { color: RED, scale: 2, shadow: true })
  })
}

export function drawIntermission(
  frame: Bitmap,
  backdrop: Bitmap,
  screen: Extract<Screen, { kind: 'intermission' }>,
): void {
  frame.pixels.set(backdrop.pixels)
  darken(frame, 0.7)
  const level = LEVELS[screen.level]
  const next = LEVELS[screen.level + 1]
  const { stats } = screen
  const t = Math.min(1, screen.time / TALLY_TIME)
  const tally = (value: number) => Math.floor(value * t)
  drawCentered(frame, (level?.name ?? '').toUpperCase(), 14, { color: RED, scale: 2, shadow: true })
  drawCentered(frame, 'FINISHED', 34, { color: PALE, shadow: true })
  tallyRows(
    frame,
    [
      ['KILLS', `${tally(percent(stats.kills, stats.totalKills))}%`],
      ['ITEMS', `${tally(percent(stats.items, stats.totalItems))}%`],
      ['SECRET', `${tally(percent(stats.secrets, stats.totalSecrets))}%`],
      ['TIME', clock(stats.time * t)],
      ['PAR', clock(level?.par ?? 0)],
    ],
    58,
  )
  if (screen.time >= TALLY_TIME) {
    const hint = next ? `ENTERING ${next.name.toUpperCase()}` : 'EPISODE COMPLETE'
    drawCentered(frame, hint, 166, { color: GOLD, shadow: true })
    drawCentered(frame, 'PRESS SPACE', 180, { color: PALE, shadow: true })
  }
}

const FINALE = [
  'THE REACTOR FALLS SILENT.',
  '',
  'YOU HAVE PUNCHED, SHOT, AND',
  'BLASTED YOUR WAY THROUGH THE',
  'OUTPOST, THE FOUNDRY, AND THE',
  'REACTOR. THE INVASION IS',
  'BROKEN, FOR NOW.',
  '',
  'TIME TO GO HOME.',
]

function drawEnd(frame: Bitmap, episode: Stats, skill: number, time: number): void {
  darken(frame, 0.35)
  logo(frame, 22, 5, 'THE END')
  drawCentered(frame, 'EPISODE ONE COMPLETE', 62, { color: GOLD, shadow: true })
  tallyRows(
    frame,
    [
      ['KILLS', `${percent(episode.kills, episode.totalKills)}%`],
      ['ITEMS', `${percent(episode.items, episode.totalItems)}%`],
      ['SECRET', `${percent(episode.secrets, episode.totalSecrets)}%`],
      ['TIME', clock(episode.time)],
    ],
    80,
  )
  drawCentered(frame, `SKILL: ${SKILLS[skill]?.name ?? ''}`.toUpperCase(), 164, { color: GRAY, shadow: true })
  if (time > 1) drawCentered(frame, 'PRESS SPACE', 180, { color: PALE, shadow: true })
}

export function drawFinale(
  frame: Bitmap,
  backdrop: Bitmap,
  screen: Extract<Screen, { kind: 'finale' }>,
  episode: Stats,
  skill: number,
): void {
  frame.pixels.set(backdrop.pixels)
  if (screen.page === 'end') {
    drawEnd(frame, episode, skill, screen.time)
    return
  }
  darken(frame, 0.5)
  let budget = Math.floor(screen.time * 30)
  FINALE.forEach((line, i) => {
    const visible = line.slice(0, Math.max(0, budget))
    budget -= line.length + 4
    drawText(frame, visible, 40, 30 + i * 12, { color: PALE, shadow: true })
  })
  if (screen.time > 1) drawCentered(frame, 'PRESS SPACE', 180, { color: GOLD, shadow: true })
}

export function drawMessage(frame: Bitmap, world: World, viewH: number): void {
  if (world.message) drawText(frame, world.message.text.toUpperCase(), 4, 4, { color: PALE, shadow: true })
  if (world.player.dead && world.player.deadTime > 1)
    drawCentered(frame, 'PRESS SPACE TO TRY AGAIN', viewH / 2 + 20, { color: PALE, shadow: true })
}

export function drawPaused(frame: Bitmap, viewH: number): void {
  darken(frame, 0.6, viewH)
  drawCentered(frame, 'PAUSE', viewH / 2 - 10, { color: RED, scale: 3, shadow: true })
}

/** The frame counter and timing readout, toggled with the backquote key. */
export function drawStats(frame: Bitmap, lines: readonly string[]): void {
  lines.forEach((line, i) => {
    const x = SCREEN_W - 4 - textWidth(line)
    const y = 4 + i * 9
    for (let j = y - 1; j < y + 8; j++)
      frame.pixels.fill(0xff000000, j * SCREEN_W + x - 2, j * SCREEN_W + SCREEN_W - 2)
    drawText(frame, line, x, y, { color: rgb(120, 255, 120) })
  })
}
