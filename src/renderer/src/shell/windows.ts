import type { LaunchArgs, Point, Size, WindowId } from './types'

export interface WindowState {
  readonly id: WindowId
  readonly appId: string
  readonly title: string
  readonly args: LaunchArgs
  /** Top-left of the frame, in desktop pixels. */
  readonly position: Point
  /** Client area size. `null` sizes the window to its content. */
  readonly size: Size | null
  readonly minimized: boolean
  readonly maximized: boolean
}

export interface WindowsState {
  /** Stacking order, bottom first. */
  readonly windows: readonly WindowState[]
  /** Always the topmost window that is not minimized, or `null` when the desktop has focus. */
  readonly focused: WindowId | null
  /** How many windows were ever opened. Feeds ids and the cascade. */
  readonly opened: number
}

export type WindowsAction =
  | { type: 'open'; appId: string; title: string; args: LaunchArgs; size: Size | null }
  | { type: 'close'; id: WindowId }
  | { type: 'closeAll' }
  | { type: 'focus'; id: WindowId }
  | { type: 'taskbarClick'; id: WindowId }
  | { type: 'minimize'; id: WindowId }
  | { type: 'toggleMaximize'; id: WindowId }
  | { type: 'move'; id: WindowId; position: Point }
  | { type: 'resize'; id: WindowId; position: Point; size: Size }
  | { type: 'setTitle'; id: WindowId; title: string }
  | { type: 'blur' }

export const emptyWindows: WindowsState = { windows: [], focused: null, opened: 0 }

const CASCADE_STEPS = 10
const CASCADE_OFFSET = 24

function cascade(opened: number): Point {
  const step = opened % CASCADE_STEPS
  return { x: 32 + step * CASCADE_OFFSET, y: 24 + step * CASCADE_OFFSET }
}

function topVisible(windows: readonly WindowState[]): WindowId | null {
  for (let i = windows.length - 1; i >= 0; i--) {
    const window = windows[i]
    if (window && !window.minimized) return window.id
  }
  return null
}

function raise(state: WindowsState, id: WindowId): WindowsState {
  const target = state.windows.find((w) => w.id === id)
  if (!target) return state
  const isTop = state.windows.at(-1) === target
  if (isTop && !target.minimized && state.focused === id) return state
  const restored = target.minimized ? { ...target, minimized: false } : target
  return { ...state, windows: [...state.windows.filter((w) => w !== target), restored], focused: id }
}

function update(state: WindowsState, id: WindowId, change: (w: WindowState) => WindowState): WindowsState {
  let changed = false
  const windows = state.windows.map((w) => {
    if (w.id !== id) return w
    const next = change(w)
    changed ||= next !== w
    return next
  })
  return changed ? { ...state, windows } : state
}

export function windowsReducer(state: WindowsState, action: WindowsAction): WindowsState {
  switch (action.type) {
    case 'open': {
      const id = (state.opened + 1) as WindowId
      const window: WindowState = {
        id,
        appId: action.appId,
        title: action.title,
        args: action.args,
        position: cascade(state.opened),
        size: action.size,
        minimized: false,
        maximized: false,
      }
      return { windows: [...state.windows, window], focused: id, opened: state.opened + 1 }
    }
    case 'close': {
      if (!state.windows.some((w) => w.id === action.id)) return state
      const windows = state.windows.filter((w) => w.id !== action.id)
      return { ...state, windows, focused: topVisible(windows) }
    }
    case 'closeAll':
      return state.windows.length === 0 ? state : { ...state, windows: [], focused: null }
    case 'focus':
      return raise(state, action.id)
    case 'taskbarClick': {
      const target = state.windows.find((w) => w.id === action.id)
      if (!target) return state
      if (state.focused === action.id) return windowsReducer(state, { type: 'minimize', id: action.id })
      return raise(state, action.id)
    }
    case 'minimize': {
      const next = update(state, action.id, (w) => (w.minimized ? w : { ...w, minimized: true }))
      return next === state ? state : { ...next, focused: topVisible(next.windows) }
    }
    case 'toggleMaximize': {
      const next = update(state, action.id, (w) => ({ ...w, maximized: !w.maximized }))
      return next === state ? state : raise(next, action.id)
    }
    case 'move':
      return update(state, action.id, (w) => ({ ...w, position: action.position }))
    case 'resize':
      return update(state, action.id, (w) => ({ ...w, position: action.position, size: action.size }))
    case 'setTitle':
      return update(state, action.id, (w) => (w.title === action.title ? w : { ...w, title: action.title }))
    case 'blur':
      return state.focused === null ? state : { ...state, focused: null }
  }
}
