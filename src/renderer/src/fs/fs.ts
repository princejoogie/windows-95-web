import { shortcutKey } from './shortcutKey'
import {
  type Attributes,
  DESKTOP_DIR,
  DOCUMENTS_DIR,
  type FsNode,
  type FsState,
  type NodeId,
  type ProgramSpec,
  RECYCLED_DIR,
  ROOT,
  type ShortcutSettings,
  WINDOWS_DIR,
} from './types'

/** What a shortcut opens: an installed app, or a node. */
export type ShortcutTarget = { readonly app: string } | { readonly node: NodeId }

export type FsAction =
  | { type: 'create'; node: FsNode }
  | { type: 'write'; id: NodeId; content: string; at: number }
  | { type: 'rename'; id: NodeId; name: string; at: number }
  | { type: 'move'; id: NodeId; parent: NodeId; at: number }
  | { type: 'recycle'; id: NodeId; at: number; from?: NodeId }
  | { type: 'limitRecycleBin'; bytes: number }
  | { type: 'restore'; id: NodeId; at: number }
  | { type: 'purge'; id: NodeId }
  | { type: 'emptyRecycleBin' }
  | { type: 'setAttributes'; id: NodeId; attributes: Attributes }
  | { type: 'setLabel'; id: NodeId; label: string }
  /** Re-points a shortcut and sets its Shortcut tab fields. Empty fields go back to their defaults. */
  | { type: 'setShortcut'; id: NodeId; target: ShortcutTarget; settings: ShortcutSettings }
  /** `shortcuts` also puts desktop shortcuts down. The shell passes it only on first boot. */
  | { type: 'installPrograms'; programs: readonly ProgramSpec[]; shortcuts: boolean; at: number }

const INVALID_CHARS = /[\\/:*?"<>|]/
const PROTECTED: ReadonlySet<NodeId> = new Set([ROOT, WINDOWS_DIR, DESKTOP_DIR, DOCUMENTS_DIR, RECYCLED_DIR])

export const isProtected = (id: NodeId): boolean => PROTECTED.has(id)

/** Logical file lengths. Executable bytes are represented by installed program nodes. */
export function fileSize(node: FsNode): number {
  if (node.kind === 'file') return new TextEncoder().encode(node.content).length
  if (node.kind === 'shortcut') return 352
  if (node.kind !== 'program') return 0
  const sizes: Readonly<Record<string, number>> = {
    'CALC.EXE': 59392,
    'NOTEPAD.EXE': 34304,
    'WINMINE.EXE': 24064,
    'SOL.EXE': 180736,
    'EXPLORER.EXE': 204288,
    'MSPAINT.EXE': 311296,
    'COMMAND.EXE': 93812,
    'COMMAND.COM': 93812,
    'CONTROL.EXE': 11264,
    'WINHELP.EXE': 265728,
  }
  const executables: Readonly<Record<string, string>> = {
    calculator: 'CALC.EXE',
    notepad: 'NOTEPAD.EXE',
    minesweeper: 'WINMINE.EXE',
    solitaire: 'SOL.EXE',
    explorer: 'EXPLORER.EXE',
    paint: 'MSPAINT.EXE',
    dosprompt: 'COMMAND.COM',
    controlpanel: 'CONTROL.EXE',
    help: 'WINHELP.EXE',
  }
  return sizes[executables[node.app] ?? node.name.toUpperCase()] ?? 32768
}

export function extension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase()
}

