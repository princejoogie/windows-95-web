import { extension, findChild, pathOf, resolvePath, validateName } from '../fs/fs'
import type { FsState, NodeId } from '../fs/types'

export interface FileTypeFilter {
  readonly label: string
  readonly extensions: readonly string[]
}

export type FileDialogResult =
  | { readonly kind: 'existing'; readonly id: NodeId; readonly parent: NodeId; readonly name: string }
  | { readonly kind: 'new'; readonly parent: NodeId; readonly name: string }

export type FileChoice =
  | { readonly kind: 'folder'; readonly id: NodeId }
  | { readonly kind: 'error'; readonly message: string }
  | FileDialogResult

export function matchesFileType(name: string, filter: FileTypeFilter): boolean {
  return filter.extensions.some((ext) => ext === '*' || ext.toLowerCase() === extension(name))
}

export function chooseFile(
  state: FsState,
  folder: NodeId,
  input: string,
  mode: 'open' | 'save',
  defaultExtension = '',
): FileChoice {
  const typed = input
    .trim()
    .replace(/^"(.*)"$/, '$1')
    .replace(/\//g, '\\')
  if (!typed) return { kind: 'error', message: 'You must type a filename.' }
  const path = /^[a-z]:/i.test(typed) ? typed : `${pathOf(state, folder)}\\${typed}`
  const node = resolvePath(state, path)
  if (node?.kind === 'folder' || node?.kind === 'drive') return { kind: 'folder', id: node.id }
  const split = path.lastIndexOf('\\')
  const parent = resolvePath(state, path.slice(0, split))
  if (!parent || (parent.kind !== 'drive' && parent.kind !== 'folder')) {
    return { kind: 'error', message: 'The folder does not exist. Check the path and try again.' }
  }
  let name = path.slice(split + 1)
  if (defaultExtension && !extension(name)) name += `.${defaultExtension}`
  const existing = findChild(state, parent.id, name)
  if (existing?.kind === 'file') {
    return { kind: 'existing', id: existing.id, parent: parent.id, name: existing.name }
  }
  if (existing) return { kind: 'error', message: 'This item is not a document.' }
  const error = validateName(state, parent.id, name)
  if (error) return { kind: 'error', message: error }
  if (mode === 'open')
    return { kind: 'error', message: `Cannot find the file '${name}'. Check the filename and try again.` }
  return { kind: 'new', parent: parent.id, name }
}
