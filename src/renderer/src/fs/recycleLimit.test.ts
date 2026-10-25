import { describe, expect, it } from 'vitest'
import { children, emptyDrive, fsReducer } from './fs'
import { DOCUMENTS_DIR, type FsState, type NodeId, RECYCLED_DIR } from './types'

const file = (state: FsState, id: NodeId, parent: NodeId, content: string) =>
  fsReducer(state, { type: 'create', node: { id, name: id, parent, kind: 'file', content, modified: 0 } })

describe('Recycle Bin capacity', () => {
  it('purges the oldest deletion first and counts UTF-8 bytes', () => {
    const older = 'older' as NodeId
    const newer = 'newer' as NodeId
    let state = file(emptyDrive(0), older, DOCUMENTS_DIR, 'ééé')
    state = file(state, newer, DOCUMENTS_DIR, '1234')
    state = fsReducer(state, { type: 'recycle', id: older, at: 1 })
    state = fsReducer(state, { type: 'recycle', id: newer, at: 2 })
    const limited = fsReducer(state, { type: 'limitRecycleBin', bytes: 5 })
    expect(children(limited, RECYCLED_DIR).map((node) => node.id)).toEqual([newer])
    expect(limited.recycled[older]).toBeUndefined()
    expect(limited.recycled[newer]).toEqual({ from: DOCUMENTS_DIR, at: 2 })
  })

  it('counts nested files, removes an entire folder, and leaves live files alone', () => {
    const folder = 'old-folder' as NodeId
    const nested = 'nested' as NodeId
    const live = 'live' as NodeId
    let state = fsReducer(emptyDrive(0), {
      type: 'create',
      node: { id: folder, name: 'Old folder', parent: DOCUMENTS_DIR, kind: 'folder', modified: 0 },
    })
    state = file(state, nested, folder, '123456')
    state = file(state, live, DOCUMENTS_DIR, 'keep me')
    state = fsReducer(state, { type: 'recycle', id: folder, at: 1 })
    const limited = fsReducer(state, { type: 'limitRecycleBin', bytes: 0 })
    expect(children(limited, RECYCLED_DIR)).toEqual([])
    expect(limited.nodes[nested]).toBeUndefined()
    expect(limited.nodes[live]).toMatchObject({ content: 'keep me' })
  })
})
