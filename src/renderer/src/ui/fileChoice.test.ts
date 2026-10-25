import { describe, expect, it } from 'vitest'
import { emptyDrive } from '../fs/fs'
import { DOCUMENTS_DIR, ROOT } from '../fs/types'
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
  it('rejects missing folders, missing open targets, and invalid names', () => {
    for (const name of ['C:\\Missing\\note.txt', 'missing.txt', 'bad?.txt']) {
      expect(chooseFile(state, ROOT, name, 'open').kind).toBe('error')
    }
  })
  it('filters extensions case-insensitively and supports all files', () => {
    expect(matchesFileType('NOTE.TXT', { label: 'Text', extensions: ['txt'] })).toBe(true)
    expect(matchesFileType('NOTE.BMP', { label: 'Text', extensions: ['txt'] })).toBe(false)
    expect(matchesFileType('CONFIG.SYS', { label: 'All', extensions: ['*'] })).toBe(true)
  })
})
