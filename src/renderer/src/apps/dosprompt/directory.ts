import { children, pathOf } from '../../fs/fs'
import type { FsNode, FsState, NodeId } from '../../fs/types'
import { shortNames, wildcard } from './paths'

export const VOLUME = [' Volume in drive C has no label', ' Volume Serial Number is 1995-0950']
export const DISK_BYTES = 536870912
export const bytes = (node: FsNode): number =>
  node.kind === 'file' ? new TextEncoder().encode(node.content).length : 0
export const number = (value: number): string => value.toLocaleString('en-US')
export const freeBytes = (state: FsState): number =>
  Math.max(0, DISK_BYTES - Object.values(state.nodes).reduce((total, node) => total + bytes(node), 0))

function stamp(at: number): string {
  const date = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getFullYear() % 100)}  ${String(date.getHours() % 12 || 12).padStart(2)}:${pad(date.getMinutes())}${date.getHours() < 12 ? 'a' : 'p'}`
}

export function directory(
  state: FsState,
  folder: NodeId,
  pattern: string,
  wide: boolean,
  recursive: boolean,
): string[] {
  const output = [...VOLUME]
  let totalFiles = 0
  let totalBytes = 0
  let totalDirs = 0
  const visit = (id: NodeId) => {
    const aliases = shortNames(state, id)
    const all = children(state, id)
    const entries = all.filter(
      (node) => wildcard(node.name, pattern) || wildcard(aliases.get(node.id) ?? node.name, pattern),
    )
    const current = state.nodes[id]
    const dots = current?.parent && (pattern === '*' || pattern === '*.*') ? ['.', '..'] : []
    output.push('', ` Directory of ${pathOf(state, id)}`, '')
    const row = (alias: string, directory: boolean, size: number, modified: number, longName: string) => {
      const dot = alias === '..' ? -1 : alias.lastIndexOf('.')
      const stem = dot > 0 ? alias.slice(0, dot) : alias
      const ext = dot > 0 ? alias.slice(dot + 1) : ''
      return `${stem.padEnd(8)} ${ext.padEnd(3)} ${directory ? '    <DIR> ' : number(size).padStart(10)}  ${stamp(modified)} ${longName}`
    }
    const names: string[] = []
    for (const dot of dots) {
      if (wide) names.push(`[${dot}]`)
      else output.push(row(dot, true, 0, current?.modified ?? 0, dot))
    }
    let fileCount = 0
    let size = 0
    let dirs = dots.length
    for (const node of entries) {
      const isDir = node.kind === 'folder' || node.kind === 'drive'
      if (isDir) dirs++
      else fileCount++
      size += bytes(node)
      const alias = aliases.get(node.id) ?? node.name
      if (wide) names.push(isDir ? `[${alias}]` : alias)
      else output.push(row(alias, isDir, bytes(node), node.modified, node.name))
    }
    if (wide)
      for (let i = 0; i < names.length; i += 5)
        output.push(
          names
            .slice(i, i + 5)
            .map((name) => name.padEnd(16))
            .join('')
            .trimEnd(),
        )
    if (!entries.length && !dots.length) output.push('File not found')
    output.push(`${String(fileCount).padStart(10)} file(s) ${number(size).padStart(14)} bytes`)
    totalFiles += fileCount
    totalBytes += size
    totalDirs += dirs
    if (recursive) for (const child of all) if (child.kind === 'folder') visit(child.id)
  }
  visit(folder)
  if (recursive)
    output.push(
      '',
      'Total files listed:',
      `${String(totalFiles).padStart(10)} file(s) ${number(totalBytes).padStart(14)} bytes`,
    )
  output.push(`${String(totalDirs).padStart(10)} dir(s)  ${number(freeBytes(state)).padStart(14)} bytes free`)
  return output
}
