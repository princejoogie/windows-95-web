import { useMemo } from 'react'
import type { FsNode } from '../fs/types'
import { createStore, useStore } from '../lib/store'
import { displayName, renamedName } from './naming'
import { apps } from './registry'

/** View > Options, which in Windows 95 applies to every folder window and to the desktop. */
export interface FolderOptions {
  readonly hideExtensions: boolean
  readonly sameWindow: boolean
  readonly showHidden: boolean
  readonly confirmDelete: boolean
}

export const OPTIONS_KEY = 'w95.folder-options.v1'
const defaults: FolderOptions = {
  hideExtensions: true,
  sameWindow: false,
  showHidden: false,
  confirmDelete: true,
}

function readOptions(): FolderOptions {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return defaults
    return {
      hideExtensions:
        'hideExtensions' in parsed && typeof parsed.hideExtensions === 'boolean'
          ? parsed.hideExtensions
          : true,
      sameWindow: 'sameWindow' in parsed && parsed.sameWindow === true,
      showHidden: 'showHidden' in parsed && parsed.showHidden === true,
      confirmDelete: !('confirmDelete' in parsed) || parsed.confirmDelete !== false,
    }
  } catch {
    return defaults
  }
}

export const folderOptions = createStore<FolderOptions, FolderOptions>((_old, next) => next, readOptions())
folderOptions.subscribe(() => localStorage.setItem(OPTIONS_KEY, JSON.stringify(folderOptions.get())))

let registered: ReadonlySet<string> | undefined
/** Extensions Windows knows a type for: the system ones plus every installed app's file types. */
export function registeredExtensions(): ReadonlySet<string> {
  registered ??= new Set(['bat', 'sys', 'ini', 'bmp', 'exe', ...apps.flatMap((app) => app.fileTypes ?? [])])
  return registered
}

/** Display and rename against the current options, for the desktop and Properties. */
export function useNaming(): {
  label: (node: FsNode) => string
  rename: (node: FsNode, typed: string) => string
} {
  const hide = useStore(folderOptions, (state) => state.hideExtensions)
  return useMemo(
    () => ({
      label: (node: FsNode) => displayName(node, hide, registeredExtensions()),
      rename: (node: FsNode, typed: string) => renamedName(node, typed, hide, registeredExtensions()),
    }),
    [hide],
  )
}
