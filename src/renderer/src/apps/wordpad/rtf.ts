import {
  type Alignment,
  DEFAULT_PARAGRAPH,
  DEFAULT_RUN,
  type Document,
  type Inline,
  normalize,
  type Paragraph,
  type ParagraphStyle,
  type Picture,
  type RunStyle,
} from './model'

/** Writes the subset of RTF 1.5 that WordPad produces: fonts, colors, character and paragraph formatting. */
export function writeRtf(doc: Document): string {
  const fonts: string[] = []
  const colors: string[] = []
  const fontIndex = (name: string) => {
    let index = fonts.indexOf(name)
    if (index < 0) index = fonts.push(name) - 1
    return index
  }
  const colorIndex = (hex: string) => {
    if (hex === DEFAULT_RUN.color) return 0
    let index = colors.indexOf(hex)
    if (index < 0) index = colors.push(hex) - 1
    return index + 1
  }
  fontIndex(DEFAULT_RUN.font)
  fontIndex('Symbol')

  const body = doc.paragraphs.map((paragraph) => writeParagraph(paragraph, fontIndex, colorIndex)).join('\n')

  const fontTable = fonts.map((name, i) => `{\\f${i}\\fnil\\fcharset0 ${escapeText(name)};}`).join('')
  const colorTable = colors
    .map((hex) => {
      const n = Number.parseInt(hex.slice(1), 16)
      return `\\red${(n >> 16) & 255}\\green${(n >> 8) & 255}\\blue${n & 255};`
    })
    .join('')
  return `{\\rtf1\\ansi\\ansicpg1252\\deff0\\deflang1033{\\fonttbl${fontTable}}\n{\\colortbl ;${colorTable}}\n\\viewkind4\\uc1${body}\n}`
}

function writeParagraph(
  paragraph: Paragraph,
  fontIndex: (name: string) => number,
  colorIndex: (hex: string) => number,
): string {
  const align: Record<Alignment, string> = { left: '\\ql', center: '\\qc', right: '\\qr', justify: '\\qj' }
  let out = '\\pard'
  if (paragraph.bullet) out += `{\\*\\pn\\pnlvlblt\\pnf${fontIndex('Symbol')}\\pnindent0{\\pntxtb\\'b7}}`
  out += align[paragraph.align]
  if (paragraph.left) out += `\\li${paragraph.left}`
  if (paragraph.right) out += `\\ri${paragraph.right}`
  if (paragraph.first) out += `\\fi${paragraph.first}`
  for (const tab of paragraph.tabs) out += `\\tx${tab}`
  if (paragraph.bullet) out += `{\\pntext\\f${fontIndex('Symbol')}\\'b7\\tab}`
  for (const run of paragraph.runs) out += writeRun(run, fontIndex, colorIndex)
  return `${out}\\par`
}

function writeRun(
  run: Inline,
  fontIndex: (name: string) => number,
  colorIndex: (hex: string) => number,
): string {
  if ('kind' in run) {
    const hex = Array.from(atob(run.data), (byte) => byte.charCodeAt(0).toString(16).padStart(2, '0')).join(
      '',
    )
    return `{\\pict\\${run.format === 'png' ? 'pngblip' : 'jpegblip'}\\picw${run.width}\\pich${run.height}\\picwgoal${run.width * 15}\\pichgoal${run.height * 15}\n${hex}}`
  }
  let props = `\\plain\\f${fontIndex(run.font)}\\fs${Math.round(run.size * 2)}`
  if (run.bold) props += '\\b'
  if (run.italic) props += '\\i'
  if (run.underline) props += '\\ul'
  if (run.strike) props += '\\strike'
  const color = colorIndex(run.color)
  if (color) props += `\\cf${color}`
  return `{${props} ${escapeText(run.text)}}`
}

function escapeText(text: string): string {
  let out = ''
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    if (char === '\\' || char === '{' || char === '}') out += `\\${char}`
    else if (char === '\t') out += '\\tab '
    else if (char === '\n') out += '\\line '
    else if (code < 32 || code > 126) {
      if (code > 0xffff) {
        const high = 0xd800 + ((code - 0x10000) >> 10)
        const low = 0xdc00 + ((code - 0x10000) & 0x3ff)
        out += `\\u${signed16(high)}?\\u${signed16(low)}?`
      } else out += `\\u${signed16(code)}?`
    } else out += char
  }
  return out
}

const signed16 = (code: number): number => (code > 32767 ? code - 65536 : code)

