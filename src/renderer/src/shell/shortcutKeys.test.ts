import { describe, expect, it } from 'vitest'
import { emptyDrive, fsReducer } from '../fs/fs'
import { shortcutKey } from '../fs/shortcutKey'
import { DESKTOP_DIR, type NodeId } from '../fs/types'
import { shortcutForKey } from './shortcutKeys'

describe('global shortcut keys', () => {
  const id = 'hotkey-shortcut' as NodeId
  const created = fsReducer(emptyDrive(0), {
    type: 'create',
    node: { id, parent: DESKTOP_DIR, name: 'Calculator', kind: 'shortcut', app: 'calculator', modified: 0 },
  })
  const assigned = fsReducer(created, {
    type: 'setShortcut',
    id,
    target: { app: 'calculator' },
    settings: { shortcutKey: 'k' },
  })

  it('stores and resolves a letter without case sensitivity', () => {
    expect(shortcutForKey(assigned, 'k')).toBe(id)
    expect(shortcutForKey(assigned, 'K')).toBe(id)
    expect(shortcutForKey(assigned, 'x')).toBeUndefined()
    expect(shortcutKey('Control')).toBeNull()
    expect(shortcutKey('1')).toBeNull()
  })

  it('clears the key when None is applied and ignores recycled shortcuts', () => {
    const cleared = fsReducer(assigned, {
      type: 'setShortcut',
      id,
      target: { app: 'calculator' },
      settings: {},
    })
    expect(shortcutForKey(cleared, 'k')).toBeUndefined()
    const recycled = fsReducer(assigned, { type: 'recycle', id, at: 2 })
    expect(shortcutForKey(recycled, 'k')).toBeUndefined()
    const restored = fsReducer(recycled, { type: 'restore', id, at: 3 })
    expect(shortcutForKey(restored, 'k')).toBe(id)
  })
})
