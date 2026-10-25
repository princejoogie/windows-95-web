import { TWIPS_PER_CM, TWIPS_PER_INCH, TWIPS_PER_POINT } from './model'

/** The kinds of document WordPad's New dialog offers, plus the ones it only opens. */
export type DocumentType = 'word6' | 'rtf' | 'text' | 'write' | 'embedded'

export const DOCUMENT_TYPES: readonly {
  readonly type: DocumentType
  readonly label: string
  readonly extension: string
}[] = [
  { type: 'word6', label: 'Word 6 Document', extension: 'doc' },
  { type: 'rtf', label: 'Rich Text Document', extension: 'rtf' },
  { type: 'text', label: 'Text Document', extension: 'txt' },
]

export function documentTypeFor(fileName: string): DocumentType {
  const extension = fileName.toLowerCase().split('.').pop() ?? ''
  switch (extension) {
    case 'rtf':
      return 'rtf'
    case 'txt':
      return 'text'
    case 'wri':
      return 'write'
    case 'doc':
      return 'word6'
    default:
      return 'text'
  }
}

export const extensionFor = (type: DocumentType): string =>
  DOCUMENT_TYPES.find((entry) => entry.type === type)?.extension ?? (type === 'write' ? 'wri' : 'doc')

/** Windows hides registered extensions, so `Letter.doc` is shown as `Letter`. */
export function displayName(fileName: string): string {
  return fileName.replace(/\.(doc|rtf|txt|wri)$/i, '')
}

export type WordWrap = 'none' | 'window' | 'ruler'
export type Units = 'inches' | 'cm' | 'points' | 'picas'

export interface TypeOptions {
  readonly wordWrap: WordWrap
  readonly toolbar: boolean
  readonly formatBar: boolean
  readonly ruler: boolean
  readonly statusBar: boolean
}

export interface Options {
  readonly units: Units
  readonly automaticWordSelection: boolean
  readonly types: Readonly<Record<DocumentType, TypeOptions>>
}

const RICH: TypeOptions = { wordWrap: 'ruler', toolbar: true, formatBar: true, ruler: true, statusBar: true }
const PLAIN: TypeOptions = {
  wordWrap: 'window',
  toolbar: true,
  formatBar: false,
  ruler: false,
  statusBar: true,
}

export const DEFAULT_OPTIONS: Options = {
  units: 'inches',
  automaticWordSelection: true,
  types: { word6: RICH, rtf: RICH, text: PLAIN, write: RICH, embedded: RICH },
}

const KEY = 'w95.wordpad.options'

export function loadOptions(storage: Pick<Storage, 'getItem'> = localStorage): Options {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return DEFAULT_OPTIONS
    const parsed = JSON.parse(raw) as Partial<Options>
    const types = { ...DEFAULT_OPTIONS.types }
    for (const type of Object.keys(types) as DocumentType[]) {
      types[type] = { ...DEFAULT_OPTIONS.types[type], ...parsed.types?.[type] }
    }
    return {
      units: parsed.units ?? DEFAULT_OPTIONS.units,
      automaticWordSelection: parsed.automaticWordSelection ?? DEFAULT_OPTIONS.automaticWordSelection,
      types,
    }
  } catch {
    return DEFAULT_OPTIONS
  }
}

export function saveOptions(options: Options, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(KEY, JSON.stringify(options))
}

/** Formats twips in the chosen unit the way the Paragraph dialog shows them, such as `0.5"` or `1.27 cm`. */
export function formatMeasure(twips: number, units: Units): string {
  const round = (value: number, places: number) => String(Number(value.toFixed(places)))
  switch (units) {
    case 'inches':
      return `${round(twips / TWIPS_PER_INCH, 2)}"`
    case 'cm':
      return `${round(twips / TWIPS_PER_CM, 2)} cm`
    case 'points':
      return `${round(twips / TWIPS_PER_POINT, 1)} pt`
    case 'picas':
      return `${round(twips / (TWIPS_PER_POINT * 12), 2)} pi`
  }
}

