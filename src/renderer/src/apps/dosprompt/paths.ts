import { children } from '../../fs/fs'
import { type FsNode, type FsState, type NodeId, ROOT } from '../../fs/types'

const SHORT_NAME = /^[A-Z0-9!#$%&'()@^_`{}~-]{1,8}(\.[A-Z0-9!#$%&'()@^_`{}~-]{1,3})?$/

export function shortNames(state: FsState, parent: NodeId): Map<NodeId, string> {
  const entries = children(state, parent)
  const names = new Map<NodeId, string>()
  const used = new Set(entries.map((node) => node.name.toUpperCase()).filter((name) => SHORT_NAME.test(name)))
  for (const node of entries) {
    const upper = node.name.toUpperCase()
    if (SHORT_NAME.test(upper)) {
      names.set(node.id, upper)
      continue
    }
    const dot = upper.lastIndexOf('.')
    const clean = (part: string) => part.replace(/[^A-Z0-9!#$%&'()@^_`{}~-]/g, '')
    const stem = clean(dot > 0 ? upper.slice(0, dot) : upper) || '_'
    const ext = dot > 0 ? clean(upper.slice(dot + 1)).slice(0, 3) : ''
    for (let n = 1; ; n++) {
      const suffix = `~${n}`
      const name = `${stem.slice(0, 8 - suffix.length)}${suffix}${ext ? `.${ext}` : ''}`
      if (used.has(name)) continue
      used.add(name)
      names.set(node.id, name)
      break
    }
  }
  return names
}

export function resolveDosPath(state: FsState, cwd: NodeId, path: string): FsNode | undefined {
  const value = path.replace(/\//g, '\\')
  const drive = /^([a-z]):/i.exec(value)
  if (drive && drive[1]?.toUpperCase() !== 'C') return undefined
  const rest = drive ? value.slice(2) : value
  let node = state.nodes[rest.startsWith('\\') ? ROOT : cwd]
  for (const part of rest.split('\\').filter(Boolean)) {
    if (!node || (node.kind !== 'folder' && node.kind !== 'drive')) return undefined
    if (part === '.') continue
    if (part === '..') {
      node = state.nodes[node.parent ?? ROOT]
      continue
    }
    const aliases = shortNames(state, node.id)
    const wanted = part.toUpperCase()
    node = children(state, node.id).find(
      (child) => child.name.toUpperCase() === wanted || aliases.get(child.id) === wanted,
    )
  }
  return node
}

export function destination(state: FsState, cwd: NodeId, path: string) {
  const normalized = path.replace(/\//g, '\\')
  const split = normalized.lastIndexOf('\\')
  const parentPath =
    split < 0 ? (/^[a-z]:/i.test(normalized) ? normalized.slice(0, 2) : '') : normalized.slice(0, split + 1)
  const name = split < 0 ? normalized.replace(/^[a-z]:/i, '') : normalized.slice(split + 1)
  const parent = resolveDosPath(state, cwd, parentPath)
  return parent && (parent.kind === 'drive' || parent.kind === 'folder') ? { parent: parent.id, name } : null
}

export function wildcard(name: string, pattern: string): boolean {
  const normalized = pattern.toUpperCase()
  if (normalized === '*.*' || normalized === '*') return true
  const expression = normalized
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${expression}$`, 'i').test(name)
}

export function matches(state: FsState, cwd: NodeId, path: string): FsNode[] {
  const exact = resolveDosPath(state, cwd, path)
  if (exact) return [exact]
  const target = destination(state, cwd, path)
  if (!target) return []
  const aliases = shortNames(state, target.parent)
  return children(state, target.parent).filter(
    (node) => wildcard(node.name, target.name) || wildcard(aliases.get(node.id) ?? node.name, target.name),
  )
}

export function tokens(line: string): string[] {
  return Array.from(line.matchAll(/"([^"]*)"|([^\s"]+)/g), (match) => match[1] ?? match[2] ?? '')
}
