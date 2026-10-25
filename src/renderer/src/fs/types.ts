export type NodeId = string & { readonly __brand: 'NodeId' }

interface NodeBase {
  readonly id: NodeId
  readonly name: string
  readonly parent: NodeId | null
  /** Epoch milliseconds. */
  readonly modified: number
}

export type FsNode =
  | (NodeBase & { readonly kind: 'drive' })
  | (NodeBase & { readonly kind: 'folder' })
  | (NodeBase & { readonly kind: 'file'; readonly content: string })
  /** An installed app's executable, such as `C:\WINDOWS\CALC.EXE`. */
  | (NodeBase & { readonly kind: 'program'; readonly app: string })
  /** A link that launches an app. Its name has no extension, as Windows hides `.lnk`. */
  | (NodeBase & { readonly kind: 'shortcut'; readonly app: string })

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
