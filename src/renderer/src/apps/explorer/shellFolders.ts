import { type ComponentType, useSyncExternalStore } from 'react'
import type { Location } from './model'

export type ShellFolderId = 'controlpanel' | 'printers' | 'network' | 'fonts'
export type ShellAction =
  | { kind: 'folder'; id: ShellFolderId }
  | { kind: 'dialog'; id: string }
  | { kind: 'app'; id: string }

export interface ShellItem {
  readonly key: string
  readonly label: string
  readonly icon: string
  readonly help: string
  readonly action: ShellAction
}

export interface ShellCommand {
  readonly label: string
  readonly action?: ShellAction
}

export interface ShellFolder {
  readonly id: ShellFolderId
  readonly title: string
  readonly items: readonly ShellItem[]
  readonly parent: Location
  readonly countNoun?: string
  readonly fileCommands?: readonly (ShellCommand | 'separator')[]
  readonly contextCommands?: readonly (ShellCommand | 'separator')[]
  readonly fileMutations?: boolean
  readonly viewCommands?: readonly string[]
  readonly properties?: ShellAction
  readonly Dialog: ComponentType<{ id: string; onClose: () => void }>
}

const folders = new Map<ShellFolderId, ShellFolder>()
const listeners = new Set<() => void>()
export const registerShellFolder = (folder: ShellFolder): void => {
  folders.set(folder.id, folder)
  for (const listener of listeners) listener()
}
export const shellFolder = (id: ShellFolderId): ShellFolder | undefined => folders.get(id)
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export const useShellFolder = (id?: ShellFolderId): ShellFolder | undefined =>
  useSyncExternalStore(subscribe, () => (id ? shellFolder(id) : undefined))
