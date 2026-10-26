import { shellFolder } from '../apps/explorer/shellFolders'
import { children, extension, fileSize, pathOf } from '../fs/fs'
import { type Attributes, type FsNode, type FsState, RECYCLED_DIR } from '../fs/types'
import { resolveShortcut } from '../shell/clipboard'

const SHORT_CHARS = /^[A-Z0-9$%'`\-@{}~!#()&_^]*$/
const BAD_SHORT_CHARS = /[+,;=[\]]/g

/** The real file name on disk. Shortcuts are `.lnk` files whose extension Windows always hides. */
export const diskName = (node: FsNode): string => (node.kind === 'shortcut' ? `${node.name}.lnk` : node.name)

/** True when `name` already is a legal MS-DOS 8.3 name, ignoring case. */
function fitsEightThree(name: string): boolean {
  const upper = name.toUpperCase()
  const dot = upper.indexOf('.')
  const base = dot < 0 ? upper : upper.slice(0, dot)
  const ext = dot < 0 ? '' : upper.slice(dot + 1)
  return (
    base.length >= 1 &&
    base.length <= 8 &&
    ext.length <= 3 &&
    !ext.includes('.') &&
    (dot < 0 || ext.length > 0) &&
    SHORT_CHARS.test(base) &&
    SHORT_CHARS.test(ext)
  )
}

/**
 * The MS-DOS name Windows 95 gives a long file name: uppercase, spaces and extra dots dropped, the base cut
 * to six characters plus `~1` (or the first free number), and the last extension cut to three.
 */
export function dosName(name: string, taken: ReadonlySet<string> = new Set()): string {
  if (fitsEightThree(name)) return name.toUpperCase()
  const clean = (part: string) =>
    part
      .toUpperCase()
      .replace(/[\s.]/g, '')
      .replace(BAD_SHORT_CHARS, '_')
      .replace(/[^\x21-\x7e]/g, '_')
  const trimmed = name.replace(/^\.+/, '')
  const dot = trimmed.lastIndexOf('.')
  const base = clean(dot > 0 ? trimmed.slice(0, dot) : trimmed)
  const ext = dot > 0 ? clean(trimmed.slice(dot + 1)).slice(0, 3) : ''
  for (let n = 1; ; n++) {
    const tail = `~${n}`
    const candidate = `${base.slice(0, 8 - tail.length)}${tail}${ext ? `.${ext}` : ''}`
    if (!taken.has(candidate)) return candidate
  }
}

/** Short names for every child of a folder, given in creation order, as FAT assigns them. */
export function dosNames(state: FsState, parent: FsNode['id']): Map<FsNode['id'], string> {
  const siblings = children(state, parent).sort(
    (a, b) => (a.created ?? a.modified) - (b.created ?? b.modified) || a.id.localeCompare(b.id),
  )
  const taken = new Set<string>()
  const names = new Map<FsNode['id'], string>()
  for (const node of siblings) {
    const short = dosName(diskName(node), taken)
    taken.add(short)
    names.set(node.id, short)
  }
  return names
}

/** A node's attribute bits: the ones it stores, over the defaults Windows sets. */
export function attributesOf(node: FsNode): Required<Attributes> {
  const system = node.id === RECYCLED_DIR
  const defaults = {
    readOnly: false,
    hidden: system,
    archive: node.kind === 'file' || node.kind === 'shortcut' || node.kind === 'program',
    system,
  }
  return { ...defaults, ...node.attributes }
}

export const isHidden = (node: FsNode): boolean => attributesOf(node).hidden

/** Bytes a node takes: a file's text, or a folder's whole contents. */
export function bytesOf(state: FsState, node: FsNode): number {
  if (node.kind !== 'folder' && node.kind !== 'drive') return fileSize(node)
  return children(state, node.id).reduce((sum, child) => sum + bytesOf(state, child), 0)
}

/** Counts every file and folder below a folder, the way the Contains line does. */
export function contentsOf(state: FsState, node: FsNode): { files: number; folders: number } {
  let files = 0
  let folders = 0
  const walk = (id: FsNode['id']) => {
    for (const child of children(state, id)) {
      if (child.kind === 'folder') {
        folders++
        walk(child.id)
      } else files++
    }
  }
  walk(node.id)
  return { files, folders }
}

const thousands = (n: number) => n.toLocaleString('en-US')

/** `422 bytes (422 bytes)`, or `1.17KB (1,201 bytes)` once the size passes 1 KB, as the General tab reads. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${thousands(bytes)} bytes (${thousands(bytes)} bytes)`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  const digits = value < 10 ? 2 : value < 100 ? 1 : 0
  return `${value.toFixed(digits)}${units[unit]} (${thousands(bytes)} bytes)`
}

/** `Wednesday, October 25, 2026 4:39:51 PM`, the long format the General tab uses. */
export const formatStamp = (at: number): string => {
  const date = new Date(at)
  const day = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  return `${day} ${date.toLocaleTimeString('en-US')}`
}

/** `10/25/26 4:18 PM`, the short form Explorer's Details view and the Recycle Bin use. */
export const formatShortDate = (at: number): string => {
  const date = new Date(at)
  return `${date.getMonth() + 1}/${date.getDate()}/${String(date.getFullYear() % 100).padStart(2, '0')} ${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() < 12 ? 'AM' : 'PM'}`
}

export const formatDay = (at: number): string =>
  new Date(at).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

/** The Type line: `Text Document`, `File Folder`, `Shortcut`. */
export function typeName(node: FsNode): string {
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
      if (ext === 'txt') return 'Text Document'
      if (ext === 'bmp') return 'Bitmap Image'
      if (ext === 'bat') return 'MS-DOS Batch File'
      if (ext === 'sys') return 'System file'
      return ext ? `${ext.toUpperCase()} File` : 'File'
    }
  }
}

/** What a shortcut's Shortcut tab shows about the thing it opens. */
export interface ShortcutInfo {
  readonly type: string
  readonly location: string
  readonly target: string
  readonly startIn: string
  /** The folder Find Target opens. */
  readonly folder: FsNode['id'] | null
}

export function shortcutInfo(state: FsState, node: FsNode): ShortcutInfo | null {
  if (node.kind !== 'shortcut') return null
  const resolved = resolveShortcut(state, node)
  if (resolved?.kind === 'shell') {
    const target = resolved.target
    const folder = shellFolder(target.folder)
    const item = target.kind === 'item' ? folder?.items.find((item) => item.key === target.item) : undefined
    return {
      type: item ? 'System folder item' : 'System folder',
      location: folder?.title ?? target.folder,
      target: item ? `${folder?.title ?? target.folder}\\${item.label}` : (folder?.title ?? target.folder),
      startIn: '',
      folder: null,
    }
  }
  const target =
    resolved?.kind === 'app'
      ? Object.values(state.nodes).find((other) => other.kind === 'program' && other.app === resolved.app)
      : resolved?.node
  if (!target) return { type: '', location: '', target: '', startIn: '', folder: null }
  const parent = target.parent ? state.nodes[target.parent] : undefined
  return {
    type: typeName(target),
    location: parent?.name ?? '',
    target: pathOf(state, target.id),
    startIn: node.startIn ?? (parent ? pathOf(state, parent.id) : ''),
    folder: parent?.id ?? null,
  }
}
