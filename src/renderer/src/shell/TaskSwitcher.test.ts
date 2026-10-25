import { describe, expect, it } from 'vitest'
import { cycleTask, switcherOrder } from './taskOrder'
import { emptyWindows, windowsReducer } from './windows'

describe('held Alt task order', () => {
  it('freezes the top-first order, includes minimized tasks, wraps both ways', () => {
    let state = emptyWindows
    for (const appId of ['one', 'two', 'three'])
      state = windowsReducer(state, { type: 'open', appId, title: appId, args: {}, size: null })
    const order = switcherOrder(state.windows)
    expect(order).toEqual(state.windows.map((window) => window.id).reverse())
    expect(cycleTask(order, undefined, false)).toBe(order[1])
    expect(cycleTask(order, undefined, true)).toBe(order[2])
    expect(cycleTask(order, order[2], false)).toBe(order[0])
    const first = order[0]
    if (first === undefined) throw new Error('Expected three tasks')
    state = windowsReducer(state, { type: 'minimize', id: first })
    expect(switcherOrder(state.windows)).toEqual(order)
    expect(cycleTask([], undefined, false)).toBeUndefined()
  })
})
