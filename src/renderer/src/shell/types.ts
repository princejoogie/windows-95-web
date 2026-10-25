import type { ComponentType } from 'react'
import type { FsState, NodeId, ShellShortcutTarget } from '../fs/types'

export interface Point {
  readonly x: number
  readonly y: number
}

export interface Size {
  readonly width: number
  readonly height: number
}

/** What a launch hands an app. Files and folders are virtual file system node ids. */
export interface LaunchArgs {
  readonly file?: NodeId
  readonly folder?: NodeId
  /** A node inside the folder that the window opens with selected, as Find's Open Containing Folder asks. */
  readonly select?: NodeId
  /** A help book id, for Windows Help. */
  readonly book?: string
  readonly shellTarget?: ShellShortcutTarget
}

/**
 * How the window frame treats the app. `fixed` windows size themselves to their content and cannot be
 * resized or maximized, like Calculator and Minesweeper. `resizable` sizes are the client area, the
 * part inside the frame and title bar.
 */
export type WindowSpec =
  | { readonly kind: 'fixed' }
  | {
      readonly kind: 'resizable'
      readonly width: number
      readonly height: number
      readonly minWidth?: number
      readonly minHeight?: number
    }

export interface DesktopIcon {
  /** Lower sorts first. Shell icons such as My Computer come before the Desktop folder's files. */
  readonly order: number
  readonly label?: string
  /** Defaults to the app icon. Recycle Bin uses this to show full or empty. */
  readonly icon?: (fs: FsState) => string
  /** Files dragged from the desktop and dropped on this icon. Recycle Bin recycles them. */
  readonly onDrop?: (ids: readonly NodeId[]) => void
  /** The sheet the icon's Properties command opens, such as Recycle Bin Properties. */
  readonly Properties?: ComponentType<{ onClose: () => void }>
}

/** One app. Each `apps/<id>/index.tsx` exports `app: AppManifest`, and the registry picks it up. */
export interface AppManifest {
  readonly id: string
  readonly title: string
  /** 32x32 icon URL. */
  readonly icon: string
  /** 16x16 icon URL for title bars, the taskbar, and menus. Defaults to `icon`. */
  readonly smallIcon?: string
  /** File name under `installDir`. The Run dialog accepts it with or without `.exe`. */
  readonly exe: string
  /** Defaults to `C:\WINDOWS`. */
  readonly installDir?: string
  /** Folder path under Start > Programs, for example `['Accessories', 'Games']`. `[]` is Programs itself. */
  readonly startMenu?: readonly string[]
  /** Extensions, without the dot, that this app opens from Explorer or the desktop. */
  readonly fileTypes?: readonly string[]
  /** Creates a shortcut on the desktop when the file system is first created. */
  readonly desktopShortcut?: boolean
  /** A shell icon on the desktop that is not a file, such as My Computer. */
  readonly desktop?: DesktopIcon
  readonly window: WindowSpec
  readonly component: ComponentType<AppProps>
}

export type WindowId = number & { readonly __brand: 'WindowId' }

/** The handle an app gets for its own window. */
export interface WindowApi {
  readonly id: WindowId
  readonly focused: boolean
  readonly minimized: boolean
  setTitle(title: string): void
  onCloseRequest(handler: () => Promise<boolean>): () => void
  onHelpRequest(handler: () => void): () => void
  close(): void
}

export interface AppProps {
  readonly window: WindowApi
  readonly args: LaunchArgs
}
