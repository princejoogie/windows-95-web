import { createStore, useStore } from '../lib/store'
import type { Rect } from './Outline'
import { windowsStore } from './system'
import type { WindowId } from './types'

type TransitionAction = { type: 'minimize' | 'toggleMaximize' | 'focus' | 'taskbarClick'; id: WindowId }
type Zoom = { title: string; rect: Rect } | null
const store = createStore((_state: Zoom, value: Zoom) => value, null)
const busy = new Set<WindowId>()
export async function animateWindow(action: TransitionAction) {
  if (busy.has(action.id)) return
  const state = windowsStore.get()
  const window = state.windows.find((window) => window.id === action.id)
  if (!window) return
  const minimizing =
    action.type === 'minimize' || (action.type === 'taskbarClick' && state.focused === action.id)
  const maximizing = action.type === 'toggleMaximize' && !window.maximized
  const restoring = window.minimized || action.type === 'toggleMaximize'
  const frame = document.querySelector<HTMLElement>(`[data-window="${action.id}"]`)
  const task = document.querySelector(`[data-task="${action.id}"]`)?.getBoundingClientRect()
  const desktop = document.querySelector('[data-desktop]')?.getBoundingClientRect()
  const bounds = frame?.getBoundingClientRect()
  const normal: Rect = {
    x: (desktop?.x ?? 0) + window.position.x + 4,
    y: (desktop?.y ?? 0) + window.position.y + 4,
    width: window.size?.width ?? bounds?.width ?? 200,
    height: 18,
  }
  const caption: Rect = bounds
    ? { x: bounds.x + 4, y: bounds.y + 4, width: bounds.width - 8, height: 18 }
    : normal
  const taskRect: Rect = task ? { x: task.x, y: task.y, width: task.width, height: 18 } : normal
  const from = window.minimized ? taskRect : caption
  const to = minimizing
    ? taskRect
    : maximizing && desktop
      ? { x: desktop.x, y: desktop.y, width: desktop.width, height: 18 }
      : normal
  if ((minimizing || restoring || maximizing) && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    busy.add(action.id)
    for (let step = 0; step <= 8; step++) {
      const t = step / 8
      store.dispatch({
        title: window.title,
        rect: {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
          width: from.width + (to.width - from.width) * t,
          height: 18,
        },
      })
      await new Promise((done) => setTimeout(done, 25))
    }
    store.dispatch(null)
    busy.delete(action.id)
  }
  windowsStore.dispatch(action)
}
export function CaptionZoom() {
  const zoom = useStore(store, (state) => state)
  return zoom ? (
    <div
      data-caption-zoom
      className="fixed z-[11001] bg-title text-white font-bold px-[2px] truncate pointer-events-none"
      style={{ left: zoom.rect.x, top: zoom.rect.y, width: zoom.rect.width, height: 18 }}
    >
      {zoom.title}
    </div>
  ) : null
}
