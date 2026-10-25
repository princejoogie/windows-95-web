import { isInside } from '../../fs/fs'
import { type FsState, type NodeId, RECYCLED_DIR } from '../../fs/types'
import { type SearchCriteria, type SizeFilter, validateCriteria } from './search'

export interface SavedSearch {
  readonly criteria: SearchCriteria
  readonly results: readonly NodeId[] | null
}

export function readSearch(content: string, state: FsState): SavedSearch | null {
  try {
    const data: unknown = JSON.parse(content)
    if (!data || typeof data !== 'object' || !('criteria' in data) || !('results' in data)) return null
    const c = data.criteria
    if (
      !c ||
      typeof c !== 'object' ||
      !('name' in c) ||
      typeof c.name !== 'string' ||
      !('folder' in c) ||
      !('recursive' in c) ||
      typeof c.recursive !== 'boolean' ||
      !('caseSensitive' in c) ||
      typeof c.caseSensitive !== 'boolean' ||
      !('containing' in c) ||
      typeof c.containing !== 'string' ||
      !('fileType' in c) ||
      typeof c.fileType !== 'string' ||
      !('modified' in c) ||
      !('size' in c)
    )
      return null
    const folder = Object.values(state.nodes).find(
      (node) => node.id === c.folder && (node.kind === 'folder' || node.kind === 'drive'),
    )
    if (!folder || isInside(state, folder.id, RECYCLED_DIR)) return null
    const m = c.modified
    const s = c.size
    if (!m || typeof m !== 'object' || !('kind' in m) || !s || typeof s !== 'object' || !('kind' in s))
      return null
    const modified =
      m.kind === 'all'
        ? ({ kind: 'all' } as const)
        : m.kind === 'between' &&
            'from' in m &&
            typeof m.from === 'string' &&
            'to' in m &&
            typeof m.to === 'string'
          ? ({ kind: 'between', from: m.from, to: m.to } as const)
          : m.kind === 'previous' &&
              'count' in m &&
              typeof m.count === 'number' &&
              'unit' in m &&
              (m.unit === 'days' || m.unit === 'months')
            ? ({ kind: 'previous', count: m.count, unit: m.unit } as const)
            : null
    const size: SizeFilter | null =
      s.kind === 'any'
        ? { kind: 'any' }
        : (s.kind === 'at-least' || s.kind === 'at-most') && 'kb' in s && typeof s.kb === 'number'
          ? { kind: s.kind, kb: s.kb }
          : null
    if (!modified || !size) return null
    const criteria: SearchCriteria = {
      name: c.name,
      folder: folder.id,
      recursive: c.recursive,
      caseSensitive: c.caseSensitive,
      containing: c.containing,
      fileType: c.fileType,
      modified,
      size,
    }
    if (validateCriteria(criteria) || (data.results !== null && !Array.isArray(data.results))) return null
    const ids = data.results
    const results = Array.isArray(ids)
      ? Object.values(state.nodes)
          .filter((node) => ids.includes(node.id) && !isInside(state, node.id, RECYCLED_DIR))
          .map((node) => node.id)
      : null
    return { criteria, results }
  } catch {
    return null
  }
}
