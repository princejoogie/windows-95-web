import { describe, expect, it } from 'vitest'
import { emptyDrive } from '../../fs/fs'
import { DOCUMENTS_DIR, ROOT } from '../../fs/types'
import { expandTo, folderTree, TREE_DESKTOP, treeRows } from './tree'

describe('Explorer folder tree', () => {
  const root = folderTree(emptyDrive(0))
  it('starts with the desktop and expands only open branches', () => {
    expect(treeRows(root, new Set()).map((row) => row.label)).toEqual(['Desktop'])
    expect(treeRows(root, new Set([TREE_DESKTOP, 'computer'])).map((row) => row.label)).toEqual([
      'Desktop',
      'My Computer',
      '3½ Floppy (A:)',
      '(C:)',
      'Control Panel',
      'Printers',
      'Network Neighborhood',
      'Recycle Bin',
    ])
  })
  it('opens the ancestors of a destination without opening its siblings', () => {
    const expanded = expandTo(root, DOCUMENTS_DIR, new Set())
    expect([...expanded]).toEqual([TREE_DESKTOP, 'computer', ROOT])
    const rows = treeRows(root, expanded)
    expect(rows.find((row) => row.key === DOCUMENTS_DIR)?.depth).toBe(3)
    expect(rows.some((row) => row.label === 'RECYCLED')).toBe(false)
    expect(rows.some((row) => row.key === 'autoexec')).toBe(false)
  })
  it('keeps namespace Desktop and the physical Desktop folder distinct', () => {
    const rows = treeRows(root, new Set([TREE_DESKTOP, 'computer', ...Object.keys(emptyDrive(0).nodes)]))
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length)
    expect(rows.filter((row) => row.label === 'Desktop')).toHaveLength(2)
  })
})
