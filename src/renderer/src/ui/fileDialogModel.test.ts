import { describe, expect, it } from 'vitest'
import { emptyDrive, fsReducer } from '../fs/fs'
import { DESKTOP_DIR, DOCUMENTS_DIR, type FsState, type NodeId, ROOT, WINDOWS_DIR } from '../fs/types'
import { type ListEntry, listEntries, lookInRows, type Place, parentPlace, placeOf } from './fileDialogModel'

const at = 0
const all = { label: 'All Files (*.*)', extensions: ['*'] }
const text = { label: 'Text Documents', extensions: ['txt'] }

function withFiles(): FsState {
  return [
    { kind: 'file', id: 'bmp', name: 'Picture.bmp', parent: DOCUMENTS_DIR, content: '', modified: at },
    { kind: 'folder', id: 'sub', name: 'Letters', parent: DOCUMENTS_DIR, modified: at },
    { kind: 'file', id: 'desk', name: 'Note.txt', parent: DESKTOP_DIR, content: '', modified: at },
    { kind: 'program', id: 'calc', name: 'CALC.EXE', parent: WINDOWS_DIR, app: 'calc', modified: at },
    { kind: 'file', id: 'ini', name: 'WIN.INI', parent: WINDOWS_DIR, content: '', modified: at },
  ].reduce((state, node) => fsReducer(state, { type: 'create', node: node as never }), emptyDrive(at))
}

describe('Look in', () => {
  it('lists Desktop, My Computer, (C:), then the path down to the current folder, indented', () => {
    const rows = lookInRows(withFiles(), { kind: 'folder', id: 'sub' as NodeId })
    expect(rows.map((row) => `${row.indent}:${row.label}`)).toEqual([
      '0:Desktop',
      '1:My Computer',
      '2:(C:)',
      '3:My Documents',
      '4:Letters',
    ])
  })

  it('stops at the drives when looking at the desktop', () => {
    expect(lookInRows(withFiles(), { kind: 'desktop' }).map((row) => row.label)).toEqual([
      'Desktop',
      'My Computer',
      '(C:)',
    ])
  })

  it('goes up from a folder to C:, then My Computer, then Desktop', () => {
    const state = withFiles()
    expect(parentPlace(state, { kind: 'folder', id: DOCUMENTS_DIR })).toEqual({ kind: 'folder', id: ROOT })
    expect(parentPlace(state, { kind: 'folder', id: ROOT })).toEqual({ kind: 'computer' })
    expect(parentPlace(state, { kind: 'computer' })).toEqual({ kind: 'desktop' })
    expect(parentPlace(state, { kind: 'desktop' })).toBeNull()
  })

  it('opens the Desktop folder as the Desktop place', () => {
    expect(placeOf(DESKTOP_DIR)).toEqual({ kind: 'desktop' })
    expect(placeOf(WINDOWS_DIR)).toEqual({ kind: 'folder', id: WINDOWS_DIR })
  })
})

describe('file list', () => {
  it('hides RECYCLED at the root', () => {
    const labels = listEntries(withFiles(), { kind: 'folder', id: ROOT }, all).map((entry) => entry.label)
    expect(labels).toEqual(['My Documents', 'WINDOWS', 'AUTOEXEC.BAT', 'CONFIG.SYS'])
  })

  it('shows folders always and only the files the filter matches', () => {
    const labels = listEntries(withFiles(), { kind: 'folder', id: DOCUMENTS_DIR }, text).map(
      (entry) => entry.label,
    )
    expect(labels).toEqual(['Letters', 'Readme.txt'])
  })

  it('lists programs beside documents only when the dialog picks programs', () => {
    const state = withFiles()
    const windows: Place = { kind: 'folder', id: WINDOWS_DIR }
    const programs = { label: 'Programs', extensions: ['exe', 'com', 'pif', 'bat'] }
    const files = (entries: ListEntry[]) =>
      entries.filter((entry) => entry.kind === 'file').map((entry) => entry.label)
    expect(files(listEntries(state, windows, all))).toEqual(['WIN.INI'])
    expect(files(listEntries(state, windows, programs, ['file', 'program']))).toEqual(['CALC.EXE'])
    expect(files(listEntries(state, windows, all, ['file', 'program']))).toEqual(['CALC.EXE', 'WIN.INI'])
  })

  it('shows My Computer and the desktop files on the Desktop, and drives in My Computer', () => {
    const state = withFiles()
    expect(listEntries(state, { kind: 'desktop' }, all).map((entry) => entry.label)).toEqual([
      'My Computer',
      'Note.txt',
    ])
    expect(listEntries(state, { kind: 'computer' }, all).map((entry) => entry.label)).toEqual(['(C:)'])
  })
})
