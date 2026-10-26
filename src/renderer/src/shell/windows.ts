import type { LaunchArgs, Point, Size, WindowId, WindowSpec } from './types'

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
  readonly presentation?: WindowSpec
}

export interface WindowsState {
  /** Stacking order, bottom first. */
  readonly windows: readonly WindowState[]
  /** Always the topmost window that is not minimized, or `null` when the desktop has focus. */
  readonly focused: WindowId | null
  /** How many windows were ever opened. Feeds ids and the cascade. */
  readonly opened: number
  readonly minimizedAll: readonly WindowId[]
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
  | { type: 'setWindowSpec'; id: WindowId; spec: WindowSpec }
  | { type: 'blur' }
  | { type: 'minimizeAll' }
  | { type: 'undoMinimizeAll' }
  | { type: 'cycleBack' }
  | { type: 'arrange'; layout: 'cascade' | 'horizontal' | 'vertical'; desktop: Size }

export const emptyWindows: WindowsState = { windows: [], focused: null, opened: 0, minimizedAll: [] }

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
      return { ...state, windows: [...state.windows, window], focused: id, opened: state.opened + 1 }
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
    case 'setWindowSpec':
      return update(state, action.id, (w) =>
        w.presentation?.kind === action.spec.kind
          ? w
          : {
              ...w,
              presentation: action.spec,
              maximized: false,
              size:
                action.spec.kind === 'resizable'
                  ? { width: action.spec.width, height: action.spec.height }
                  : null,
            },
      )
    case 'blur':
      return state.focused === null ? state : { ...state, focused: null }
    case 'minimizeAll': {
      const ids = state.windows.filter((window) => !window.minimized).map((window) => window.id)
      if (!ids.length) return state
      return {
        ...state,
        focused: null,
        minimizedAll: ids,
        windows: state.windows.map((window) => ({ ...window, minimized: true })),
      }
    }
    case 'undoMinimizeAll': {
      const windows = state.windows.map((window) =>
        state.minimizedAll.includes(window.id) ? { ...window, minimized: false } : window,
      )
      return { ...state, windows, focused: topVisible(windows), minimizedAll: [] }
    }
    case 'cycleBack': {
      const active = state.windows.find((window) => window.id === state.focused)
      if (!active) return state
      const windows = [active, ...state.windows.filter((window) => window !== active)]
      return { ...state, windows, focused: topVisible(windows) }
    }
    case 'arrange': {
      const visible = state.windows.filter((window) => !window.minimized)
      const sizable = visible.filter((window) => window.size !== null)
      const windows = state.windows.map((window) => {
        if (window.minimized) return window
        const index = visible.indexOf(window)
        if (action.layout === 'cascade')
          return {
            ...window,
            maximized: false,
            position: { x: index * 24, y: index * 24 },
            size: window.size
              ? {
                  width: Math.max(120, action.desktop.width - visible.length * 24 - 8),
                  height: Math.max(40, action.desktop.height - visible.length * 24 - 27),
                }
              : null,
          }
        if (!window.size) return window
        const slot = sizable.indexOf(window)
        const width =
          action.layout === 'vertical'
            ? Math.floor(action.desktop.width / sizable.length)
            : action.desktop.width
        const height =
          action.layout === 'horizontal'
            ? Math.floor(action.desktop.height / sizable.length)
            : action.desktop.height
        return {
          ...window,
          maximized: false,
          position: {
            x: action.layout === 'vertical' ? slot * width : 0,
            y: action.layout === 'horizontal' ? slot * height : 0,
          },
          size: { width: Math.max(120, width - 8), height: Math.max(40, height - 27) },
        }
      })
      return { ...state, windows }
    }
  }
}
