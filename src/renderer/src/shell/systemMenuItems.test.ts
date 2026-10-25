import { describe, expect, it } from 'vitest'
import type { MenuEntry } from '../ui/Menu'
import { registerSystemMenuItems, systemMenuItems } from './systemMenuItems'
import { emptyWindows, windowsReducer } from './windows'

describe('app system menus', () => {
  it('keeps contributions per window and removes them when the app unmounts', () => {
    const state = windowsReducer(emptyWindows, {
      type: 'open',
      appId: 'dos',
      title: 'DOS',
      args: {},
      size: null,
    })
    const id = state.focused
    if (id === null) throw new Error('DOS did not open')
    const items: MenuEntry[] = [{ label: '&Toolbar', checked: true }]
    const remove = registerSystemMenuItems(id, items)
    expect(systemMenuItems.get().get(id)).toEqual(items)
    remove()
    expect(systemMenuItems.get().has(id)).toBe(false)
  })

  it('keeps a newer registration when an older contribution is cleaned up', () => {
    const state = windowsReducer(emptyWindows, {
      type: 'open',
      appId: 'dos',
      title: 'DOS',
      args: {},
      size: null,
    })
    const id = state.focused
    if (id === null) throw new Error('DOS did not open')
    const removeOld = registerSystemMenuItems(id, [{ label: 'Old' }])
    const items: MenuEntry[] = [{ label: 'New' }]
    const removeNew = registerSystemMenuItems(id, items)
    removeOld()
    expect(systemMenuItems.get().get(id)).toEqual(items)
    removeNew()
  })
})
