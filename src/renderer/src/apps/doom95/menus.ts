import { SKILLS } from './defs'
import { textWidth } from './font'
import { MOUSE_STEPS, type Options, VOLUME_STEPS } from './options'
import { SAVE_SLOTS } from './savegame'

/**
 * Menu pages, their items, and where each item sits on the 320x200 screen. Drawing and mouse hit
 * testing both read the rows from `menuRows`, so a click always lands on what the player sees.
 */
export type MenuPage = 'main' | 'skill' | 'options' | 'load' | 'save' | 'help' | 'notice' | 'quit'

export type MainAction = 'newGame' | 'options' | 'load' | 'save' | 'help' | 'quit'

export const MAIN_ITEMS: readonly { readonly action: MainAction; readonly label: string }[] = [
  { action: 'newGame', label: 'New Game' },
  { action: 'options', label: 'Options' },
  { action: 'load', label: 'Load Game' },
  { action: 'save', label: 'Save Game' },
  { action: 'help', label: 'Read This!' },
  { action: 'quit', label: 'Quit Game' },
]

export const mainIndex = (action: MainAction): number =>
  MAIN_ITEMS.findIndex((item) => item.action === action)

export type OptionItem =
  | {
      readonly kind: 'toggle'
      readonly key: 'statusBar'
      readonly label: string
      readonly values: readonly [string, string]
    }
  | {
      readonly kind: 'slider'
      readonly key: 'mouse' | 'volume'
      readonly label: string
      readonly steps: number
    }

export const OPTION_ITEMS: readonly OptionItem[] = [
  { kind: 'toggle', key: 'statusBar', label: 'Screen Size', values: ['Status Bar', 'Full Screen'] },
  { kind: 'slider', key: 'mouse', label: 'Mouse Sensitivity', steps: MOUSE_STEPS },
  { kind: 'slider', key: 'volume', label: 'Sound Volume', steps: VOLUME_STEPS },
]

/** The step an option sits at, so toggles and sliders share one model. Status bar on is step 0. */
export function optionStep(options: Options, item: OptionItem): number {
  if (item.kind === 'toggle') return options.statusBar ? 0 : 1
  return options[item.key]
}

export function withOptionStep(options: Options, item: OptionItem, value: number): Options {
  if (item.kind === 'toggle') return { ...options, statusBar: value === 0 }
  return { ...options, [item.key]: Math.max(0, Math.min(item.steps - 1, value)) }
}

export const optionSteps = (item: OptionItem): number => (item.kind === 'toggle' ? 2 : item.steps)

export const QUIT_ITEMS = ['Yes', 'No'] as const
export const QUIT_NO = 1

export function itemCount(page: MenuPage): number {
  switch (page) {
    case 'main':
      return MAIN_ITEMS.length
    case 'skill':
      return SKILLS.length
    case 'options':
      return OPTION_ITEMS.length
    case 'load':
    case 'save':
      return SAVE_SLOTS
    case 'quit':
      return QUIT_ITEMS.length
    case 'help':
    case 'notice':
      return 0
  }
}

export interface Box {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

export interface MenuRow {
  readonly index: number
  /** The clickable area, which includes the cursor's place to the left of the label. */
  readonly box: Box
  readonly label: { readonly x: number; readonly y: number; readonly scale: number }
  /** A slider's steps or a toggle's values, left to right. Clicking one picks it. */
  readonly choices: readonly Box[]
}

export const SLOT_X = 64
export const SLOT_W = 200
const SLOT_TOP = 40
const SLOT_GAP = 19
export const SLOT_H = 15
export const SLIDER_STEP_W = 8
const OPTION_LEFT = 52
const OPTION_TOP = 40
const OPTION_GAP = 38
/** Where an option's slider or values sit below its label. */
export const OPTION_VALUE_DY = 18

const listRows = (labels: readonly string[], top: number, gap: number): MenuRow[] => {
  const scale = 2
  const width = Math.max(...labels.map((label) => textWidth(label, scale)))
  const left = Math.round(160 - width / 2)
  return labels.map((_, index) => {
    const y = top + index * gap
    return {
      index,
      box: { x: left - 18, y: y - 3, w: width + 22, h: gap },
      label: { x: left, y, scale },
      choices: [],
    }
  })
}

function optionChoices(item: OptionItem, y: number): Box[] {
  if (item.kind === 'slider')
    return Array.from({ length: item.steps }, (_, i) => ({
      x: OPTION_LEFT + 8 + i * SLIDER_STEP_W,
      y,
      w: SLIDER_STEP_W,
      h: 10,
    }))
  let x = OPTION_LEFT + 8
  return item.values.map((value) => {
    const box = { x: x - 3, y: y - 2, w: textWidth(value) + 6, h: 11 }
    x += textWidth(value) + 18
    return box
  })
}

export function menuRows(page: MenuPage): readonly MenuRow[] {
  switch (page) {
    case 'main':
      return listRows(
        MAIN_ITEMS.map((item) => item.label),
        44,
        19,
      )
    case 'skill':
      return listRows(
        SKILLS.map((skill) => skill.name),
        66,
        19,
      )
    case 'options':
      return OPTION_ITEMS.map((item, index) => {
        const y = OPTION_TOP + index * OPTION_GAP
        return {
          index,
          box: { x: OPTION_LEFT - 18, y: y - 3, w: 320 - 2 * (OPTION_LEFT - 18), h: OPTION_GAP - 4 },
          label: { x: OPTION_LEFT, y, scale: 2 },
          choices: optionChoices(item, y + OPTION_VALUE_DY),
        }
      })
    case 'load':
    case 'save':
      return Array.from({ length: SAVE_SLOTS }, (_, index) => {
        const y = SLOT_TOP + index * SLOT_GAP
        return {
          index,
          box: { x: SLOT_X - 16, y: y - 2, w: SLOT_W + 18, h: SLOT_GAP },
          label: { x: SLOT_X + 4, y: y + 4, scale: 1 },
          choices: [],
        }
      })
    case 'quit':
      return QUIT_ITEMS.map((label, index) => {
        const x = index === 0 ? 100 : 190
        return {
          index,
          box: { x: x - 16, y: 121, w: textWidth(label, 2) + 22, h: 20 },
          label: { x, y: 124, scale: 2 },
          choices: [],
        }
      })
    case 'help':
    case 'notice':
      return []
  }
}

const inside = (box: Box, x: number, y: number) =>
  x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h

export interface MenuHit {
  readonly index: number
  /** Which slider step or toggle value is under the point, if any. */
  readonly choice: number | null
}

export function hitMenu(page: MenuPage, x: number, y: number): MenuHit | null {
  for (const row of menuRows(page)) {
    const choice = row.choices.findIndex((box) => inside(box, x, y))
    if (choice >= 0) return { index: row.index, choice }
    if (inside(row.box, x, y)) return { index: row.index, choice: null }
  }
  return null
}

/**
 * Maps a point in the canvas element to the 320x200 framebuffer. The canvas uses `object-fit: contain`,
 * so the picture is scaled to fit and centered, with bars on two sides. Points on the bars map outside.
 */
export function toFramebuffer(
  rect: { readonly left: number; readonly top: number; readonly width: number; readonly height: number },
  clientX: number,
  clientY: number,
  width = 320,
  height = 200,
): { x: number; y: number } {
  const scale = Math.min(rect.width / width, rect.height / height) || 1
  const left = rect.left + (rect.width - width * scale) / 2
  const top = rect.top + (rect.height - height * scale) / 2
  return { x: (clientX - left) / scale, y: (clientY - top) / scale }
}
