export type NodeId = string & { readonly __brand: 'NodeId' }

/** The four FAT attribute bits a Properties sheet shows. Absent bits take `attributesOf`'s defaults. */
export interface Attributes {
  readonly readOnly?: boolean
  readonly hidden?: boolean
  readonly archive?: boolean
  readonly system?: boolean
}

interface NodeBase {
  readonly id: NodeId
  readonly name: string
  readonly parent: NodeId | null
  /** Epoch milliseconds. */
  readonly modified: number
  /** Epoch milliseconds. Nodes saved before this field existed fall back to `modified`. */
  readonly created?: number
  readonly attributes?: Attributes
}

export type RunAs = 'normal' | 'minimized' | 'maximized'
export type ShellFolderId = 'controlpanel' | 'printers' | 'network' | 'fonts'
export type ShellShortcutTarget =
  | { readonly kind: 'folder'; readonly folder: ShellFolderId }
  | { readonly kind: 'item'; readonly folder: ShellFolderId; readonly item: string }

/** What a shortcut's Shortcut tab edits besides its target. */
export interface ShortcutSettings {
  /** The working folder, as a path. Absent means the target's own folder. */
  readonly startIn?: string
  /** How the window opens. Absent means a normal window. */
  readonly run?: RunAs
  /** A Change Icon choice: a key of the shell's 32x32 icons, or `app:<id>` for an app's icon. */
  readonly icon?: string
  /** The letter in a Ctrl+Alt shortcut. Absent means None. */
  readonly shortcutKey?: string
}

export type FsNode =
  /** `label` is the volume label, stored uppercase as FAT keeps it. */
  | (NodeBase & { readonly kind: 'drive'; readonly label?: string })
  | (NodeBase & { readonly kind: 'folder' })
  | (NodeBase & { readonly kind: 'file'; readonly content: string })
  /** An installed app's executable, such as `C:\WINDOWS\CALC.EXE`. */
  | (NodeBase & { readonly kind: 'program'; readonly app: string })
  /** A link that launches an app. Its name has no extension, as Windows hides `.lnk`. */
  | (NodeBase &
      ShortcutSettings & { readonly kind: 'shortcut'; readonly app: string; readonly target?: undefined })
  /** A link to a file, folder, or drive. Opening it opens the target. */
  | (NodeBase &
      ShortcutSettings & { readonly kind: 'shortcut'; readonly target: NodeId; readonly app?: undefined })

export type NodeKind = FsNode['kind']

/** Where a recycled node came from, so Restore can put it back. */
export interface Recycled {
  readonly from: NodeId
  readonly at: number
}

export interface FsState {
  readonly version: 1
  readonly nodes: Readonly<Record<NodeId, FsNode>>
  readonly recycled: Readonly<Record<NodeId, Recycled>>
}

export const ROOT = 'c' as NodeId
export const WINDOWS_DIR = 'windows' as NodeId
export const DESKTOP_DIR = 'desktop' as NodeId
export const DOCUMENTS_DIR = 'documents' as NodeId
export const RECYCLED_DIR = 'recycled' as NodeId

/** An installed app as the file system sees it. */
export interface ProgramSpec {
  readonly app: string
  readonly title: string
  readonly exe: string
  readonly installDir: string
  readonly desktopShortcut: boolean
}
