import { describe, expect, it } from 'vitest'
import { emptyDrive, fsReducer } from '../fs/fs'
import { DOCUMENTS_DIR, type NodeId, ROOT, WINDOWS_DIR } from '../fs/types'
import { chooseFile, matchesFileType } from './fileChoice'

describe('common file dialog', () => {
  const state = emptyDrive(0)
  it('opens existing files with case-insensitive paths', () => {
    expect(chooseFile(state, ROOT, 'c:\\my documents\\README.txt', 'open')).toMatchObject({
      kind: 'existing',
      name: 'Readme.txt',
    })
  })
  it('navigates folders before applying the default extension', () => {
    expect(chooseFile(state, ROOT, 'My Documents', 'save', 'txt')).toEqual({
      kind: 'folder',
      id: DOCUMENTS_DIR,
    })
  })
  it('returns the destination without creating a file', () => {
    expect(chooseFile(state, ROOT, 'C:\\My Documents\\note', 'save', 'txt')).toEqual({
      kind: 'new',
      parent: DOCUMENTS_DIR,
      name: 'note.txt',
    })
  })
  it('returns existing files for overwrite confirmation', () => {
    expect(chooseFile(state, DOCUMENTS_DIR, 'readme', 'save', 'txt')).toMatchObject({
      kind: 'existing',
      name: 'Readme.txt',
    })
  })
  it('finds a file by the name the list shows with its extension hidden', () => {
    const hidden = (node: { name: string }) => node.name.replace(/\.[^.]+$/, '')
    expect(chooseFile(state, ROOT, 'autoexec', 'open', '', ['file'], hidden)).toMatchObject({
      kind: 'existing',
      name: 'AUTOEXEC.BAT',
    })
    expect(chooseFile(state, DOCUMENTS_DIR, 'Readme', 'save', 'bmp', ['file'], hidden)).toMatchObject({
      kind: 'new',
      name: 'Readme.bmp',
    })
  })
  it('says File not found under the name when Open gets a missing file', () => {
    expect(chooseFile(state, DOCUMENTS_DIR, 'nothere', 'open', 'txt')).toEqual({
      kind: 'error',
      message: 'nothere.txt\nFile not found.\nPlease verify the correct file name was given.',
    })
  })
  it('rejects missing folders, missing open targets, and invalid names', () => {
    for (const name of ['C:\\Missing\\note.txt', 'missing.txt', 'bad?.txt']) {
      expect(chooseFile(state, ROOT, name, 'open').kind).toBe('error')
    }
  })
  it('accepts installed programs only when the dialog picks programs', () => {
    const withCalc = fsReducer(state, {
      type: 'create',
      node: {
        kind: 'program',
        id: 'calc' as NodeId,
        name: 'CALC.EXE',
        parent: WINDOWS_DIR,
        app: 'calc',
        modified: 0,
      },
    })
    expect(chooseFile(withCalc, WINDOWS_DIR, 'calc.exe', 'open')).toEqual({
      kind: 'error',
      message: 'This item is not a document.',
    })
    expect(chooseFile(withCalc, WINDOWS_DIR, 'calc.exe', 'open', '', ['file', 'program'])).toEqual({
      kind: 'existing',
      id: 'calc',
      parent: WINDOWS_DIR,
      name: 'CALC.EXE',
    })
  })
  it('filters extensions case-insensitively and supports all files', () => {
    expect(matchesFileType('NOTE.TXT', { label: 'Text', extensions: ['txt'] })).toBe(true)
    expect(matchesFileType('NOTE.BMP', { label: 'Text', extensions: ['txt'] })).toBe(false)
    expect(matchesFileType('CONFIG.SYS', { label: 'All', extensions: ['*'] })).toBe(true)
  })
})
