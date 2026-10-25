import { describe, expect, it } from 'vitest'
import { children, emptyDrive, type FsAction, fsReducer } from '../fs/fs'
import { DESKTOP_DIR, DOCUMENTS_DIR, type FsState, type NodeId, ROOT } from '../fs/types'
import { planPaste, planShortcuts, resolveShortcut } from './clipboard'

const at = 5000
const ids = () => {
  let n = 0
  return () => `new-${++n}` as NodeId
}
const apply = (state: FsState, actions: readonly FsAction[]) => actions.reduce(fsReducer, state)
const names = (state: FsState, parent: NodeId) => children(state, parent).map((node) => node.name)
const README = 'readme' as NodeId

function withFolder(): FsState {
  const state = emptyDrive(at)
  return [
    { kind: 'folder', id: 'f' as NodeId, name: 'Work', parent: DESKTOP_DIR, modified: at },
    { kind: 'file', id: 'f1' as NodeId, name: 'a.txt', parent: 'f' as NodeId, content: 'A', modified: at },
  ].reduce((next, node) => fsReducer(next, { type: 'create', node: node as never }), state)
}

describe('paste', () => {
  it('pastes a recycled item cut from the bin into a folder and forgets where it was deleted from', () => {
    const state = fsReducer(emptyDrive(at), { type: 'recycle', id: README, at })
    const plan = planPaste(state, { op: 'cut', ids: [README] }, DESKTOP_DIR, at, ids())
    const next = apply(state, plan.ok ? plan.actions : [])
    expect(names(next, DESKTOP_DIR)).toEqual(['Readme.txt'])
    expect(next.recycled[README]).toBeUndefined()
    const copied = planPaste(state, { op: 'copy', ids: [README] }, DESKTOP_DIR, at, ids())
    expect(copied.ok && copied.actions).toEqual([])
  })

  it('copies into another folder under the same name, leaving the original', () => {
    const state = emptyDrive(at)
    const plan = planPaste(state, { op: 'copy', ids: [README] }, DESKTOP_DIR, at, ids())
    expect(plan.ok).toBe(true)
    const next = apply(state, plan.ok ? plan.actions : [])
    expect(names(next, DESKTOP_DIR)).toEqual(['Readme.txt'])
    expect(names(next, DOCUMENTS_DIR)).toEqual(['Readme.txt'])
  })

  it('names a copy into the same folder Copy of, then Copy (2) of', () => {
    let state = emptyDrive(at)
    const makeId = ids()
    for (let i = 0; i < 2; i++) {
      const plan = planPaste(state, { op: 'copy', ids: [README] }, DOCUMENTS_DIR, at, makeId)
      state = apply(state, plan.ok ? plan.actions : [])
    }
    expect(names(state, DOCUMENTS_DIR)).toEqual([
      'Copy (2) of Readme.txt',
      'Copy of Readme.txt',
      'Readme.txt',
    ])
  })

  it('copies a folder with everything inside it', () => {
    const state = withFolder()
    const plan = planPaste(state, { op: 'copy', ids: ['f' as NodeId] }, DOCUMENTS_DIR, at, ids())
    const next = apply(state, plan.ok ? plan.actions : [])
    const copy = children(next, DOCUMENTS_DIR).find((node) => node.name === 'Work')
    expect(copy && names(next, copy.id)).toEqual(['a.txt'])
    expect(names(next, 'f' as NodeId)).toEqual(['a.txt'])
  })

  it('moves on a cut paste', () => {
    const state = emptyDrive(at)
    const plan = planPaste(state, { op: 'cut', ids: [README] }, DESKTOP_DIR, at, ids())
    const next = apply(state, plan.ok ? plan.actions : [])
    expect(names(next, DESKTOP_DIR)).toEqual(['Readme.txt'])
    expect(names(next, DOCUMENTS_DIR)).toEqual([])
  })

  it('refuses to move a folder into itself or onto a name already there', () => {
    const state = withFolder()
    expect(planPaste(state, { op: 'cut', ids: ['f' as NodeId] }, 'f' as NodeId, at, ids())).toMatchObject({
      ok: false,
      message: 'Cannot move Work: The destination folder is a subfolder of the source folder.',
    })
    const copied = apply(state, [
      {
        type: 'create',
        node: {
          kind: 'file',
          id: 'x' as NodeId,
          name: 'Readme.txt',
          parent: ROOT,
          content: '',
          modified: at,
        },
      },
    ])
    expect(planPaste(copied, { op: 'cut', ids: [README] }, ROOT, at, ids()).ok).toBe(false)
  })
})

describe('shortcuts', () => {
  it('creates Shortcut to X, numbering repeats, and resolves to the target', () => {
    const state = emptyDrive(at)
    const makeId = ids()
    const first = planShortcuts(state, [{ kind: 'node', id: README }], DESKTOP_DIR, at, makeId)
    const once = apply(state, first.ok ? first.actions : [])
    const second = planShortcuts(once, [{ kind: 'node', id: README }], DESKTOP_DIR, at, makeId)
    const twice = apply(once, second.ok ? second.actions : [])
    expect(names(twice, DESKTOP_DIR)).toEqual(['Shortcut (2) to Readme.txt', 'Shortcut to Readme.txt'])
    const link = twice.nodes['new-1' as NodeId]
    expect(link && resolveShortcut(twice, link)).toEqual({ kind: 'node', node: twice.nodes[README] })
  })

  it('resolves app shortcuts and shortcuts to shortcuts', () => {
    const state = emptyDrive(at)
    const plan = planShortcuts(
      state,
      [{ kind: 'app', app: 'mycomputer', label: 'My Computer' }],
      DESKTOP_DIR,
      at,
      ids(),
    )
    const next = apply(state, plan.ok ? plan.actions : [])
    const link = next.nodes['new-1' as NodeId]
    expect(link?.name).toBe('Shortcut to My Computer')
    expect(link && resolveShortcut(next, link)).toEqual({ kind: 'app', app: 'mycomputer' })
    const chain = planShortcuts(
      next,
      [{ kind: 'node', id: 'new-1' as NodeId }],
      ROOT,
      at,
      () => 'chain' as NodeId,
    )
    const chained = apply(next, chain.ok ? chain.actions : [])
    const outer = chained.nodes['chain' as NodeId]
    expect(outer && resolveShortcut(chained, outer)).toEqual({ kind: 'app', app: 'mycomputer' })
  })

  it('reports a missing target once it is recycled or gone', () => {
    const state = emptyDrive(at)
    const plan = planShortcuts(state, [{ kind: 'node', id: README }], DESKTOP_DIR, at, () => 'l' as NodeId)
    const linked = apply(state, plan.ok ? plan.actions : [])
    const recycled = fsReducer(linked, { type: 'recycle', id: README, at })
    const link = recycled.nodes['l' as NodeId]
    expect(link && resolveShortcut(recycled, link)).toBeNull()
    const purged = fsReducer(recycled, { type: 'purge', id: README })
    expect(link && resolveShortcut(purged, link)).toBeNull()
  })
})
