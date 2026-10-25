import { describe, expect, it } from 'vitest'
import type { WindowId } from './types'
import { emptyWindows, type WindowsAction, type WindowsState, windowsReducer } from './windows'

function run(...actions: WindowsAction[]): WindowsState {
  return actions.reduce(windowsReducer, emptyWindows)
}

const open = (appId: string): WindowsAction => ({ type: 'open', appId, title: appId, args: {}, size: null })
const id = (n: number) => n as WindowId
const order = (state: WindowsState) => state.windows.map((w) => w.appId)

describe('windowsReducer', () => {
  it('focuses each newly opened window on top and cascades it', () => {
    const state = run(open('calc'), open('notepad'))
    expect(order(state)).toEqual(['calc', 'notepad'])
    expect(state.focused).toBe(id(2))
    const [first, second] = state.windows
    expect(second?.position.x).toBeGreaterThan(first?.position.x ?? Infinity)
  })

  it('raises a window to the top when focused', () => {
    const state = run(open('calc'), open('notepad'), { type: 'focus', id: id(1) })
    expect(order(state)).toEqual(['notepad', 'calc'])
    expect(state.focused).toBe(id(1))
  })

  it('hands focus to the next visible window when the focused one minimizes', () => {
    const state = run(open('a'), open('b'), open('c'), { type: 'minimize', id: id(3) })
    expect(state.focused).toBe(id(2))
    expect(state.windows.find((w) => w.id === id(3))?.minimized).toBe(true)
  })

  it('leaves the desktop focused when the last visible window minimizes', () => {
    const state = run(open('a'), { type: 'minimize', id: id(1) })
    expect(state.focused).toBeNull()
  })

  it('toggles a window from the taskbar: minimize when focused, restore and raise otherwise', () => {
    const minimized = run(open('a'), open('b'), { type: 'taskbarClick', id: id(2) })
    expect(minimized.windows.find((w) => w.id === id(2))?.minimized).toBe(true)
    expect(minimized.focused).toBe(id(1))

    const restored = windowsReducer(minimized, { type: 'taskbarClick', id: id(2) })
    expect(restored.windows.at(-1)?.id).toBe(id(2))
    expect(restored.windows.at(-1)?.minimized).toBe(false)
    expect(restored.focused).toBe(id(2))

    const background = run(open('a'), open('b'), { type: 'taskbarClick', id: id(1) })
    expect(background.focused).toBe(id(1))
    expect(background.windows.every((w) => !w.minimized)).toBe(true)
  })

  it('keeps maximized through minimize and restore', () => {
    const state = run(
      open('a'),
      { type: 'toggleMaximize', id: id(1) },
      { type: 'minimize', id: id(1) },
      { type: 'taskbarClick', id: id(1) },
    )
    expect(state.windows[0]).toMatchObject({ maximized: true, minimized: false })
  })

  it('closes a window and focuses the next one down', () => {
    const state = run(open('a'), open('b'), open('c'), { type: 'focus', id: id(2) }, { type: 'close', id: id(2) })
    expect(order(state)).toEqual(['a', 'c'])
    expect(state.focused).toBe(id(3))
  })

  it('never reuses an id after a close', () => {
    const state = run(open('a'), { type: 'close', id: id(1) }, open('b'))
    expect(state.windows[0]?.id).toBe(id(2))
  })

  it('returns the same state for actions on missing windows and no-op changes', () => {
    const state = run(open('a'))
    expect(windowsReducer(state, { type: 'close', id: id(9) })).toBe(state)
    expect(windowsReducer(state, { type: 'focus', id: id(1) })).toBe(state)
    expect(windowsReducer(state, { type: 'setTitle', id: id(1), title: 'a' })).toBe(state)
  })

  it('moves and resizes only the target window', () => {
    const state = run(
      open('a'),
      open('b'),
      { type: 'resize', id: id(1), position: { x: 5, y: 6 }, size: { width: 300, height: 200 } },
    )
    expect(state.windows[0]).toMatchObject({ position: { x: 5, y: 6 }, size: { width: 300, height: 200 } })
    expect(state.windows[1]?.size).toBeNull()
  })
})
