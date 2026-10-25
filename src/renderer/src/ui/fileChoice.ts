import { children, extension, findChild, pathOf, resolvePath, validateName } from '../fs/fs'
import type { FsNode, FsState, NodeId } from '../fs/types'

export interface FileTypeFilter {
  readonly label: string
  readonly extensions: readonly string[]
}

/** What a dialog may hand back: documents, plus installed programs for Run's Browse. */
export type Pickable = Extract<FsNode['kind'], 'file' | 'program'>

export const DOCUMENTS: readonly Pickable[] = ['file']

export const isPickable = (node: FsNode, pickable: readonly Pickable[]): boolean =>
  pickable.some((kind) => kind === node.kind)

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
  pickable: readonly Pickable[] = DOCUMENTS,
  /** The name the list shows, so a name typed or picked with its extension hidden still finds the file. */
  label: (node: FsNode) => string = (node) => node.name,
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
  const typedName = path.slice(split + 1).toLowerCase()
  const existing =
    findChild(state, parent.id, name) ??
    children(state, parent.id).find(
      (child) =>
        isPickable(child, pickable) &&
        (!defaultExtension || extension(child.name) === defaultExtension) &&
        label(child).toLowerCase() === typedName,
    )
  if (existing && isPickable(existing, pickable)) {
    return { kind: 'existing', id: existing.id, parent: parent.id, name: existing.name }
  }
  if (existing) return { kind: 'error', message: 'This item is not a document.' }
  const error = validateName(state, parent.id, name)
  if (error) return { kind: 'error', message: error }
  if (mode === 'open')
    return {
      kind: 'error',
      message: `${name}\nFile not found.\nPlease verify the correct file name was given.`,
    }
  return { kind: 'new', parent: parent.id, name }
}