export const isRtf = (text: string): boolean => /^\s*\{\\rtf/.test(text)

type Destination = 'body' | 'fonttbl' | 'colortbl' | 'pn' | 'pict' | 'skip'

interface Group {
  run: RunStyle
  paragraph: ParagraphStyle
  destination: Destination
  /** Bytes to skip after a `\uN`, per `\ucN`. */
  uc: number
  picture?: {
    format: Picture['format'] | null
    hex: string
    width: number
    height: number
    goalWidth: number
    goalHeight: number
  }
}

/**
 * Reads RTF into a document. Everything this writer produces round-trips exactly. Other writers' files
 * keep their text, fonts, colors, and the character and paragraph properties WordPad shows; unknown
 * destinations are skipped.
 */
export function parseRtf(source: string): Document {
  const fonts = new Map<number, string>()
  const colors: string[] = []
  const paragraphs: Paragraph[] = []
  let runs: Inline[] = []
  let group: Group = { run: DEFAULT_RUN, paragraph: DEFAULT_PARAGRAPH, destination: 'body', uc: 1 }
  const stack: Group[] = []
  let fontEntry: { index: number; name: string } | null = null
  let colorEntry = { r: 0, g: 0, b: 0, set: false }
  let skipChars = 0
  let starPending = false

  const emit = (text: string) => {
    if (skipChars > 0) {
      const take = Math.min(skipChars, text.length)
      skipChars -= take
      text = text.slice(take)
      if (!text) return
    }
    switch (group.destination) {
      case 'body':
        runs.push({ ...group.run, text })
        break
      case 'pict':
        if (group.picture) group.picture.hex += text.replace(/\s/g, '')
        break
      case 'fonttbl':
        if (fontEntry) {
          const end = text.indexOf(';')
          fontEntry.name += end < 0 ? text : text.slice(0, end)
          if (end >= 0) {
            fonts.set(fontEntry.index, fontEntry.name.trim())
            fontEntry = null
          }
        }
        break
      case 'colortbl':
        for (const char of text) {
          if (char !== ';') continue
          colors.push(
            colorEntry.set
              ? `#${[colorEntry.r, colorEntry.g, colorEntry.b].map((c) => c.toString(16).padStart(2, '0')).join('')}`
              : DEFAULT_RUN.color,
          )
          colorEntry = { r: 0, g: 0, b: 0, set: false }
        }
        break
      default:
        break
    }
  }

  const endParagraph = () => {
    paragraphs.push({ ...group.paragraph, runs })
    runs = []
  }

  const control = (word: string, hasParam: boolean, param: number) => {
    const star = starPending
    starPending = false
    if (group.destination === 'skip') return
    if (word === '*') {
      starPending = true
      return
    }
    if (group.destination === 'pict') {
      const picture = group.picture
      if (!picture) return
      if (word === 'pngblip') picture.format = 'png'
      if (word === 'jpegblip') picture.format = 'jpeg'
      if (word === 'picw') picture.width = param
      if (word === 'pich') picture.height = param
      if (word === 'picwgoal') picture.goalWidth = param
      if (word === 'pichgoal') picture.goalHeight = param
      return
    }
    if (group.destination === 'fonttbl') {
      if (word === 'f') fontEntry = { index: param, name: '' }
      return
    }
    if (group.destination === 'colortbl') {
      if (word === 'red') colorEntry = { ...colorEntry, r: param, set: true }
      if (word === 'green') colorEntry = { ...colorEntry, g: param, set: true }
      if (word === 'blue') colorEntry = { ...colorEntry, b: param, set: true }
      return
    }
    if (group.destination === 'pn') {
      if (word === 'pnlvlblt') group.paragraph = { ...group.paragraph, bullet: true }
      return
    }
    const run = group.run
    const paragraph = group.paragraph
    const on = !hasParam || param !== 0
    switch (word) {
      case 'fonttbl':
        group.destination = 'fonttbl'
        break
      case 'colortbl':
        group.destination = 'colortbl'
        break
      case 'pn':
        group.destination = 'pn'
        break
      case 'pntext':
      case 'stylesheet':
      case 'info':
      case 'object':
      case 'header':
      case 'footer':
      case 'footnote':
      case 'fldinst':
      case 'generator':
      case 'listtable':
      case 'listoverridetable':
      case 'rsidtbl':
      case 'xmlnstbl':
      case 'themedata':
      case 'colorschememapping':
      case 'latentstyles':
      case 'datastore':
        group.destination = 'skip'
        break
      case 'pict':
        group.destination = 'pict'
        group.picture = { format: null, hex: '', width: 0, height: 0, goalWidth: 0, goalHeight: 0 }
        break
      case 'par':
        endParagraph()
        break
      case 'pard':
        group.paragraph = DEFAULT_PARAGRAPH
        break
      case 'plain':
        group.run = DEFAULT_RUN
        break
      case 'b':
        group.run = { ...run, bold: on }
        break
      case 'i':
        group.run = { ...run, italic: on }
        break
      case 'ul':
        group.run = { ...run, underline: on }
        break
      case 'ulnone':
        group.run = { ...run, underline: false }
        break
      case 'strike':
        group.run = { ...run, strike: on }
        break
      case 'f':
        group.run = { ...run, font: fonts.get(param) ?? run.font }
        break
      case 'fs':
        group.run = { ...run, size: param / 2 }
        break
      case 'cf':
        group.run = { ...run, color: colors[param] ?? DEFAULT_RUN.color }
        break
      case 'ql':
        group.paragraph = { ...paragraph, align: 'left' }
        break
      case 'qc':
        group.paragraph = { ...paragraph, align: 'center' }
        break
      case 'qr':
        group.paragraph = { ...paragraph, align: 'right' }
        break
      case 'qj':
        group.paragraph = { ...paragraph, align: 'justify' }
        break
      case 'li':
        group.paragraph = { ...paragraph, left: param }
        break
      case 'ri':
        group.paragraph = { ...paragraph, right: param }
        break
      case 'fi':
        group.paragraph = { ...paragraph, first: param }
        break
      case 'tx':
        group.paragraph = { ...paragraph, tabs: [...paragraph.tabs, param] }
        break
      case 'tab':
        emit('\t')
        break
      case 'line':
        emit('\n')
        break
      case 'uc':
        group.uc = param
        break
      case 'u': {
        const code = param < 0 ? param + 65536 : param
        emit(String.fromCharCode(code))
        skipChars = group.uc
        break
      }
      case '~':
        emit(' ')
        break
      case '-':
      case '_':
        emit('-')
        break
      case 'emdash':
        emit('—')
        break
      case 'endash':
        emit('–')
        break
      case 'lquote':
        emit('‘')
        break
      case 'rquote':
        emit('’')
        break
      case 'ldblquote':
        emit('“')
        break
      case 'rdblquote':
        emit('”')
        break
      case 'bullet':
        emit('•')
        break
      default:
        if (star) group.destination = 'skip'
    }
  }

  let i = 0
  const n = source.length
  while (i < n) {
    const char = source[i] as string
    if (char === '{') {
      stack.push(group)
      group = { ...group }
      i++
    } else if (char === '}') {
      const parent = stack.pop()
      if (!parent) break
      const picture = group.picture
      if (
        group.destination === 'pict' &&
        parent.destination !== 'pict' &&
        picture?.format &&
        /^(?:[0-9a-fA-F]{2})+$/.test(picture.hex)
      ) {
        const bytes = picture.hex.match(/../g) ?? []
        const width = picture.goalWidth ? picture.goalWidth / 15 : picture.width
        const height = picture.goalHeight ? picture.goalHeight / 15 : picture.height
        if (width > 0 && height > 0)
          runs.push({
            kind: 'picture',
            format: picture.format,
            data: btoa(bytes.map((byte) => String.fromCharCode(Number.parseInt(byte, 16))).join('')),
            width,
            height,
          })
      }
      // A bullet declared in the numbering group belongs to the paragraph around it.
      group =
        group.destination === 'pn'
          ? { ...parent, paragraph: { ...parent.paragraph, bullet: group.paragraph.bullet } }
          : parent
      i++
    } else if (char === '\\') {
      const next = source[i + 1] ?? ''
      if (next === "'") {
        const hex = source.slice(i + 2, i + 4)
        emit(String.fromCharCode(Number.parseInt(hex, 16) || 0))
        i += 4
      } else if (/[a-zA-Z]/.test(next)) {
        let j = i + 1
        while (j < n && /[a-zA-Z]/.test(source[j] as string)) j++
        const word = source.slice(i + 1, j)
        let k = j
        if (source[k] === '-') k++
        while (k < n && /[0-9]/.test(source[k] as string)) k++
        const hasParam = k > j
        const param = hasParam ? Number.parseInt(source.slice(j, k), 10) : 0
        if (source[k] === ' ') k++
        i = k
        control(word, hasParam, param)
      } else if (next === '\n' || next === '\r') {
        control('par', false, 0)
        i += 2
      } else {
        // `\\`, `\{`, `\}`, `\*`, `\~`, `\-`, `\_`
        if (next === '\\' || next === '{' || next === '}') emit(next)
        else control(next, false, 0)
        i += 2
      }
    } else if (char === '\r' || char === '\n') {
      i++
    } else {
      let j = i
      while (j < n && !'{}\\\r\n'.includes(source[j] as string)) j++
      emit(source.slice(i, j))
      i = j
    }
  }
  if (runs.length || paragraphs.length === 0) endParagraph()
  return normalize({ paragraphs })
}