export function children(state: FsState, parent: NodeId): FsNode[] {
  const rank = (node: FsNode) => (node.kind === 'folder' || node.kind === 'drive' ? 0 : 1)
  return Object.values(state.nodes)
    .filter((node) => node.parent === parent)
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export function findChild(state: FsState, parent: NodeId, name: string): FsNode | undefined {
  const wanted = name.toLowerCase()
  return Object.values(state.nodes).find((n) => n.parent === parent && n.name.toLowerCase() === wanted)
}

export function isInside(state: FsState, id: NodeId, ancestor: NodeId): boolean {
  for (let node = state.nodes[id]; node; node = node.parent ? state.nodes[node.parent] : undefined) {
    if (node.id === ancestor) return true
  }
  return false
}

export function pathOf(state: FsState, id: NodeId): string {
  const names: string[] = []
  for (let node = state.nodes[id]; node; node = node.parent ? state.nodes[node.parent] : undefined) {
    names.unshift(node.name)
  }
  return names.length === 1 ? `${names[0]}\\` : names.join('\\')
}

/** Resolves `C:\My Documents\readme.txt` case-insensitively. */
export function resolvePath(state: FsState, path: string): FsNode | undefined {
  const [drive, ...parts] = path.trim().replace(/\//g, '\\').split('\\').filter(Boolean)
  const root = state.nodes[ROOT]
  if (!root || drive?.toLowerCase() !== root.name.toLowerCase()) return undefined
  let node: FsNode | undefined = root
  for (const part of parts) {
    node = node && findChild(state, node.id, part)
  }
  return node
}

/** `null` when `name` is a legal, unused name in `parent`. Otherwise the message Windows shows. */
export function validateName(state: FsState, parent: NodeId, name: string, self?: NodeId): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'You must type a filename.'
  if (INVALID_CHARS.test(trimmed)) {
    return 'A filename cannot contain any of the following characters:\n\\ / : * ? " < > |'
  }
  const clash = findChild(state, parent, trimmed)
  if (clash && clash.id !== self) {
    return `Cannot rename ${trimmed}: A file with the name you specified already exists. Specify a different filename.`
  }
  return null
}

/** `New Folder`, then `New Folder (2)`, and so on, the way Explorer numbers new items. */
export function uniqueName(state: FsState, parent: NodeId, base: string): string {
  if (!findChild(state, parent, base)) return base
  const ext = extension(base)
  const stem = ext ? base.slice(0, -(ext.length + 1)) : base
  for (let n = 2; ; n++) {
    const name = ext ? `${stem} (${n}).${base.slice(-ext.length)}` : `${stem} (${n})`
    if (!findChild(state, parent, name)) return name
  }
}

/** Why a volume label is not allowed, or null: FAT labels are at most 11 characters, without punctuation. */
export function volumeLabelError(label: string): string | null {
  return label.trim().length > 11 || /[*?/\\|.,;:+=[\]<>"]/.test(label)
    ? 'The volume label is not valid. A label can have up to 11 characters and cannot contain any of the following characters: * ? / \\ | . , ; : + = [ ] < > "'
    : null
}

/** C: is a 512 MB disk. */
export const DRIVE_CAPACITY = 536870912

/** Bytes in use on C:, counting every node, the Recycle Bin's included. */
export function driveUsed(state: FsState): number {
  return Math.min(
    DRIVE_CAPACITY,
    Object.values(state.nodes).reduce((sum, node) => sum + fileSize(node), 0),
  )
}

function put(state: FsState, node: FsNode): FsState {
  return { ...state, nodes: { ...state.nodes, [node.id]: node } }
}

function subtree(state: FsState, id: NodeId): Set<NodeId> {
  const ids = new Set<NodeId>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const node of Object.values(state.nodes)) {
      if (node.parent && ids.has(node.parent) && !ids.has(node.id)) {
        ids.add(node.id)
        grew = true
      }
    }
  }
  return ids
}

function remove(state: FsState, id: NodeId): FsState {
  const doomed = subtree(state, id)
  const nodes = Object.fromEntries(Object.entries(state.nodes).filter(([key]) => !doomed.has(key as NodeId)))
  const recycled = Object.fromEntries(
    Object.entries(state.recycled).filter(([key]) => !doomed.has(key as NodeId)),
  )
  return { ...state, nodes, recycled }
}

function ensureFolderPath(state: FsState, path: string, at: number): { state: FsState; id: NodeId } {
  const [, ...parts] = path.split('\\').filter(Boolean)
  let current = ROOT
  let next = state
  for (const part of parts) {
    const existing = findChild(next, current, part)
    if (existing) {
      current = existing.id
      continue
    }
    const id = `dir:${pathOf(next, current)}\\${part}`.toLowerCase() as NodeId
    next = put(next, { kind: 'folder', id, name: part, parent: current, modified: at })
    current = id
  }
  return { state: next, id: current }
}

