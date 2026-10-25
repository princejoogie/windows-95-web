import { describe, expect, it } from 'vitest'
import {
  children,
  type FsAction,
  fsReducer,
  pathOf,
  resolvePath,
  seed,
  uniqueName,
  validateName,
} from './fs'
import { DESKTOP_DIR, DOCUMENTS_DIR, type FsState, type NodeId, type ProgramSpec, RECYCLED_DIR, ROOT } from './types'

const programs: ProgramSpec[] = [
  { app: 'calc', title: 'Calculator', exe: 'CALC.EXE', installDir: 'C:\\WINDOWS', desktopShortcut: false },
  { app: 'doom', title: 'Doom 95', exe: 'DOOM95.EXE', installDir: 'C:\\Games\\Doom', desktopShortcut: true },
]

const at = 1
const fresh = () => seed(programs, at)
const run = (state: FsState, ...actions: FsAction[]) => actions.reduce(fsReducer, state)
const newFile = (id: string, name: string, parent: NodeId = DOCUMENTS_DIR): FsAction => ({
  type: 'create',
  node: { kind: 'file', id: id as NodeId, name, parent, content: '', modified: at },
})
const names = (state: FsState, parent: NodeId) => children(state, parent).map((n) => n.name)

describe('file system', () => {
  it('seeds a C: drive with installed programs and desktop shortcuts', () => {
    const state = fresh()
    expect(resolvePath(state, 'c:\\windows\\calc.exe')).toMatchObject({ kind: 'program', app: 'calc' })
    expect(resolvePath(state, 'C:\\Games\\Doom\\DOOM95.EXE')).toMatchObject({ kind: 'program', app: 'doom' })
    expect(names(state, DESKTOP_DIR)).toEqual(['Doom 95'])
    expect(pathOf(state, DOCUMENTS_DIR)).toBe('C:\\My Documents')
    expect(pathOf(state, ROOT)).toBe('C:\\')
  })

  it('installs programs idempotently, adding only what is missing', () => {
    const state = fresh()
    expect(fsReducer(state, { type: 'installPrograms', programs, shortcuts: true, at })).toBe(state)
    const more = [...programs, { ...programs[0], app: 'notepad', exe: 'NOTEPAD.EXE' } as ProgramSpec]
    const next = fsReducer(state, { type: 'installPrograms', programs: more, shortcuts: false, at })
    expect(resolvePath(next, 'C:\\WINDOWS\\NOTEPAD.EXE')).toMatchObject({ app: 'notepad' })
  })

  it('does not bring back a desktop shortcut the user deleted', () => {
    const state = run(fresh(), { type: 'purge', id: 'lnk:doom' as NodeId })
    const next = fsReducer(state, { type: 'installPrograms', programs, shortcuts: false, at })
    expect(names(next, DESKTOP_DIR)).toEqual([])
  })

  it('lists folders before files, by name, ignoring case', () => {
    const state = run(fresh(), newFile('b', 'beta.txt'), newFile('a', 'Alpha.txt'), {
      type: 'create',
      node: { kind: 'folder', id: 'z' as NodeId, name: 'zeta', parent: DOCUMENTS_DIR, modified: at },
    })
    expect(names(state, DOCUMENTS_DIR)).toEqual(['zeta', 'Alpha.txt', 'beta.txt', 'Readme.txt'])
  })

  it('rejects duplicate and illegal names, case-insensitively', () => {
    const state = fresh()
    expect(validateName(state, DOCUMENTS_DIR, 'README.TXT')).toMatch(/already exists/)
    expect(validateName(state, DOCUMENTS_DIR, 'a:b.txt')).toMatch(/cannot contain/)
    expect(validateName(state, DOCUMENTS_DIR, '  ')).toMatch(/must type/)
    expect(validateName(state, DOCUMENTS_DIR, 'Readme.txt', 'readme' as NodeId)).toBeNull()
    expect(fsReducer(state, newFile('dup', 'readme.txt'))).toBe(state)
  })

  it('numbers new names the way Explorer does', () => {
    const state = run(fresh(), newFile('n1', 'New Text Document.txt'))
    expect(uniqueName(state, DOCUMENTS_DIR, 'New Text Document.txt')).toBe('New Text Document (2).txt')
    expect(uniqueName(state, DOCUMENTS_DIR, 'New Folder')).toBe('New Folder')
  })

  it('recycles a file and restores it to where it was', () => {
    const recycled = run(fresh(), { type: 'recycle', id: 'readme' as NodeId, at: 5 })
    expect(names(recycled, DOCUMENTS_DIR)).toEqual([])
    expect(names(recycled, RECYCLED_DIR)).toEqual(['Readme.txt'])
    expect(recycled.recycled['readme' as NodeId]).toEqual({ from: DOCUMENTS_DIR, at: 5 })

    const restored = fsReducer(recycled, { type: 'restore', id: 'readme' as NodeId, at: 6 })
    expect(names(restored, DOCUMENTS_DIR)).toEqual(['Readme.txt'])
    expect(restored.recycled).toEqual({})
  })

  it('renames a restored file when its old name was taken meanwhile', () => {
    const state = run(
      fresh(),
      { type: 'recycle', id: 'readme' as NodeId, at },
      newFile('again', 'Readme.txt'),
      { type: 'restore', id: 'readme' as NodeId, at },
    )
    expect(names(state, DOCUMENTS_DIR)).toEqual(['Readme (2).txt', 'Readme.txt'])
  })

  it('empties the recycle bin, deleting whole folders', () => {
    const state = run(
      fresh(),
      { type: 'create', node: { kind: 'folder', id: 'f' as NodeId, name: 'Old', parent: DOCUMENTS_DIR, modified: at } },
      newFile('inner', 'inner.txt', 'f' as NodeId),
      { type: 'recycle', id: 'f' as NodeId, at },
      { type: 'emptyRecycleBin' },
    )
    expect(state.nodes['f' as NodeId]).toBeUndefined()
    expect(state.nodes['inner' as NodeId]).toBeUndefined()
    expect(state.recycled).toEqual({})
  })

  it('refuses to move a folder into itself or to touch system folders', () => {
    const state = run(
      fresh(),
      { type: 'create', node: { kind: 'folder', id: 'f' as NodeId, name: 'A', parent: DOCUMENTS_DIR, modified: at } },
      { type: 'create', node: { kind: 'folder', id: 'g' as NodeId, name: 'B', parent: 'f' as NodeId, modified: at } },
    )
    expect(fsReducer(state, { type: 'move', id: 'f' as NodeId, parent: 'g' as NodeId, at })).toBe(state)
    expect(fsReducer(state, { type: 'recycle', id: DESKTOP_DIR, at })).toBe(state)
    expect(fsReducer(state, { type: 'rename', id: DOCUMENTS_DIR, name: 'Docs', at })).toBe(state)
  })

  it('writes file content and stamps the modified time', () => {
    const state = fsReducer(fresh(), { type: 'write', id: 'readme' as NodeId, content: 'hi', at: 9 })
    expect(state.nodes['readme' as NodeId]).toMatchObject({ content: 'hi', modified: 9 })
  })
})
