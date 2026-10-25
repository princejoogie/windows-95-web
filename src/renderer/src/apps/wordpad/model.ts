/** 1440 twips to the inch, 96 pixels to the inch, so 15 twips to the pixel. */
export const TWIPS_PER_INCH = 1440
export const TWIPS_PER_PIXEL = 15
export const TWIPS_PER_CM = 567
export const TWIPS_PER_POINT = 20

export type Alignment = 'left' | 'center' | 'right' | 'justify'

export interface RunStyle {
  readonly bold: boolean
  readonly italic: boolean
  readonly underline: boolean
  readonly strike: boolean
  readonly font: string
  /** Points. */
  readonly size: number
  /** `#rrggbb`, lower case. */
  readonly color: string
}

export interface Run extends RunStyle {
  /** `\t` is a tab and `\n` is a line break inside the paragraph. */
  readonly text: string
}

export interface ParagraphStyle {
  readonly align: Alignment
  /** Twips. */
  readonly left: number
  readonly right: number
  /** First-line indent in twips, relative to `left`. Negative hangs. */
  readonly first: number
  /** Tab stop positions in twips, ascending. */
  readonly tabs: readonly number[]
  readonly bullet: boolean
}

export interface Paragraph extends ParagraphStyle {
  readonly runs: readonly Run[]
}

export interface Document {
  readonly paragraphs: readonly Paragraph[]
}

export const DEFAULT_RUN: RunStyle = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  font: 'Times New Roman',
  size: 10,
  color: '#000000',
}

export const DEFAULT_PARAGRAPH: ParagraphStyle = {
  align: 'left',
  left: 0,
  right: 0,
  first: 0,
  tabs: [],
  bullet: false,
}

export const emptyDocument = (): Document => ({ paragraphs: [{ ...DEFAULT_PARAGRAPH, runs: [] }] })

export const sameRunStyle = (a: RunStyle, b: RunStyle): boolean =>
  a.bold === b.bold &&
  a.italic === b.italic &&
  a.underline === b.underline &&
  a.strike === b.strike &&
  a.font === b.font &&
  a.size === b.size &&
  a.color === b.color

/** Joins neighbouring runs with the same style and drops empty ones, so equal documents compare equal. */
export function normalizeRuns(runs: readonly Run[]): Run[] {
  const out: Run[] = []
  for (const run of runs) {
    if (!run.text) continue
    const last = out[out.length - 1]
    if (last && sameRunStyle(last, run)) out[out.length - 1] = { ...last, text: last.text + run.text }
    else out.push(run)
  }
  return out
}

export function normalize(doc: Document): Document {
  const paragraphs = doc.paragraphs.map((p) => ({
    ...p,
    tabs: [...new Set(p.tabs)].sort((a, b) => a - b),
    runs: normalizeRuns(p.runs),
  }))
  return { paragraphs: paragraphs.length ? paragraphs : emptyDocument().paragraphs }
}

/** The document as Notepad would see it. */
export const plainText = (doc: Document): string =>
  doc.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n')

export function fromPlainText(text: string, style: RunStyle = DEFAULT_RUN): Document {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  return {
    paragraphs: lines.map((line) => ({
      ...DEFAULT_PARAGRAPH,
      runs: line ? [{ ...style, text: line }] : [],
    })),
  }
}

/** Parses `#rgb`, `#rrggbb`, or `rgb(r, g, b)` into `#rrggbb`. Anything else is black. */
export function hexColor(input: string): string {
  const value = input.trim().toLowerCase()
  const rgb = /^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(value)
  const hex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
  if (rgb) return `#${hex(Number(rgb[1]))}${hex(Number(rgb[2]))}${hex(Number(rgb[3]))}`
  if (/^#[0-9a-f]{6}$/.test(value)) return value
  if (/^#[0-9a-f]{3}$/.test(value))
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
  return '#000000'
}

export const twipsToPixels = (twips: number): number => twips / TWIPS_PER_PIXEL
export const pixelsToTwips = (px: number): number => Math.round(px * TWIPS_PER_PIXEL)
