import { describe, expect, it } from 'vitest'
import { emptyDrive, fileSize } from '../../fs/fs'
import { type FsNode, ROOT } from '../../fs/types'
import { displayName, renamedName } from '../../shell/naming'
import { bytesOf, formatShortDate as formatDate } from '../../ui/properties'
import { bytes } from '../dosprompt/directory'

describe('Windows 95 file lengths', () => {
  it.each([
    ['CALC.EXE', 59392],
    ['NOTEPAD.EXE', 34304],
    ['WINMINE.EXE', 24064],
    ['SOL.EXE', 180736],
    ['EXPLORER.EXE', 204288],
  ])('reports the same %s length in folders, Properties, and DIR', (name, size) => {
    const node: FsNode = { id: ROOT, name, parent: ROOT, modified: 0, kind: 'program', app: name }
    expect(fileSize(node)).toBe(size)
    expect(bytes(node)).toBe(size)
    expect(bytesOf(emptyDrive(0), node)).toBe(size)
  })
  it('counts UTF-8 bytes without assigning a length to folders', () => {
    expect(fileSize({ id: ROOT, name: 'x.txt', parent: ROOT, modified: 0, kind: 'file', content: 'é' })).toBe(
      2,
    )
    expect(fileSize({ id: ROOT, name: 'folder', parent: ROOT, modified: 0, kind: 'folder' })).toBe(0)
  })
  it('keeps the executable length after renaming or copying an installed program', () => {
    expect(
      fileSize({
        id: ROOT,
        name: 'Renamed.exe',
        parent: ROOT,
        modified: 0,
        kind: 'program',
        app: 'calculator',
      }),
    ).toBe(59392)
  })
})

describe('Folder labels', () => {
  const node: FsNode = { id: ROOT, name: 'Readme.txt', parent: ROOT, modified: 0, kind: 'file', content: '' }
  const registered = new Set(['txt'])
  it('hides registered extensions and preserves them when renaming the stem', () => {
    expect(displayName(node, true, registered)).toBe('Readme')
    expect(renamedName(node, 'Notes', true, registered)).toBe('Notes.txt')
    expect(displayName({ ...node, name: 'Notes.xyz' }, true, registered)).toBe('Notes.xyz')
    expect(displayName(node, false, registered)).toBe('Readme.txt')
  })
  it('uses the Windows 95 short date and minute time', () => {
    expect(formatDate(new Date(2026, 9, 25, 16, 18, 10).getTime())).toBe('10/25/26 4:18 PM')
  })
})
