import { createStore, useStore } from '../lib/store'
import { ContextMenu, type MenuEntry } from '../ui/Menu'
import { requestWindowClose } from './closeRequests'
import { useWindows, windowsStore } from './system'
import { animateWindow } from './transitions'
import type { Point, WindowId } from './types'

type Menu = { id: WindowId; at: Point } | null
const store = createStore((_state: Menu, next: Menu) => next, null)
const controls = new Map<WindowId, (mode: 'move' | 'size') => void>()
export const openSystemMenu = (id: WindowId, at: Point) => store.dispatch({ id, at })
export function registerWindowControls(id: WindowId, handler: (mode: 'move' | 'size') => void) {
  controls.set(id, handler)
  return () => {
    controls.delete(id)
  }
}
export function SystemMenu() {
  const menu = useStore(store, (state) => state)
  const windows = useWindows((state) => state.windows)
  const window = windows.find((window) => window.id === menu?.id)
  if (!menu || !window) return null
  const id = window.id
  const items: MenuEntry[] = [
    {
      label: '&Restore',
      disabled: !window.minimized && !window.maximized,
      onSelect: () => animateWindow({ type: window.minimized ? 'focus' : 'toggleMaximize', id }),
    },
    {
      label: '&Move',
      disabled: window.maximized || window.minimized,
      onSelect: () => controls.get(id)?.('move'),
    },
    {
      label: '&Size',
      disabled: !window.size || window.maximized || window.minimized,
      onSelect: () => controls.get(id)?.('size'),
    },
    {
      label: 'Mi&nimize',
      disabled: window.minimized,
      onSelect: () => animateWindow({ type: 'minimize', id }),
    },
    {
      label: 'Ma&ximize',
      disabled: !window.size || window.maximized,
      onSelect: () => animateWindow({ type: 'toggleMaximize', id }),
    },
    'separator',
    {
      label: '&Close',
      shortcut: 'Alt+F4',
      bold: true,
      onSelect: () => {
        windowsStore.dispatch({ type: 'focus', id })
        void requestWindowClose(id)
      },
    },
  ]
  return <ContextMenu at={menu.at} items={items} onClose={() => store.dispatch(null)} />
}