/** Puts each program's executable in its install folder. Running it twice changes nothing. */
function installPrograms(
  state: FsState,
  programs: readonly ProgramSpec[],
  shortcuts: boolean,
  at: number,
): FsState {
  let next = state
  for (const program of programs) {
    const folder = ensureFolderPath(next, program.installDir, at)
    next = folder.state
    if (!findChild(next, folder.id, program.exe)) {
      const id = `exe:${program.app}` as NodeId
      next = put(next, {
        kind: 'program',
        id,
        name: program.exe,
        parent: folder.id,
        app: program.app,
        modified: at,
      })
    }
    const link = `lnk:${program.app}` as NodeId
    if (
      shortcuts &&
      program.desktopShortcut &&
      !next.nodes[link] &&
      !findChild(next, DESKTOP_DIR, program.title)
    ) {
      next = put(next, {
        kind: 'shortcut',
        id: link,
        name: program.title,
        parent: DESKTOP_DIR,
        app: program.app,
        modified: at,
      })
    }
  }
  return next
}

export function fsReducer(state: FsState, action: FsAction): FsState {
  switch (action.type) {
    case 'create': {
      const { node } = action
      if (state.nodes[node.id] || !node.parent || !state.nodes[node.parent]) return state
      return validateName(state, node.parent, node.name)
        ? state
        : put(state, { ...node, name: node.name.trim() })
    }
    case 'write': {
      const node = state.nodes[action.id]
      if (node?.kind !== 'file' || node.content === action.content) return state
      return put(state, { ...node, content: action.content, modified: action.at })
    }
    case 'rename': {
      const node = state.nodes[action.id]
      if (!node?.parent || isProtected(node.id) || node.name === action.name.trim()) return state
      if (validateName(state, node.parent, action.name, node.id)) return state
      return put(state, { ...node, name: action.name.trim(), modified: action.at })
    }
    case 'move': {
      const node = state.nodes[action.id]
      const target = state.nodes[action.parent]
      if (!node || !target || isProtected(node.id) || node.parent === target.id) return state
      if (target.kind !== 'folder' && target.kind !== 'drive') return state
      if (isInside(state, target.id, node.id)) return state
      if (findChild(state, target.id, node.name)) return state
      const moved = put(state, { ...node, parent: target.id, modified: action.at })
      if (!state.recycled[node.id] || isInside(state, target.id, RECYCLED_DIR)) return moved
      const { [node.id]: _, ...recycled } = state.recycled
      return { ...moved, recycled }
    }
    case 'recycle': {
      const node = state.nodes[action.id]
      if (!node?.parent || isProtected(node.id) || isInside(state, node.id, RECYCLED_DIR)) return state
      const moved = put(state, { ...node, parent: RECYCLED_DIR })
      return {
        ...moved,
        recycled: { ...moved.recycled, [node.id]: { from: action.from ?? node.parent, at: action.at } },
      }
    }
    case 'limitRecycleBin': {
      const deletions = children(state, RECYCLED_DIR).map((node) => ({
        node,
        at: state.recycled[node.id]?.at ?? node.modified,
        size: [...subtree(state, node.id)]
          .flatMap((id) => state.nodes[id] ?? [])
          .reduce((sum, child) => sum + fileSize(child), 0),
      }))
      let bytes = deletions.reduce((sum, item) => sum + item.size, 0)
      let next = state
      for (const item of deletions.sort((a, b) => a.at - b.at || a.node.id.localeCompare(b.node.id))) {
        if (bytes <= action.bytes) break
        next = remove(next, item.node.id)
        bytes -= item.size
      }
      return next
    }
    case 'restore': {
      const node = state.nodes[action.id]
      const record = state.recycled[action.id]
      if (!node || !record) return state
      const home =
        state.nodes[record.from] && !isInside(state, record.from, RECYCLED_DIR) ? record.from : DESKTOP_DIR
      const { [action.id]: _, ...recycled } = state.recycled
      const name = uniqueName(state, home, node.name)
      return { ...put(state, { ...node, parent: home, name }), recycled }
    }
    case 'purge':
      return state.nodes[action.id] && !isProtected(action.id) ? remove(state, action.id) : state
    case 'emptyRecycleBin':
      return children(state, RECYCLED_DIR).reduce((next, node) => remove(next, node.id), state)
    case 'installPrograms':
      return installPrograms(state, action.programs, action.shortcuts, action.at)
    case 'setShortcut': {
      const node = state.nodes[action.id]
      if (node?.kind !== 'shortcut') return state
      if ('node' in action.target && (!state.nodes[action.target.node] || action.target.node === node.id))
        return state
      const {
        app: _app,
        target: _target,
        startIn: _startIn,
        run: _run,
        icon: _icon,
        shortcutKey: _shortcutKey,
        ...base
      } = node
      const { shortcutKey: requestedKey, ...requestedSettings } = action.settings
      const key = shortcutKey(requestedKey ?? '')
      const settings = Object.fromEntries(
        Object.entries(requestedSettings).filter(
          ([key, value]) => value && !(key === 'run' && value === 'normal'),
        ),
      ) as ShortcutSettings
      const link: FsNode =
        'node' in action.target
          ? {
              ...base,
              ...settings,
              ...(key ? { shortcutKey: key } : {}),
              kind: 'shortcut',
              target: action.target.node,
            }
          : {
              ...base,
              ...settings,
              ...(key ? { shortcutKey: key } : {}),
              kind: 'shortcut',
              app: action.target.app,
            }
      return put(state, link)
    }
    case 'setLabel': {
      const node = state.nodes[action.id]
      if (node?.kind !== 'drive' || volumeLabelError(action.label)) return state
      const { label: _, ...rest } = node
      const label = action.label.trim().toUpperCase()
      return put(state, label ? { ...rest, label } : rest)
    }
    case 'setAttributes': {
      const node = state.nodes[action.id]
      return node ? put(state, { ...node, attributes: { ...node.attributes, ...action.attributes } }) : state
    }
  }
}

