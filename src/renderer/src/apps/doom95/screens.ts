import { type Bitmap, mix, Painter, rgb, shade } from './art'
import { SKILLS, type Skill } from './defs'
import { drawCentered, drawText, textWidth } from './font'
import { LEVELS } from './levels'
import { SCREEN_H, SCREEN_W, VIEW_H } from './render'
import { createRng } from './rng'
import { MAIN_ITEMS, type Menu, type Screen, TALLY_TIME } from './session'
import type { World } from './world'

const RED = rgb(220, 30, 20)
const GOLD = rgb(240, 200, 60)
const PALE = rgb(230, 226, 210)
const GRAY = rgb(150, 146, 136)

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

function logo(frame: Bitmap, y: number, scale: number): void {
  const text = 'DOOM 95'
  const x = Math.round(SCREEN_W / 2 - textWidth(text, scale) / 2)
  drawText(frame, text, x + 2, y + 2, { color: rgb(20, 4, 2), scale })
  drawText(frame, text, x, y, { color: rgb(200, 190, 170), scale, gradient: true })
}

export function drawTitle(frame: Bitmap, backdrop: Bitmap, time: number): void {
  frame.pixels.set(backdrop.pixels)
  logo(frame, 34, 6)
  drawCentered(frame, 'A WINDOWS 95 ORIGINAL', 86, { color: GOLD, shadow: true })
  if (Math.floor(time * 2) % 2 === 0) drawCentered(frame, 'PRESS ANY KEY', 150, { color: PALE, shadow: true })
}

export function drawMenu(frame: Bitmap, menu: Menu, skill: Skill, time: number): void {
  darken(frame, 0.45)
  logo(frame, 14, 4)
  const cursorOn = Math.floor(time * 3) % 2 === 0
  const items = (labels: readonly string[], top: number, scale: number, gap: number) => {
    const width = Math.max(...labels.map((label) => textWidth(label, scale)))
    const left = Math.round(SCREEN_W / 2 - width / 2)
    labels.forEach((label, i) => {
      const y = top + i * gap
      drawText(frame, label, left, y, { color: RED, scale, shadow: true })
      if (i === menu.cursor && cursorOn)
        drawText(frame, '>', left - 6 * scale - 4, y, { color: GOLD, scale, shadow: true })
    })
  }
  if (menu.page === 'main') items(MAIN_ITEMS, 72, 2, 22)
  else if (menu.page === 'skill') {
    drawCentered(frame, 'NEW GAME', 52, { color: PALE, shadow: true })
    drawCentered(frame, 'CHOOSE SKILL LEVEL:', 64, { color: GRAY, shadow: true })
    items(
      SKILLS.map((s) => s.name),
      82,
      2,
      20,
    )
  } else {
    drawCentered(frame, 'ARE YOU SURE YOU WANT TO', 84, { color: PALE, shadow: true })
    drawCentered(frame, 'QUIT THIS GREAT GAME?', 96, { color: PALE, shadow: true })
    drawCentered(frame, '(PRESS Y TO QUIT)', 116, { color: GRAY, shadow: true })
  }
  if (menu.page === 'main')
    drawCentered(frame, `SKILL: ${SKILLS[skill]?.name ?? ''}`.toUpperCase(), 160, { color: GRAY })
}

const clock = (seconds: number) => {
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const percent = (have: number, total: number) => (total === 0 ? 100 : Math.floor((have / total) * 100))

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
  const rows: [string, string][] = [
    ['KILLS', `${tally(percent(stats.kills, stats.totalKills))}%`],
    ['ITEMS', `${tally(percent(stats.items, stats.totalItems))}%`],
    ['SECRET', `${tally(percent(stats.secrets, stats.totalSecrets))}%`],
    ['TIME', clock(stats.time * t)],
    ['PAR', clock(level?.par ?? 0)],
  ]
  rows.forEach(([label, value], i) => {
    const y = 58 + i * 20
    drawText(frame, label, 70, y, { color: RED, scale: 2, shadow: true })
    drawText(frame, value, 250 - textWidth(value, 2), y, { color: RED, scale: 2, shadow: true })
  })
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

export function drawFinale(frame: Bitmap, backdrop: Bitmap, time: number): void {
  frame.pixels.set(backdrop.pixels)
  darken(frame, 0.5)
  const shown = Math.floor(time * 30)
  let budget = shown
  FINALE.forEach((line, i) => {
    const visible = line.slice(0, Math.max(0, budget))
    budget -= line.length + 4
    drawText(frame, visible, 40, 30 + i * 12, { color: PALE, shadow: true })
  })
  if (time > 1) drawCentered(frame, 'PRESS SPACE', 180, { color: GOLD, shadow: true })
}

export function drawMessage(frame: Bitmap, world: World): void {
  if (world.message) drawText(frame, world.message.text.toUpperCase(), 4, 4, { color: PALE, shadow: true })
  if (world.player.dead && world.player.deadTime > 1)
    drawCentered(frame, 'PRESS SPACE TO TRY AGAIN', VIEW_H / 2 + 20, { color: PALE, shadow: true })
}

export function drawPaused(frame: Bitmap): void {
  darken(frame, 0.6, VIEW_H)
  drawCentered(frame, 'PAUSE', VIEW_H / 2 - 10, { color: RED, scale: 3, shadow: true })
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
