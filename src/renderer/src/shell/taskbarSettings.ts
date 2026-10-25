import { createStore, useStore } from '../lib/store'

export type Edge = 'top' | 'bottom' | 'left' | 'right'
export interface TaskbarSettings {
  edge: Edge
  rows: number
  alwaysOnTop: boolean
  autoHide: boolean
  smallIcons: boolean
  showClock: boolean
}
const defaults: TaskbarSettings = {
  edge: 'bottom',
  rows: 1,
  alwaysOnTop: true,
  autoHide: false,
  smallIcons: false,
  showClock: true,
}
function load(): TaskbarSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('w95.taskbar.v1') ?? 'null')
    if (!value || typeof value !== 'object') return defaults
    return {
      edge:
        'edge' in value && (value.edge === 'top' || value.edge === 'left' || value.edge === 'right')
          ? value.edge
          : 'bottom',
      rows:
        'rows' in value && typeof value.rows === 'number'
          ? Math.max(1, Math.min(5, Math.round(value.rows)))
          : 1,
      alwaysOnTop: !('alwaysOnTop' in value) || value.alwaysOnTop !== false,
      autoHide: 'autoHide' in value && value.autoHide === true,
      smallIcons: 'smallIcons' in value && value.smallIcons === true,
      showClock: !('showClock' in value) || value.showClock !== false,
    }
  } catch {
    return defaults
  }
}
export const taskbarRows = (edge: Edge, rows: number) =>
  Math.max(edge === 'left' || edge === 'right' ? 3 : 1, Math.min(5, Math.round(rows)))
const normalize = (value: TaskbarSettings): TaskbarSettings => ({
  ...value,
  rows: taskbarRows(value.edge, value.rows),
})
const store = createStore(
  (_state: TaskbarSettings, value: TaskbarSettings) => normalize(value),
  normalize(load()),
)
store.subscribe(() => localStorage.setItem('w95.taskbar.v1', JSON.stringify(store.get())))
export const setTaskbarSettings = (value: TaskbarSettings) => store.dispatch(value)
export const useTaskbarSettings = () => useStore(store, (state) => state)
export function workArea(settings: TaskbarSettings) {
  const amount = settings.autoHide ? 2 : settings.alwaysOnTop ? settings.rows * 28 : 0
  return {
    top: settings.edge === 'top' ? amount : 0,
    right: settings.edge === 'right' ? amount : 0,
    bottom: settings.edge === 'bottom' ? amount : 0,
    left: settings.edge === 'left' ? amount : 0,
  }
}
