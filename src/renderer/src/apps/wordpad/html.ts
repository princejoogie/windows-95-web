import {
  type Alignment,
  DEFAULT_PARAGRAPH,
  DEFAULT_RUN,
  type Document,
  hexColor,
  type Inline,
  normalize,
  type Paragraph,
  type ParagraphStyle,
  pixelsToTwips,
  type RunStyle,
  twipsToPixels,
} from './model'

const BLOCK_TAGS = new Set([
  'DIV',
  'P',
  'LI',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'PRE',
  'SECTION',
])

export const isBlock = (node: Node): node is HTMLElement =>
  node instanceof HTMLElement && BLOCK_TAGS.has(node.tagName)

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function runCss(run: RunStyle): string {
  const parts = [`font-family:${quoteFamily(run.font)}`, `font-size:${run.size}pt`, `color:${run.color}`]
  if (run.bold) parts.push('font-weight:bold')
  if (run.italic) parts.push('font-style:italic')
  const decoration = [run.underline && 'underline', run.strike && 'line-through'].filter(Boolean)
  if (decoration.length) parts.push(`text-decoration:${decoration.join(' ')}`)
  return parts.join(';')
}

const quoteFamily = (font: string): string => (/[^\w-]/.test(font) ? `'${font}'` : font)

export function paragraphCss(paragraph: ParagraphStyle): string {
  const parts: string[] = []
  if (paragraph.align !== 'left') parts.push(`text-align:${paragraph.align}`)
  if (paragraph.left) parts.push(`margin-left:${twipsToPixels(paragraph.left)}px`)
  if (paragraph.right) parts.push(`margin-right:${twipsToPixels(paragraph.right)}px`)
  if (paragraph.first) parts.push(`text-indent:${twipsToPixels(paragraph.first)}px`)
  return parts.join(';')
}

function renderRun(run: Inline): string {
  if ('kind' in run)
    return `<img src="data:image/${run.format};base64,${escapeHtml(run.data)}" width="${run.width}" height="${run.height}" style="width:${run.width}px;height:${run.height}px" alt="Picture">`
  const text = escapeHtml(run.text).replace(/\n/g, '<br>')
  return `<span style="${escapeHtml(runCss(run))}">${text}</span>`
}

function renderParagraph(paragraph: Paragraph, tag: 'div' | 'li'): string {
  const css = paragraphCss(paragraph)
  const tabs = paragraph.tabs.length ? ` data-tabs="${paragraph.tabs.join(',')}"` : ''
  const style = css ? ` style="${css}"` : ''
  const body = paragraph.runs.length ? paragraph.runs.map(renderRun).join('') : '<br>'
  return `<${tag}${style}${tabs}>${body}</${tag}>`
}

/** The editor's HTML for a document. Runs of bulleted paragraphs become one list. */
export function renderDocument(doc: Document): string {
  const out: string[] = []
  let inList = false
  for (const paragraph of doc.paragraphs) {
    if (paragraph.bullet !== inList) {
      out.push(paragraph.bullet ? '<ul>' : '</ul>')
      inList = paragraph.bullet
    }
    out.push(renderParagraph(paragraph, paragraph.bullet ? 'li' : 'div'))
  }
  if (inList) out.push('</ul>')
  return out.join('')
}

const KEYWORD_SIZES: Record<string, number> = {
  'xx-small': 9,
  'x-small': 10,
  small: 13,
  medium: 16,
  large: 18,
  'x-large': 24,
  'xx-large': 32,
  'xxx-large': 48,
}
const HTML_SIZES = [0, 10, 13, 16, 18, 24, 32, 48]

/** Points from any CSS font-size the browser hands back, rounded to the half point. */
export function pointsFrom(value: string, fallback: number): number {
  const text = value.trim().toLowerCase()
  const match = /^(\d+(?:\.\d+)?)(pt|px)$/.exec(text)
  let points: number | null = null
  if (match) points = match[2] === 'pt' ? Number(match[1]) : Number(match[1]) * 0.75
  else if (text in KEYWORD_SIZES) points = (KEYWORD_SIZES[text] ?? 16) * 0.75
  if (points === null || Number.isNaN(points)) return fallback
  return Math.round(points * 2) / 2
}

