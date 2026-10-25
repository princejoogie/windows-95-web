import { describe, expect, it } from 'vitest'
import { children, emptyDrive, fsReducer } from '../fs/fs'
import { DOCUMENTS_DIR, type FsState, type NodeId, ROOT } from '../fs/types'
import { planPaste } from './clipboard'
import { planUndo, undoEntry } from './undo'

describe('Explorer undo', () => {
  const before = emptyDrive(0)
  const readme = Object.values(before.nodes).find((node) => node.name === 'Readme.txt')
  if (!readme) throw new Error('Seeded document missing')
  const undo = (after: FsState, current = after) => {
    const entry = undoEntry(before, after, 'Operation')
    if (!entry) throw new Error('Expected a changed item')
    const plan = planUndo(current, entry, 10)
    if (!plan.ok) throw new Error(plan.message)
    return plan.actions.reduce(fsReducer, current)
  }
  it('undoes a move without discarding a later content edit', () => {
    const moved = fsReducer(before, { type: 'move', id: readme.id, parent: ROOT, at: 2 })
    const edited = fsReducer(moved, { type: 'write', id: readme.id, content: 'Later edit', at: 3 })
    const restored = undo(moved, edited)
    expect(restored.nodes[readme.id]).toMatchObject({ parent: DOCUMENTS_DIR, content: 'Later edit' })
  })
  it('undoes rename and recycle and clears the deletion record', () => {
    const renamed = fsReducer(before, { type: 'rename', id: readme.id, name: 'Other.txt', at: 2 })
    expect(undo(renamed).nodes[readme.id]?.name).toBe('Readme.txt')
    const deleted = fsReducer(before, { type: 'recycle', id: readme.id, at: 2 })
    const restored = undo(deleted)
    expect(restored.nodes[readme.id]?.parent).toBe(DOCUMENTS_DIR)
    expect(restored.recycled[readme.id]).toBeUndefined()
  })
  it('refuses to overwrite an item that now occupies the original name', () => {
    const renamed = fsReducer(before, { type: 'rename', id: readme.id, name: 'Other.txt', at: 2 })
    const other = Object.values(before.nodes).find((node) => node.name === 'CONFIG.SYS')
    if (!other) throw new Error('Seeded configuration missing')
    const moved = fsReducer(renamed, { type: 'move', id: other.id, parent: DOCUMENTS_DIR, at: 3 })
    const collision = fsReducer(moved, { type: 'rename', id: other.id, name: readme.name, at: 4 })
    const entry = undoEntry(before, renamed, 'Rename')
    if (!entry) throw new Error('Expected rename')
    expect(planUndo(collision, entry, 5).ok).toBe(false)
    const changed = fsReducer(renamed, { type: 'rename', id: readme.id, name: 'Changed again.txt', at: 4 })
    expect(planUndo(changed, entry, 5).ok).toBe(false)
  })
  it('undoes a copy by deleting the copied folder and everything in it', () => {
    let n = 0
    const plan = planPaste(
      before,
      { op: 'copy', ids: [DOCUMENTS_DIR] },
      ROOT,
      2,
      () => `copy-${++n}` as NodeId,
    )
    if (!plan.ok) throw new Error(plan.message)
    const copied = plan.actions.reduce(fsReducer, before)
    expect(children(copied, ROOT).map((node) => node.name)).toContain('Copy of My Documents')
    const entry = undoEntry(before, copied, 'Copy')
    expect(entry?.created?.map((node) => node.name)).toEqual(['Copy of My Documents'])
    const undone = undo(copied)
    expect(Object.keys(undone.nodes).sort()).toEqual(Object.keys(before.nodes).sort())
  })
  it('does not record a failed or unchanged operation', () => {
    expect(undoEntry(before, before, 'Move')).toBeNull()
  })
})
