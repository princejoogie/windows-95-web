import { describe, expect, it } from 'vitest'
import { emptyDrive, fsReducer } from '../fs/fs'
import {
  DESKTOP_DIR,
  DOCUMENTS_DIR,
  type FsNode,
  type NodeId,
  RECYCLED_DIR,
  ROOT,
  WINDOWS_DIR,
} from '../fs/types'
import {
  attributesOf,
  dosName,
  dosNames,
  formatShortDate,
  formatSize,
  isHidden,
  shortcutInfo,
} from './properties'

describe('MS-DOS names', () => {
  it('uppercases names that already fit 8.3', () => {
    expect(dosName('Readme.txt')).toBe('README.TXT')
    expect(dosName('AUTOEXEC.BAT')).toBe('AUTOEXEC.BAT')
    expect(dosName('WINDOWS')).toBe('WINDOWS')
  })

  it('cuts long names to six characters and a tilde number', () => {
    expect(dosName('My Documents')).toBe('MYDOCU~1')
    expect(dosName('New Text Document.txt')).toBe('NEWTEX~1.TXT')
    expect(dosName('Shortcut to Readme.txt.lnk')).toBe('SHORTC~1.LNK')
    expect(dosName('notes.backup.text')).toBe('NOTESB~1.TEX')
  })

  it('replaces characters DOS forbids and numbers past names already taken', () => {
    expect(dosName('a+b=c.txt')).toBe('A_B_C~1.TXT')
    expect(dosName('New Text Document.txt', new Set(['NEWTEX~1.TXT']))).toBe('NEWTEX~2.TXT')
  })

  it('numbers siblings in the order they were created', () => {
    const at = 1000
    const file = (id: string, name: string, created: number): FsNode => ({
      kind: 'file',
      id: id as NodeId,
      name,
      parent: DOCUMENTS_DIR,
      content: '',
      modified: at,
      created,
    })
    const state = [file('b', 'Long file name two.txt', 2), file('a', 'Long file name one.txt', 1)].reduce(
      (next, node) => fsReducer(next, { type: 'create', node }),
      emptyDrive(at),
    )
    const names = dosNames(state, DOCUMENTS_DIR)
    expect(names.get('a' as NodeId)).toBe('LONGFI~1.TXT')
    expect(names.get('b' as NodeId)).toBe('LONGFI~2.TXT')
  })
})

describe('attributes', () => {
  const state = emptyDrive(0)
  it('marks RECYCLED hidden and system, and files archive', () => {
    const recycled = state.nodes[RECYCLED_DIR] as FsNode
    expect(attributesOf(recycled)).toMatchObject({ hidden: true, system: true })
    expect(isHidden(recycled)).toBe(true)
    expect(attributesOf(state.nodes['readme' as NodeId] as FsNode)).toMatchObject({
      archive: true,
      hidden: false,
    })
    expect(isHidden(state.nodes[ROOT] as FsNode)).toBe(false)
  })

  it('lets stored bits override the defaults', () => {
    const next = fsReducer(state, {
      type: 'setAttributes',
      id: 'readme' as NodeId,
      attributes: { hidden: true },
    })
    expect(attributesOf(next.nodes['readme' as NodeId] as FsNode)).toMatchObject({
      hidden: true,
      archive: true,
    })
  })
})

describe('sizes', () => {
  it('shows bytes, then KB with the exact count', () => {
    expect(formatSize(422)).toBe('422 bytes (422 bytes)')
    expect(formatSize(1201)).toBe('1.17KB (1,201 bytes)')
    expect(formatSize(30 * 1024)).toBe('30.0KB (30,720 bytes)')
  })
})

describe('Shortcut tab', () => {
  const nodes: FsNode[] = [
    {
      kind: 'program',
      id: 'calc' as NodeId,
      name: 'CALC.EXE',
      parent: WINDOWS_DIR,
      app: 'calc',
      modified: 0,
    },
    {
      kind: 'shortcut',
      id: 'toCalc' as NodeId,
      name: 'Calculator',
      parent: DESKTOP_DIR,
      app: 'calc',
      modified: 0,
    },
    { kind: 'file', id: 'note' as NodeId, name: 'Note.txt', parent: DOCUMENTS_DIR, content: '', modified: 0 },
    {
      kind: 'shortcut',
      id: 'toNote' as NodeId,
      name: 'Shortcut to Note',
      parent: DESKTOP_DIR,
      target: 'note' as NodeId,
      modified: 0,
    },
  ]
  const state = nodes.reduce((acc, node) => fsReducer(acc, { type: 'create', node }), emptyDrive(0))
  it('shows an app shortcut as its installed program, started in the program folder', () => {
    expect(shortcutInfo(state, state.nodes['toCalc' as NodeId] as FsNode)).toEqual({
      type: 'Application',
      location: 'WINDOWS',
      target: 'C:\\WINDOWS\\CALC.EXE',
      startIn: 'C:\\WINDOWS',
      folder: WINDOWS_DIR,
    })
  })
  it('shows a document shortcut with its document type and folder', () => {
    expect(shortcutInfo(state, state.nodes['toNote' as NodeId] as FsNode)).toMatchObject({
      type: 'Text Document',
      location: 'My Documents',
      target: 'C:\\My Documents\\Note.txt',
      folder: DOCUMENTS_DIR,
    })
  })
  it('has nothing for a node that is not a shortcut', () => {
    expect(shortcutInfo(state, state.nodes['note' as NodeId] as FsNode)).toBeNull()
  })
})

describe('short dates', () => {
  it('formats M/d/yy h:mm AM as Explorer does', () => {
    expect(formatShortDate(new Date(2026, 0, 5, 0, 7).getTime())).toBe('1/5/26 12:07 AM')
  })
})
