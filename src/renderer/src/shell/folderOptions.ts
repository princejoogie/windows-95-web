import { useMemo } from 'react'
import type { FsNode } from '../fs/types'
import { createStore, useStore } from '../lib/store'
import { displayName, renamedName } from './naming'
import { apps } from './registry'

/** How the Recycle Bin treats one drive, or every drive when they share a setting. */
export interface BinSetting {
  /** Do not move files to the Recycle Bin. Remove files immediately when deleted. */
  readonly nuke: boolean
  /** Maximum size of the Recycle Bin, in percent of the drive. */
  readonly percent: number
}

/**
 * View > Options and Recycle Bin Properties, which in Windows 95 apply to every folder window and to the
 * desktop.
 */
export interface FolderOptions {
  readonly hideExtensions: boolean
  readonly sameWindow: boolean
  readonly showHidden: boolean
  readonly confirmDelete: boolean
  /** Display the full MS-DOS path in the title bar. */
  readonly fullPath: boolean
  /** Include description bar for right and left panes: Explorer's `All Folders` and `Contents of` bars. */
  readonly descriptionBar: boolean
  /** Configure drives independently, rather than one setting for all drives. */
  readonly binIndependent: boolean
  readonly binGlobal: BinSetting
  readonly binDrive: BinSetting
}

export const OPTIONS_KEY = 'w95.folder-options.v1'
const defaults: FolderOptions = {
  hideExtensions: true,
  sameWindow: false,
  showHidden: false,
  confirmDelete: true,
  fullPath: false,
  descriptionBar: true,
  binIndependent: false,
  binGlobal: { nuke: false, percent: 10 },
  binDrive: { nuke: false, percent: 10 },
}

function readBin(value: unknown, fallback: BinSetting): BinSetting {
  if (!value || typeof value !== 'object') return fallback
  return {
    nuke: 'nuke' in value && value.nuke === true,
    percent:
      'percent' in value && typeof value.percent === 'number' && value.percent >= 0 && value.percent <= 100
        ? Math.round(value.percent)
        : fallback.percent,
  }
}

function readOptions(): FolderOptions {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? 'null')
    if (!parsed || typeof parsed !== 'object') return defaults
    const flag = (key: keyof FolderOptions, fallback: boolean): boolean =>
      key in parsed && typeof (parsed as Record<string, unknown>)[key] === 'boolean'
        ? Boolean((parsed as Record<string, unknown>)[key])
        : fallback
    return {
      hideExtensions: flag('hideExtensions', defaults.hideExtensions),
      sameWindow: flag('sameWindow', defaults.sameWindow),
      showHidden: flag('showHidden', defaults.showHidden),
      confirmDelete: flag('confirmDelete', defaults.confirmDelete),
      fullPath: flag('fullPath', defaults.fullPath),
      descriptionBar: flag('descriptionBar', defaults.descriptionBar),
      binIndependent: flag('binIndependent', defaults.binIndependent),
      binGlobal: readBin('binGlobal' in parsed ? parsed.binGlobal : null, defaults.binGlobal),
      binDrive: readBin('binDrive' in parsed ? parsed.binDrive : null, defaults.binDrive),
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

let shift = false
for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup'] as const)
  globalThis.addEventListener?.(type, (event) => (shift = event.shiftKey), true)

/**
 * Whether a delete skips the Recycle Bin: Shift is held (Shift+Delete, or Shift on a Delete command or a drop
 * on the bin), or Recycle Bin Properties says not to move files there.
 */
export function deletesForGood(options: FolderOptions = folderOptions.get(), shiftHeld = shift): boolean {
  return shiftHeld || (options.binIndependent ? options.binDrive : options.binGlobal).nuke
}