const README = `Welcome to Windows 95!

This computer runs entirely on your machine. Nothing here talks to the network.

Things to try:
- Start > Programs > Accessories > Games for Minesweeper and Solitaire.
- Double-click Doom 95 on the desktop.
- Save a note in Notepad. It is still here after a restart.
- Drag a file onto the Recycle Bin, then restore it.
`

/** A fresh C: drive with no programs. */
export function emptyDrive(at: number): FsState {
  const folder = (id: NodeId, name: string, parent: NodeId): FsNode => ({
    kind: 'folder',
    id,
    name,
    parent,
    modified: at,
  })
  const file = (id: string, name: string, parent: NodeId, content: string): FsNode => ({
    kind: 'file',
    id: id as NodeId,
    name,
    parent,
    content,
    modified: at,
  })
  const nodes: FsNode[] = [
    { kind: 'drive', id: ROOT, name: 'C:', parent: null, modified: at },
    folder(WINDOWS_DIR, 'WINDOWS', ROOT),
    folder(DESKTOP_DIR, 'Desktop', WINDOWS_DIR),
    folder(DOCUMENTS_DIR, 'My Documents', ROOT),
    folder(RECYCLED_DIR, 'RECYCLED', ROOT),
    file('readme', 'Readme.txt', DOCUMENTS_DIR, README),
    file('autoexec', 'AUTOEXEC.BAT', ROOT, '@ECHO OFF\r\nPROMPT $p$g\r\nSET TEMP=C:\\WINDOWS\\TEMP\r\n'),
    file('config', 'CONFIG.SYS', ROOT, 'DEVICE=C:\\WINDOWS\\HIMEM.SYS\r\nFILES=40\r\n'),
  ]
  return { version: 1, nodes: Object.fromEntries(nodes.map((node) => [node.id, node])), recycled: {} }
}

/** What a first boot produces: an empty drive, then every program with its desktop shortcut. */
export function seed(programs: readonly ProgramSpec[], at: number): FsState {
  return installPrograms(emptyDrive(at), programs, true, at)
}
