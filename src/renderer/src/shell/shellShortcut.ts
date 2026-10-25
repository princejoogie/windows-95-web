import type { ShellShortcutTarget } from '../fs/types'

export function parseShellShortcut(value: unknown): ShellShortcutTarget | null {
  if (!value || typeof value !== 'object' || !('folder' in value) || !('kind' in value)) return null
  const folder = value.folder
  if (folder !== 'controlpanel' && folder !== 'printers' && folder !== 'network' && folder !== 'fonts')
    return null
  if (value.kind === 'folder') return { kind: 'folder', folder }
  if (
    value.kind === 'item' &&
    'item' in value &&
    typeof value.item === 'string' &&
    value.item.length > 0 &&
    value.item.length <= 128
  )
    return { kind: 'item', folder, item: value.item }
  return null
}
export const shellShortcutApp = (target: ShellShortcutTarget): string =>
  target.folder === 'fonts' ? 'controlpanel' : target.folder
export const shellShortcutAddress = (target: ShellShortcutTarget): string =>
  `shell:${target.folder}:${target.kind === 'folder' ? '' : encodeURIComponent(target.item)}`
export function parseShellShortcutAddress(value: string): ShellShortcutTarget | null {
  const parts = value.split(':')
  if (parts.length !== 3 || parts[0] !== 'shell') return null
  try {
    return parseShellShortcut(
      parts[2]
        ? { kind: 'item', folder: parts[1], item: decodeURIComponent(parts[2]) }
        : { kind: 'folder', folder: parts[1] },
    )
  } catch {
    return null
  }
}
