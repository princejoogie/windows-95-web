import { firstFamily, isBlock, paragraphStyleFrom, pointsFrom } from './html'
import {
  type Alignment,
  DEFAULT_PARAGRAPH,
  DEFAULT_RUN,
  hexColor,
  type ParagraphStyle,
  type RunStyle,
  twipsToPixels,
} from './model'
import { findNext, locate, type SearchOptions, type Segment } from './search'

/** What the format bar and ruler show for the caret or selection. */
export interface SelectionState extends RunStyle, ParagraphStyle {}

export const DEFAULT_SELECTION: SelectionState = { ...DEFAULT_RUN, ...DEFAULT_PARAGRAPH }

const selectionIn = (root: HTMLElement): Selection | null => {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  return root.contains(range.commonAncestorContainer) ? selection : null
}

/** The paragraph element around a node, or `null` for text sitting directly in the editor root. */
export function blockOf(node: Node | null, root: HTMLElement): HTMLElement | null {
  let current: Node | null = node
  while (current && current !== root) {
    if (isBlock(current)) return current
    current = current.parentNode
  }
  return null
}

/** Every paragraph element the selection touches. Loose text gets wrapped in a block first. */
export function selectedBlocks(root: HTMLElement): HTMLElement[] {
  const selection = selectionIn(root)
  if (!selection) return []
  const range = selection.getRangeAt(0)
  if (!blockOf(range.startContainer, root) || !blockOf(range.endContainer, root)) {
    document.execCommand('formatBlock', false, 'div')
  }
  const current = document.getSelection()?.getRangeAt(0)
  if (!current) return []
  const blocks: HTMLElement[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => (isBlock(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
  })
  let node = walker.nextNode()
  while (node) {
    if (node instanceof HTMLElement && current.intersectsNode(node) && !node.querySelector('div,p,li')) {
      blocks.push(node)
    }
    node = walker.nextNode()
  }
  if (blocks.length === 0) {
    const block = blockOf(current.startContainer, root)
    if (block) blocks.push(block)
  }
  return blocks
}

export function applyParagraphStyle(root: HTMLElement, patch: Partial<Omit<ParagraphStyle, 'bullet'>>): void {
  for (const block of selectedBlocks(root)) {
    if (patch.align !== undefined) block.style.textAlign = patch.align === 'left' ? '' : patch.align
    if (patch.left !== undefined) block.style.marginLeft = patch.left ? `${twipsToPixels(patch.left)}px` : ''
    if (patch.right !== undefined)
      block.style.marginRight = patch.right ? `${twipsToPixels(patch.right)}px` : ''
    if (patch.first !== undefined)
      block.style.textIndent = patch.first ? `${twipsToPixels(patch.first)}px` : ''
    if (patch.tabs !== undefined) {
      if (patch.tabs.length) block.dataset.tabs = patch.tabs.join(',')
      else delete block.dataset.tabs
    }
  }
}

/** Toggles bullets on the selected paragraphs, giving new bullets WordPad's quarter-inch hanging indent. */
export function toggleBullets(root: HTMLElement, on: boolean): void {
  const was = document.queryCommandState('insertUnorderedList')
  if (was !== on) document.execCommand('insertUnorderedList')
  for (const block of selectedBlocks(root)) {
    if (on && block.tagName === 'LI' && !block.style.marginLeft) {
      block.style.marginLeft = `${twipsToPixels(360)}px`
      block.style.textIndent = `${twipsToPixels(-360)}px`
    }
    if (!on && block.tagName !== 'LI') {
      block.style.marginLeft = ''
      block.style.textIndent = ''
    }
  }
}

export function setAlignment(root: HTMLElement, align: Alignment): void {
  applyParagraphStyle(root, { align })
}

/** Sets a point size on the selection. Chromium only takes the seven HTML sizes, so size 7 is the marker. */
export function setFontSize(root: HTMLElement, points: number): void {
  document.execCommand('fontSize', false, '7')
  const marked = root.querySelectorAll<HTMLElement>('font[size="7"], span[style*="xxx-large"]')
  for (const element of marked) {
    element.removeAttribute('size')
    element.style.fontSize = `${points}pt`
  }
}

export function setFontName(font: string): void {
  document.execCommand('fontName', false, font)
}

export function setColor(color: string): void {
  document.execCommand('foreColor', false, color)
}

export function toggle(command: 'bold' | 'italic' | 'underline' | 'strikeThrough'): void {
  document.execCommand(command)
}

export function insertText(text: string): void {
  document.execCommand('insertText', false, text)
}

export function insertHtml(html: string): void {
  document.execCommand('insertHTML', false, html)
}

/** Applies a whole run style to the selection, the way the Font dialog does. */
export function applyRunStyle(root: HTMLElement, style: RunStyle, current: RunStyle): void {
  setFontName(style.font)
  setFontSize(root, style.size)
  setColor(style.color)
  if (style.bold !== current.bold) toggle('bold')
  if (style.italic !== current.italic) toggle('italic')
  if (style.underline !== current.underline) toggle('underline')
  if (style.strike !== current.strike) toggle('strikeThrough')
}

/** Reads the formatting at the caret so the format bar and ruler can show it. */
export function readSelection(root: HTMLElement, previous: SelectionState): SelectionState {
  const selection = selectionIn(root)
  if (!selection) return previous
  const anchor = selection.focusNode ?? selection.anchorNode
  const element = anchor instanceof HTMLElement ? anchor : (anchor?.parentElement ?? root)
  const computed = getComputedStyle(element)
  const block = blockOf(anchor, root)
  const paragraph = block
    ? paragraphStyleFrom(block, block.tagName === 'LI' || Boolean(block.closest('ul,ol')))
    : DEFAULT_PARAGRAPH
  return {
    ...paragraph,
    bold: document.queryCommandState('bold'),
    italic: document.queryCommandState('italic'),
    underline: document.queryCommandState('underline'),
    strike: document.queryCommandState('strikeThrough'),
    font: firstFamily(computed.fontFamily) || DEFAULT_RUN.font,
    size: pointsFrom(computed.fontSize, DEFAULT_RUN.size),
    color: hexColor(computed.color),
  }
}

/** The editor's text, flattened the way `plainText` does it, with the node that owns each piece. */
function textSegments(root: HTMLElement): Segment<Text | null>[] {
  const segments: Segment<Text | null>[] = []
  let firstBlock = true
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      segments.push({ owner: node as Text, length: (node.textContent ?? '').length })
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') {
      segments.push({ owner: null, length: 1 })
      return
    }
    if (isBlock(node)) {
      if (!firstBlock) segments.push({ owner: null, length: 1 })
      firstBlock = false
    }
    for (const child of Array.from(node.childNodes)) walk(child)
  }
  for (const child of Array.from(root.childNodes)) walk(child)
  return segments
}

