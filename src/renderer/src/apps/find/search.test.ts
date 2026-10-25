import { describe, expect, it } from 'vitest'
import { emptyDrive, fsReducer } from '../../fs/fs'
import { DOCUMENTS_DIR, type FsState, ROOT, WINDOWS_DIR } from '../../fs/types'
import { defaultCriteria, fileSize, type SearchCriteria, searchFiles, validateCriteria } from './search'

const now = new Date(2026, 9, 25, 12).getTime()
const state = emptyDrive(now)
const names = (criteria: Partial<SearchCriteria> = {}, drive: FsState = state, at = now) =>
  [...searchFiles(drive, { ...defaultCriteria, ...criteria }, at)].flatMap((node) =>
    node ? [node.name] : [],
  )

describe('Find files', () => {
  it('matches partial names, wildcards, literal regex characters, and multiple patterns', () => {
    expect(names({ name: 'readme' })).toEqual(['Readme.txt', 'Readme.txt'])
    expect(names({ name: 'READ?E.*' })).toHaveLength(2)
    expect(names({ name: '*.bat;*.sys' })).toEqual(['AUTOEXEC.BAT', 'CONFIG.SYS'])
    expect(names({ name: '*.bat;' })).toEqual(['AUTOEXEC.BAT'])
    expect(names({ name: '*.[' })).toEqual([])
    expect(names({ name: '*.*' })).toContain('My Documents')
    expect(names({ name: 'readme', caseSensitive: true })).toEqual([])
  })
  it('limits direct children and recursive descendants and excludes the search root', () => {
    expect(names({ folder: WINDOWS_DIR, recursive: false })).toEqual(['Desktop'])
    expect(names({ folder: WINDOWS_DIR })).toEqual(['Desktop', 'Readme.txt'])
    expect(names({ folder: DOCUMENTS_DIR })).toEqual(['Readme.txt'])
    expect(names({ recursive: false })).not.toContain('Readme.txt')
  })
  it('never exposes recycled trees, even when the selected root is a deleted folder', () => {
    const readme = Object.values(state.nodes).find((node) => node.parent === DOCUMENTS_DIR)
    expect(readme).toBeDefined()
    if (!readme) return
    const recycled = fsReducer(state, { type: 'recycle', id: readme.id, at: now })
    expect(names({ folder: DOCUMENTS_DIR }, recycled)).toEqual([])
  })
  it('combines extension, content, and byte size filters', () => {
    expect(names({ fileType: '.bat', containing: 'prompt' })).toEqual(['AUTOEXEC.BAT'])
    expect(names({ fileType: '.bat', containing: 'PROMPT', caseSensitive: true })).toEqual(['AUTOEXEC.BAT'])
    expect(names({ containing: 'prompt', caseSensitive: true })).toEqual([])
    expect(names({ fileType: 'folder' })).toEqual(['WINDOWS', 'Desktop', 'My Documents'])
    expect(names({ size: { kind: 'at-least', kb: 1 } })).toEqual([])
    expect(names({ size: { kind: 'at-most', kb: 1 } })).toEqual([
      'Readme.txt',
      'Readme.txt',
      'AUTOEXEC.BAT',
      'CONFIG.SYS',
    ])
    const sample = Object.values(state.nodes).find((node) => node.kind === 'file')
    if (sample?.kind !== 'file') throw new Error('Seed file missing')
    expect(fileSize({ ...sample, content: 'é' })).toBe(2)
    const exact = fileSize(sample) / 1024
    expect(names({ name: 'Readme', size: { kind: 'at-least', kb: exact } })).toHaveLength(2)
    expect(names({ name: 'Readme', size: { kind: 'at-most', kb: exact } })).toHaveLength(2)
  })
  it('includes the entire ending date and excludes the following day', () => {
    expect(names({ modified: { kind: 'between', from: '2026-10-25', to: '2026-10-25' } })).toContain(
      'Readme.txt',
    )
    expect(names({ modified: { kind: 'between', from: '2026-10-24', to: '2026-10-24' } })).toEqual([])
  })
  it('handles previous days and clamps previous months at month end', () => {
    expect(names({ modified: { kind: 'previous', count: 0, unit: 'days' } })).toContain('Readme.txt')
    expect(
      names({ modified: { kind: 'previous', count: 1, unit: 'days' } }, state, now + 2 * 86400000),
    ).toEqual([])
    const february = emptyDrive(new Date(2026, 1, 28, 12).getTime())
    expect(
      names(
        { modified: { kind: 'previous', count: 1, unit: 'months' } },
        february,
        new Date(2026, 2, 31, 12).getTime(),
      ),
    ).toContain('Readme.txt')
  })
  it('rejects invalid dates, reversed ranges, and invalid numeric limits', () => {
    expect(
      validateCriteria({
        ...defaultCriteria,
        modified: { kind: 'between', from: '2026-02-30', to: '2026-03-01' },
      }),
    ).not.toBeNull()
    expect(
      validateCriteria({
        ...defaultCriteria,
        modified: { kind: 'between', from: '2026-03-02', to: '2026-03-01' },
      }),
    ).not.toBeNull()
    expect(
      validateCriteria({ ...defaultCriteria, modified: { kind: 'previous', count: -1, unit: 'days' } }),
    ).not.toBeNull()
    expect(validateCriteria({ ...defaultCriteria, size: { kind: 'at-least', kb: NaN } })).not.toBeNull()
  })
  it('can pause traversal without losing or repeating candidates', () => {
    const iterator = searchFiles(state, { ...defaultCriteria, folder: ROOT })
    iterator.next()
    const rest = [...iterator]
    expect(rest).toHaveLength(Object.keys(state.nodes).length - 1)
  })
})
