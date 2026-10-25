import { describe, expect, it } from 'vitest'
import type { MenuEntry } from '../ui/Menu'
import { type MenuState, menuKey } from './menuMachine'

const roots: MenuEntry[][] = [
  [
    { label: '&New' },
    'separator',
    { label: '&Disabled', disabled: true },
    { label: '&Folder', items: [{ label: '&Child' }] },
  ],
  [{ label: '&All' }],
]
describe('menu keyboard state machine', () => {
  it('arms, opens, wraps and visits disabled entries but skips separators', () => {
    let state: MenuState = { kind: 'bar-armed', title: 0 }
    state = menuKey(state, 'ArrowDown', roots, true).state
    expect(state).toEqual({ kind: 'open', title: 0, path: [0] })
    state = menuKey(state, 'ArrowDown', roots, true).state
    expect(state).toEqual({ kind: 'open', title: 0, path: [2] })
    expect(menuKey(state, 'Enter', roots, true).command).toBeUndefined()
    expect(menuKey({ kind: 'open', title: 0, path: [3] }, 'ArrowDown', roots, true).state).toEqual({
      kind: 'open',
      title: 0,
      path: [0],
    })
  })
  it('unwinds one level and leaves the bar armed before closing', () => {
    const child = menuKey({ kind: 'open', title: 0, path: [3] }, 'ArrowRight', roots, true).state
    expect(child).toEqual({ kind: 'open', title: 0, path: [3, 0] })
    const parent = menuKey(child, 'Escape', roots, true).state
    expect(parent).toEqual({ kind: 'open', title: 0, path: [3] })
    const armed = menuKey(parent, 'Escape', roots, true).state
    expect(armed).toEqual({ kind: 'bar-armed', title: 0 })
    expect(menuKey(armed, 'Escape', roots, true).state.kind).toBe('closed')
  })
  it('executes accelerators and walks bar titles', () => {
    expect(menuKey({ kind: 'bar-armed', title: 0 }, 'e', roots, true, ['&File', '&Edit']).state).toEqual({
      kind: 'open',
      title: 1,
      path: [0],
    })
    expect(menuKey({ kind: 'open', title: 0, path: [0] }, 'n', roots, true).command?.label).toBe('&New')
    expect(menuKey({ kind: 'open', title: 0, path: [0] }, 'ArrowRight', roots, true).state).toEqual({
      kind: 'open',
      title: 1,
      path: [0],
    })
  })
})