const flatText = (segments: readonly Segment<Text | null>[]): string =>
  segments.map((s) => (s.owner ? (s.owner.textContent ?? '') : '\n')).join('')

/** Where the end of the selection falls in the flattened text. */
function caretOffset(segments: readonly Segment<Text | null>[], root: HTMLElement): number {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0) return 0
  const { endContainer, endOffset } = selection.getRangeAt(0)
  if (!root.contains(endContainer)) return 0
  let base = 0
  if (endContainer.nodeType === Node.TEXT_NODE) {
    for (const segment of segments) {
      if (segment.owner === endContainer) return base + endOffset
      base += segment.length
    }
    return 0
  }
  // The caret sits between an element's children: after the last text before it, else at its first text.
  const before = Array.from(endContainer.childNodes).slice(0, endOffset)
  let after: number | null = null
  let first: number | null = null
  for (const segment of segments) {
    if (segment.owner) {
      if (before.some((child) => child === segment.owner || child.contains(segment.owner))) {
        after = base + segment.length
      }
      if (first === null && endContainer.contains(segment.owner)) first = base
    }
    base += segment.length
  }
  return after ?? first ?? 0
}

/** Selects the next match after the selection. Returns `false` when there is none. */
export function findInEditor(root: HTMLElement, query: string, options: SearchOptions, wrap = true): boolean {
  const segments = textSegments(root)
  const text = flatText(segments)
  const at = findNext(text, query, caretOffset(segments, root), options, wrap)
  if (at === null) return false
  return selectFlat(root, segments, at, at + query.length)
}

function selectFlat(
  root: HTMLElement,
  segments: readonly Segment<Text | null>[],
  from: number,
  to: number,
): boolean {
  const textOnly = segments.filter((s) => s.owner !== null || s.length > 0)
  const start = locate(textOnly, from)
  const end = locate(textOnly, to)
  if (!start?.owner || !end?.owner) return false
  const range = document.createRange()
  range.setStart(start.owner, start.offset)
  range.setEnd(end.owner, end.offset)
  const selection = document.getSelection()
  if (!selection) return false
  root.focus()
  selection.removeAllRanges()
  selection.addRange(range)
  start.owner.parentElement?.scrollIntoView({ block: 'nearest' })
  return true
}

/** The text the selection covers, matching the way the editor flattens paragraphs. */
export function selectedText(root: HTMLElement): string {
  const selection = selectionIn(root)
  return selection ? selection.toString() : ''
}

/** Replaces the selection when it is the query, then moves to the next match. */
export function replaceInEditor(
  root: HTMLElement,
  query: string,
  replacement: string,
  options: SearchOptions,
): boolean {
  const current = selectedText(root)
  const same = options.matchCase ? current === query : current.toLowerCase() === query.toLowerCase()
  if (same && current) insertText(replacement)
  return findInEditor(root, query, options)
}

/** Replaces every match from the top of the document down. Returns how many it replaced. */
export function replaceAllInEditor(
  root: HTMLElement,
  query: string,
  replacement: string,
  options: SearchOptions,
): number {
  const selection = document.getSelection()
  if (!selection || !query) return 0
  root.focus()
  selection.collapse(root, 0)
  let count = 0
  while (count < 10000 && findInEditor(root, query, options, false)) {
    insertText(replacement)
    count++
  }
  return count
}

/** Keeps the last selection inside the editor so toolbar controls that take focus can give it back. */
export class SelectionKeeper {
  private range: Range | null = null
  constructor(private readonly root: () => HTMLElement | null) {}

  remember(): void {
    const root = this.root()
    if (!root) return
    const selection = selectionIn(root)
    if (selection) this.range = selection.getRangeAt(0).cloneRange()
  }

  restore(): void {
    const root = this.root()
    if (!root) return
    root.focus({ preventScroll: true })
    const selection = document.getSelection()
    if (!selection) return
    if (this.range && root.contains(this.range.commonAncestorContainer)) {
      selection.removeAllRanges()
      selection.addRange(this.range)
    } else if (!selectionIn(root)) {
      selection.selectAllChildren(root)
      selection.collapseToEnd()
    }
  }
}