export const firstFamily = (value: string): string =>
  value
    .split(',')[0]
    ?.trim()
    .replace(/^["']|["']$/g, '') ?? ''

function runStyleFrom(element: HTMLElement, inherited: RunStyle): RunStyle {
  let style = inherited
  const tag = element.tagName
  if (tag === 'B' || tag === 'STRONG') style = { ...style, bold: true }
  if (tag === 'I' || tag === 'EM') style = { ...style, italic: true }
  if (tag === 'U') style = { ...style, underline: true }
  if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') style = { ...style, strike: true }
  if (tag === 'FONT') {
    const face = element.getAttribute('face')
    const color = element.getAttribute('color')
    const size = Number(element.getAttribute('size'))
    if (face) style = { ...style, font: firstFamily(face) }
    if (color) style = { ...style, color: hexColor(color) }
    if (size >= 1 && size <= 7) style = { ...style, size: (HTML_SIZES[size] ?? 16) * 0.75 }
  }
  const css = element.style
  if (css.fontWeight) {
    const weight = css.fontWeight
    style = { ...style, bold: weight === 'bold' || weight === 'bolder' || Number(weight) >= 600 }
  }
  if (css.fontStyle) style = { ...style, italic: css.fontStyle === 'italic' || css.fontStyle === 'oblique' }
  const decoration = css.textDecorationLine || css.textDecoration
  if (decoration) {
    style = {
      ...style,
      underline: decoration.includes('underline'),
      strike: decoration.includes('line-through'),
    }
  }
  if (css.color) style = { ...style, color: hexColor(css.color) }
  if (css.fontFamily) style = { ...style, font: firstFamily(css.fontFamily) }
  if (css.fontSize) style = { ...style, size: pointsFrom(css.fontSize, style.size) }
  return style
}

export function paragraphStyleFrom(element: HTMLElement, bullet: boolean): ParagraphStyle {
  const css = element.style
  const px = (value: string) => (value.endsWith('px') ? pixelsToTwips(Number.parseFloat(value)) : 0)
  const alignments: readonly Alignment[] = ['left', 'center', 'right', 'justify']
  const align = alignments.find((a) => a === css.textAlign) ?? 'left'
  const tabs = (element.dataset.tabs ?? '')
    .split(',')
    .map((t) => Number(t))
    .filter((t) => Number.isFinite(t) && t > 0)
  return {
    align,
    left: px(css.marginLeft),
    right: px(css.marginRight),
    first: px(css.textIndent),
    tabs,
    bullet,
  }
}

/** Reads the editor's DOM back into a document. */
export function readDocument(root: HTMLElement): Document {
  const paragraphs: Paragraph[] = []
  let current: { style: ParagraphStyle; runs: Inline[] } | null = null

  const open = (style: ParagraphStyle) => {
    if (current) close()
    current = { style, runs: [] }
  }
  const close = () => {
    if (!current) return
    const runs = current.runs
    const last = runs[runs.length - 1]
    if (last && !('kind' in last) && last.text.endsWith('\n'))
      runs[runs.length - 1] = { ...last, text: last.text.slice(0, -1) }
    paragraphs.push({ ...current.style, runs })
    current = null
  }
  const emit = (text: string, style: RunStyle) => {
    if (!text) return
    if (!current) current = { style: DEFAULT_PARAGRAPH, runs: [] }
    current.runs.push({ ...style, text })
  }

  const walk = (node: Node, style: RunStyle, inList: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      emit(node.textContent ?? '', style)
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node instanceof HTMLImageElement) {
      const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(node.src)
      if (match && (match[1] === 'png' || match[1] === 'jpeg') && match[2]) {
        current ??= { style: DEFAULT_PARAGRAPH, runs: [] }
        current.runs.push({
          kind: 'picture',
          format: match[1],
          data: match[2],
          width: node.width || node.naturalWidth,
          height: node.height || node.naturalHeight,
        })
      }
      return
    }
    if (node.tagName === 'BR') {
      emit('\n', style)
      return
    }
    if (node.tagName === 'UL' || node.tagName === 'OL') {
      for (const child of Array.from(node.childNodes)) walk(child, style, true)
      return
    }
    if (BLOCK_TAGS.has(node.tagName)) {
      if (node.querySelector('div,p,li,ul,ol')) {
        // Chromium wraps a list or a nested block in a div of its own. The wrapper is not a paragraph.
        const inner = runStyleFrom(node, style)
        for (const child of Array.from(node.childNodes)) walk(child, inner, inList)
        return
      }
      open(paragraphStyleFrom(node, inList || node.tagName === 'LI'))
      const inner = runStyleFrom(node, style)
      for (const child of Array.from(node.childNodes)) walk(child, inner, inList)
      close()
      return
    }
    const inner = runStyleFrom(node, style)
    for (const child of Array.from(node.childNodes)) walk(child, inner, inList)
  }

  for (const child of Array.from(root.childNodes)) walk(child, DEFAULT_RUN, false)
  close()
  return normalize({ paragraphs })
}
