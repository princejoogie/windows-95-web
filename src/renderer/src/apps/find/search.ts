import { extension, isInside, pathOf } from '../../fs/fs'
import { type FsNode, type FsState, type NodeId, RECYCLED_DIR, ROOT } from '../../fs/types'

export type ModifiedFilter =
  | { readonly kind: 'all' }
  | { readonly kind: 'between'; readonly from: string; readonly to: string }
  | { readonly kind: 'previous'; readonly count: number; readonly unit: 'days' | 'months' }

export type SizeFilter =
  | { readonly kind: 'any' }
  | { readonly kind: 'at-least' | 'at-most'; readonly kb: number }

export interface SearchCriteria {
  readonly name: string
  readonly folder: NodeId
  readonly recursive: boolean
  readonly modified: ModifiedFilter
  readonly fileType: string
  readonly containing: string
  readonly size: SizeFilter
  readonly caseSensitive: boolean
}

export const defaultCriteria: SearchCriteria = {
  name: '',
  folder: ROOT,
  recursive: true,
  modified: { kind: 'all' },
  fileType: '',
  containing: '',
  size: { kind: 'any' },
  caseSensitive: false,
}

export function fileSize(node: FsNode): number {
  return node.kind === 'file' ? new TextEncoder().encode(node.content).length : 0
}

export function fileType(node: FsNode): string {
  switch (node.kind) {
    case 'drive':
      return 'Local Disk'
    case 'folder':
      return 'File Folder'
    case 'program':
      return 'Application'
    case 'shortcut':
      return 'Shortcut'
    case 'file': {
      const ext = extension(node.name)
      const names: Record<string, string> = {
        txt: 'Text Document',
        bmp: 'Bitmap Image',
        png: 'PNG Image',
        jpg: 'JPEG Image',
        jpeg: 'JPEG Image',
        bat: 'MS-DOS Batch File',
        sys: 'System File',
        rtf: 'Rich Text Document',
        doc: 'Word Document',
        wav: 'Wave Sound',
      }
      return names[ext] ?? (ext ? `${ext.toUpperCase()} File` : 'File')
    }
  }
}

function localDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day)
  return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day ? date : null
}

function dateRange(filter: ModifiedFilter, now: number): readonly [number, number] {
  if (filter.kind === 'all') return [-Infinity, Infinity]
  if (filter.kind === 'between') {
    const start = localDate(filter.from)
    const end = localDate(filter.to)
    if (!start || !end) return [Infinity, -Infinity]
    end.setDate(end.getDate() + 1)
    return [start.getTime(), end.getTime() - 1]
  }
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (filter.unit === 'days') start.setDate(start.getDate() - filter.count)
  else {
    const day = start.getDate()
    start.setDate(1)
    start.setMonth(start.getMonth() - filter.count)
    const last = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate()
    start.setDate(Math.min(day, last))
  }
  return [start.getTime(), now]
}

export function validateCriteria(criteria: SearchCriteria): string | null {
  const modified = criteria.modified
  if (modified.kind === 'between') {
    if (!localDate(modified.from) || !localDate(modified.to)) return 'Enter a valid starting and ending date.'
    if (modified.from > modified.to) return 'The starting date must be on or before the ending date.'
  }
  if (
    modified.kind === 'previous' &&
    (!Number.isInteger(modified.count) || modified.count < 0 || modified.count > 999)
  )
    return 'Enter a whole number from 0 to 999 for the previous days or months.'
  if (criteria.size.kind !== 'any' && (!Number.isFinite(criteria.size.kb) || criteria.size.kb < 0))
    return 'Enter a size of zero or more kilobytes.'
  return null
}

function nameMatches(patterns: string, name: string, caseSensitive: boolean): boolean {
  const normalizedName = caseSensitive ? name : name.toLocaleLowerCase()
  const entries = patterns.split(';').filter((entry) => entry.trim())
  if (!entries.length) return true
  return entries.some((raw) => {
    const pattern = (caseSensitive ? raw : raw.toLocaleLowerCase()).trim()
    if (!pattern || pattern === '*' || pattern === '*.*') return true
    if (!/[?*]/.test(pattern)) return normalizedName.includes(pattern)
    const expression = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')
    return new RegExp(`^${expression}$`).test(normalizedName)
  })
}

export function* searchFiles(
  state: FsState,
  criteria: SearchCriteria,
  now = Date.now(),
): Generator<FsNode | null> {
  if (validateCriteria(criteria)) return
  const [from, to] = dateRange(criteria.modified, now)
  const containing = criteria.caseSensitive ? criteria.containing : criteria.containing.toLocaleLowerCase()
  for (const node of Object.values(state.nodes)) {
    const inLocation =
      node.parent === criteria.folder || (criteria.recursive && isInside(state, node.id, criteria.folder))
    let matches =
      node.id !== criteria.folder &&
      node.kind !== 'drive' &&
      inLocation &&
      !isInside(state, node.id, RECYCLED_DIR)
    matches &&= nameMatches(criteria.name, node.name, criteria.caseSensitive)
    matches &&= node.modified >= from && node.modified <= to
    matches &&=
      !criteria.fileType ||
      (criteria.fileType.startsWith('.')
        ? node.kind === 'file' && extension(node.name) === criteria.fileType.slice(1)
        : node.kind === criteria.fileType)
    matches &&=
      !containing ||
      (node.kind === 'file' &&
        (criteria.caseSensitive ? node.content : node.content.toLocaleLowerCase()).includes(containing))
    if (criteria.size.kind !== 'any') {
      matches &&=
        node.kind === 'file' &&
        (criteria.size.kind === 'at-least'
          ? fileSize(node) >= criteria.size.kb * 1024
          : fileSize(node) <= criteria.size.kb * 1024)
    }
    yield matches ? node : null
  }
}

export interface SearchResult {
  readonly node: FsNode
  readonly folder: string
  readonly bytes: number
  readonly type: string
}

export function resultOf(state: FsState, node: FsNode): SearchResult {
  return {
    node,
    folder: node.parent ? pathOf(state, node.parent) : '',
    bytes: fileSize(node),
    type: fileType(node),
  }
}