/** Reads what the user typed in a measure box. A bare number is in the current unit. `null` when it is not a number. */
export function parseMeasure(input: string, units: Units): number | null {
  const match = /^\s*(-?\d+(?:\.\d+)?)\s*("|in|cm|pt|pi)?\s*$/i.exec(input)
  if (!match) return null
  const value = Number(match[1])
  const unit = (match[2] ?? '').toLowerCase()
  const per: Record<string, number> = {
    '"': TWIPS_PER_INCH,
    in: TWIPS_PER_INCH,
    cm: TWIPS_PER_CM,
    pt: TWIPS_PER_POINT,
    pi: TWIPS_PER_POINT * 12,
    inches: TWIPS_PER_INCH,
    points: TWIPS_PER_POINT,
    picas: TWIPS_PER_POINT * 12,
  }
  return Math.round(value * (per[unit] ?? per[units] ?? TWIPS_PER_INCH))
}

export interface PageSetup {
  readonly paper: string
  readonly orientation: 'portrait' | 'landscape'
  /** Twips. */
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

export const PAPER_SIZES: readonly {
  readonly name: string
  readonly width: number
  readonly height: number
}[] = [
  { name: 'Letter 8 1/2 x 11 in', width: 12240, height: 15840 },
  { name: 'Legal 8 1/2 x 14 in', width: 12240, height: 20160 },
  { name: 'A4 210 x 297 mm', width: 11906, height: 16838 },
  { name: 'Executive 7 1/4 x 10 1/2 in', width: 10440, height: 15120 },
  { name: 'Envelope #10 4 1/8 x 9 1/2 in', width: 5940, height: 13680 },
]

export const DEFAULT_PAGE: PageSetup = {
  paper: PAPER_SIZES[0]?.name ?? 'Letter 8 1/2 x 11 in',
  orientation: 'portrait',
  left: 1800,
  right: 1800,
  top: 1440,
  bottom: 1440,
}

/** The printable width and height in twips, after orientation and margins. */
export function pageArea(page: PageSetup): {
  width: number
  height: number
  paperWidth: number
  paperHeight: number
} {
  const paper = PAPER_SIZES.find((size) => size.name === page.paper) ?? PAPER_SIZES[0]
  const [paperWidth, paperHeight] =
    page.orientation === 'portrait'
      ? [paper?.width ?? 12240, paper?.height ?? 15840]
      : [paper?.height ?? 15840, paper?.width ?? 12240]
  return {
    paperWidth,
    paperHeight,
    width: Math.max(TWIPS_PER_INCH, paperWidth - page.left - page.right),
    height: Math.max(TWIPS_PER_INCH, paperHeight - page.top - page.bottom),
  }
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** The formats the Date and Time dialog lists, in its order, for a given moment. */
export function dateTimeFormats(now: Date): readonly string[] {
  const d = now.getDate()
  const m = now.getMonth()
  const y = now.getFullYear()
  const pad = (n: number) => String(n).padStart(2, '0')
  const h24 = now.getHours()
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  const ampm = h24 < 12 ? 'AM' : 'PM'
  const mm = pad(now.getMinutes())
  const ss = pad(now.getSeconds())
  const month = MONTHS[m] ?? ''
  const weekday = WEEKDAYS[now.getDay()] ?? ''
  const yy = pad(y % 100)
  return [
    `${m + 1}/${d}/${yy}`,
    `${pad(m + 1)}/${pad(d)}/${yy}`,
    `${m + 1}/${d}/${y}`,
    `${pad(m + 1)}/${pad(d)}/${y}`,
    `${yy}/${pad(m + 1)}/${pad(d)}`,
    `${y}-${pad(m + 1)}-${pad(d)}`,
    `${pad(d)}-${month.slice(0, 3)}-${yy}`,
    `${weekday}, ${month} ${pad(d)}, ${y}`,
    `${month} ${pad(d)}, ${y}`,
    `${weekday}, ${pad(d)} ${month}, ${y}`,
    `${pad(d)} ${month}, ${y}`,
    `${h12}:${mm}:${ss} ${ampm}`,
    `${pad(h12)}:${mm}:${ss} ${ampm}`,
    `${h24}:${mm}:${ss}`,
    `${pad(h24)}:${mm}:${ss}`,
  ]
}
