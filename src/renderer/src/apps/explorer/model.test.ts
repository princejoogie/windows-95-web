import { describe, expect, it } from 'vitest'
import { children, emptyDrive, fsReducer, validateName } from '../../fs/fs'
import { DOCUMENTS_DIR, ROOT, WINDOWS_DIR } from '../../fs/types'
import { cellValue, columns, emptySelection, selectNode, sizeOf, visibleNodes } from './model'

const state = emptyDrive(1000)
const sort = { column: 'name', direction: 'ascending' } as const

describe('Explorer view model', () => {
  it('lists drives in My Computer and hides RECYCLED from C:', () => {
    expect(visibleNodes(state, { kind: 'computer' }, sort).map((n) => n.name)).toEqual(['C:'])
    expect(visibleNodes(state, { kind: 'folder', id: ROOT }, sort).map((n) => n.name)).toEqual([
      'My Documents',
      'WINDOWS',
      'AUTOEXEC.BAT',
      'CONFIG.SYS',
    ])
  })
  it('sorts descending while keeping folders first without changing the filesystem', () => {
    expect(
      visibleNodes(state, { kind: 'folder', id: ROOT }, { ...sort, direction: 'descending' }).map(
        (n) => n.name,
      ),
    ).toEqual(['WINDOWS', 'My Documents', 'CONFIG.SYS', 'AUTOEXEC.BAT'])
    expect(children(state, ROOT).some((n) => n.name === 'RECYCLED')).toBe(true)
  })
  it('sorts sizes and dates numerically', () => {
    const [readme] = children(state, DOCUMENTS_DIR)
    if (!readme) throw new Error('Missing seeded document')
    const moved = fsReducer(state, { type: 'move', id: readme.id, parent: ROOT, at: 20 })
    expect(
      visibleNodes(moved, { kind: 'folder', id: ROOT }, { column: 'size', direction: 'ascending' })
        .filter((n) => n.kind === 'file')
        .map((n) => n.name),
    ).toEqual(['CONFIG.SYS', 'AUTOEXEC.BAT', 'Readme.txt'])
    expect(
      visibleNodes(
        moved,
        { kind: 'folder', id: ROOT },
        { column: 'modified', direction: 'ascending' },
      ).filter((n) => n.kind === 'file')[0]?.name,
    ).toBe('Readme.txt')
  })
  it('shows the four details columns and recycled origin and deletion time', () => {
    expect(columns.slice(0, 4).map((c) => c.label)).toEqual(['Name', 'Size', 'Type', 'Modified'])
    const [readme] = children(state, DOCUMENTS_DIR)
    if (!readme) throw new Error('Missing seeded document')
    expect(cellValue(state, readme, 'type')).toBe('Text Document')
    expect(cellValue(state, readme, 'size')).toBe('1 KB')
    expect(sizeOf({ ...readme, kind: 'file', content: 'é' })).toBe(2)
    const recycled = fsReducer(state, { type: 'recycle', id: readme.id, at: 2000 })
    expect(visibleNodes(recycled, { kind: 'recycle' }, sort).map((n) => n.id)).toEqual([readme.id])
    expect(cellValue(recycled, readme, 'original')).toBe('C:\\My Documents')
    expect(cellValue(recycled, readme, 'deleted')).toBe(new Date(2000).toLocaleString('en-US'))
  })
})

describe('Explorer file lifecycle', () => {
  it('shows a move, rejects a duplicate rename, and updates lists after restore and empty', () => {
    const [readme] = children(state, DOCUMENTS_DIR)
    if (!readme) throw new Error('Missing seeded document')
    const moved = fsReducer(state, { type: 'move', id: readme.id, parent: ROOT, at: 2 })
    expect(visibleNodes(moved, { kind: 'folder', id: DOCUMENTS_DIR }, sort)).toEqual([])
    expect(validateName(moved, ROOT, 'config.sys', readme.id)).toContain('already exists')
    const failed = fsReducer(moved, { type: 'rename', id: readme.id, name: 'config.sys', at: 3 })
    expect(failed.nodes[readme.id]?.name).toBe('Readme.txt')
    const recycled = fsReducer(moved, { type: 'recycle', id: readme.id, at: 4 })
    expect(visibleNodes(recycled, { kind: 'folder', id: ROOT }, sort).some((n) => n.id === readme.id)).toBe(
      false,
    )
    expect(cellValue(recycled, readme, 'original')).toBe('C:\\')
    const restored = fsReducer(recycled, { type: 'restore', id: readme.id, at: 5 })
    expect(visibleNodes(restored, { kind: 'recycle' }, sort)).toEqual([])
    expect(visibleNodes(restored, { kind: 'folder', id: ROOT }, sort).some((n) => n.id === readme.id)).toBe(
      true,
    )
    const emptied = fsReducer(recycled, { type: 'emptyRecycleBin' })
    expect(visibleNodes(emptied, { kind: 'recycle' }, sort)).toEqual([])
    expect(emptied.nodes[readme.id]).toBeUndefined()
  })
})

describe('Explorer selection', () => {
  const order = [ROOT, DOCUMENTS_DIR, WINDOWS_DIR]
  const click = (selection = emptySelection, id = ROOT, ctrl = false, shift = false) =>
    selectNode({ selection, order, id, ctrl, shift })
  it('replaces selection on click and toggles on Ctrl+click', () => {
    const first = click()
    expect([...click(first, DOCUMENTS_DIR).ids]).toEqual([DOCUMENTS_DIR])
    const both = click(first, DOCUMENTS_DIR, true)
    expect([...both.ids]).toEqual([ROOT, DOCUMENTS_DIR])
    expect([...click(both, ROOT, true).ids]).toEqual([DOCUMENTS_DIR])
  })
  it('extends in both directions from the anchor and shrinks a previous range', () => {
    const first = click()
    const range = click(first, WINDOWS_DIR, false, true)
    expect([...range.ids]).toEqual(order)
    expect([...click(range, DOCUMENTS_DIR, false, true).ids]).toEqual([ROOT, DOCUMENTS_DIR])
    expect([...click(click(emptySelection, WINDOWS_DIR), ROOT, false, true).ids]).toEqual(order)
  })
  it('uses visible sort order, supports Ctrl+Shift, and discards stale selections', () => {
    const first = click(emptySelection, WINDOWS_DIR)
    const toggled = click(first, ROOT, true)
    expect([...click(toggled, DOCUMENTS_DIR, true, true).ids]).toEqual([ROOT, WINDOWS_DIR, DOCUMENTS_DIR])
    const next = selectNode({
      selection: first,
      order: [ROOT, DOCUMENTS_DIR],
      id: DOCUMENTS_DIR,
      ctrl: true,
      shift: true,
    })
    expect([...next.ids]).toEqual([DOCUMENTS_DIR])
  })
})
